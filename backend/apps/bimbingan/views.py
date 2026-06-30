"""
Phase 2 views:

Approve / Reject:
  ApproveSubmissionView  — POST /api/submissions/<id>/approve/
  RejectSubmissionView   — POST /api/submissions/<id>/reject/

Queue:
  StudentQueueView       — GET  /api/queue/my/
  CancelStudentQueueView — POST /api/queue/<id>/cancel/
  StartSessionView       — POST /api/queue/<id>/start/
  LecturerQueueView      — GET  /api/queue/lecturer/

Dashboard stats:
  LecturerStatsView      — GET  /api/stats/lecturer/
  AdminStatsView         — GET  /api/stats/admin/
  AdminEmergencyCancelView — POST /api/stats/admin/emergency-cancel/
  KaprodiStatsView       — GET  /api/stats/kaprodi/
  KaprodiExportView      — GET  /api/stats/kaprodi/export/

Calendar OAuth:
  CalendarAuthView       — GET /api/calendar/auth/
  CalendarCallbackView   — GET /api/calendar/callback/
  CalendarStatusView     — GET /api/calendar/status/
"""
import logging
from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsLecturer, IsStudent
from apps.submissions.models import Submission

from .models import DosenCalendarToken, Session, SystemLog
from .serializers import (
    ApproveSubmissionSerializer,
    LecturerQueueItemSerializer,
    RejectSubmissionSerializer,
    SessionDetailSerializer,
    StudentQueueSerializer,
)
from .services import calendar as cal_service
from .services.notification import notify_lecturer, notify_student

logger = logging.getLogger(__name__)

# Daily quota in minutes (used for quota-full check)
DOSEN_DAILY_QUOTA_MINUTES = getattr(settings, 'DOSEN_DAILY_QUOTA_MINUTES', 480)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_submission_for_lecturer(submission_id, lecturer):
    """
    Fetch submission, validate it belongs to this lecturer's advisee.
    Returns (submission, error_response) — one will be None.
    """
    try:
        submission = (
            Submission.objects
            .select_related('student__adviser')
            .prefetch_related('symptoms')
            .get(pk=submission_id)
        )
    except Submission.DoesNotExist:
        return None, Response(
            {'detail': 'Submission tidak ditemukan.'},
            status=status.HTTP_404_NOT_FOUND,
        )

    if submission.student.adviser != lecturer:
        return None, Response(
            {'detail': 'Anda tidak memiliki izin untuk mengubah submission ini.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return submission, None


def _calculate_schedule(dosen):
    """
    Calculate scheduledAt for a new session: now + total duration of today's WAITING sessions.
    Returns (scheduled_at datetime, queue_position int, total_wait_minutes int).
    """
    today = timezone.now().date()
    waiting_sessions = Session.objects.filter(
        submission__student__adviser=dosen,
        status=Session.Status.WAITING,
        scheduled_at__date=today,
    ).order_by('scheduled_at')

    total_wait = sum(s.estimated_minutes for s in waiting_sessions)
    scheduled_at = timezone.now() + timedelta(minutes=total_wait)
    queue_position = waiting_sessions.count() + 1
    return scheduled_at, queue_position, total_wait


# ── Approve ────────────────────────────────────────────────────────────────────

class ApproveSubmissionView(APIView):
    """
    POST /api/submissions/<id>/approve/
    FR-D01, FR-D04, FR-S02, FR-S06, FR-S07
    """
    permission_classes = [IsLecturer]

    def post(self, request, pk):
        submission, err = _get_submission_for_lecturer(pk, request.user)
        if err:
            return err

        if submission.status != Submission.Status.PENDING:
            return Response(
                {'detail': 'Hanya submission dengan status PENDING yang dapat disetujui.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check student doesn't already have an active session
        active_session = Session.objects.filter(
            submission__student=submission.student,
            status=Session.Status.WAITING,
        ).first()
        if active_session:
            return Response(
                {'detail': 'Mahasiswa sudah memiliki sesi aktif dalam antrian.'},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = ApproveSubmissionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        method = serializer.validated_data['method']
        meeting_link = serializer.validated_data.get('meeting_link') or None

        # FR-S02: Calculate estimated duration from symptoms
        estimated_minutes = sum(
            s.duration_minutes for s in submission.symptoms.all()
        ) or 30  # fallback 30 min if no symptoms

        dosen = request.user
        today = timezone.now().date()

        # Check daily quota
        today_total = sum(
            s.estimated_minutes
            for s in Session.objects.filter(
                submission__student__adviser=dosen,
                status=Session.Status.WAITING,
                scheduled_at__date=today,
            )
        )
        if today_total + estimated_minutes > DOSEN_DAILY_QUOTA_MINUTES:
            return Response(
                {'detail': 'Kuota harian dosen penuh. Tidak dapat menerima sesi baru hari ini.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Calculate schedule
        scheduled_at, queue_position, _ = _calculate_schedule(dosen)

        # FR-S06: Check Google Calendar free/busy (graceful degradation)
        end_time = scheduled_at + timedelta(minutes=estimated_minutes)
        fb = cal_service.check_free_busy(dosen, scheduled_at, end_time)
        if not fb['isFree']:
            SystemLog.objects.create(
                level=SystemLog.Level.WARNING,
                event_type='CALENDAR_CONFLICT',
                message=f'Kalender dosen {dosen.email} tidak bebas pada {scheduled_at}',
                context={'dosen_id': dosen.id, 'conflicts': fb['conflicts']},
            )
            # Don't block approve — just log the conflict

        # Create session
        session = Session.objects.create(
            submission=submission,
            status=Session.Status.WAITING,
            method=method,
            meeting_link=meeting_link,
            estimated_minutes=estimated_minutes,
            scheduled_at=scheduled_at,
        )

        # Update submission status
        submission.status = Submission.Status.APPROVED
        submission.save(update_fields=['status', 'updated_at'])

        # FR-S07: Create Google Calendar event (graceful degradation)
        student = submission.student
        symptom_names = ', '.join(s.name for s in submission.symptoms.all())
        google_event_id = cal_service.create_event(dosen, {
            'title': f'Bimbingan {student.full_name}',
            'description': f'Bimbingan {student.full_name} - {symptom_names}',
            'start_time': scheduled_at,
            'end_time': end_time,
            'attendee_email': student.email,
        })
        if google_event_id:
            session.google_event_id = google_event_id
            session.save(update_fields=['google_event_id'])

        # Notify student
        notify_student(
            student,
            f'Pengajuan bimbingan Anda telah disetujui. '
            f'Jadwal: {scheduled_at.strftime("%d/%m/%Y %H:%M")} WIB. '
            f'Nomor antrian: {queue_position}.',
            session=session,
            event_type='APPROVED',
        )

        SystemLog.objects.create(
            level=SystemLog.Level.INFO,
            event_type='SUBMISSION_APPROVED',
            message=f'Submission #{submission.id} disetujui oleh {dosen.email}',
            context={'submission_id': submission.id, 'session_id': session.id},
        )

        return Response(
            {
                'message': 'Submission berhasil disetujui',
                'submission': {
                    'id': submission.id,
                    'status': submission.status,
                    'updated_at': submission.updated_at.isoformat(),
                },
                'session': {
                    'id': session.id,
                    'status': session.status,
                    'method': session.method,
                    'meeting_link': session.meeting_link,
                    'estimated_minutes': session.estimated_minutes,
                    'scheduled_at': session.scheduled_at.isoformat() if session.scheduled_at else None,
                    'queue_position': queue_position,
                    'google_event_id': session.google_event_id,
                },
            },
            status=status.HTTP_200_OK,
        )


# ── Reject / Revisi ────────────────────────────────────────────────────────────

class RejectSubmissionView(APIView):
    """
    POST /api/submissions/<id>/reject/
    FR-D01: Dosen tolak atau minta revisi.
    """
    permission_classes = [IsLecturer]

    def post(self, request, pk):
        submission, err = _get_submission_for_lecturer(pk, request.user)
        if err:
            return err

        if submission.status != Submission.Status.PENDING:
            return Response(
                {'detail': 'Hanya submission dengan status PENDING yang dapat ditolak/direvisi.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RejectSubmissionSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        action = serializer.validated_data['action']
        reason = serializer.validated_data['reason']

        if action == 'REJECTED':
            submission.status = Submission.Status.REJECTED
            message_id = 'Submission ditolak'
            notify_msg = (
                f'Pengajuan bimbingan Anda ditolak. Alasan: {reason}'
            )
            event_type = 'SUBMISSION_REJECTED'
        else:
            submission.status = Submission.Status.REVISION
            message_id = 'Submission dikembalikan untuk revisi'
            notify_msg = (
                f'Pengajuan bimbingan Anda perlu direvisi. Catatan: {reason}'
            )
            event_type = 'SUBMISSION_REVISION'

        submission.rejection_reason = reason
        submission.save(update_fields=['status', 'rejection_reason', 'updated_at'])

        notify_student(submission.student, notify_msg, event_type=event_type)

        SystemLog.objects.create(
            level=SystemLog.Level.INFO,
            event_type=event_type,
            message=f'Submission #{submission.id} — action={action} oleh {request.user.email}',
            context={'submission_id': submission.id, 'reason': reason},
        )

        return Response(
            {
                'message': message_id,
                'submission': {
                    'id': submission.id,
                    'status': submission.status,
                    'rejection_reason': submission.rejection_reason,
                    'updated_at': submission.updated_at.isoformat(),
                },
            },
            status=status.HTTP_200_OK,
        )


# ── Student Queue ──────────────────────────────────────────────────────────────

class StudentQueueView(APIView):
    """GET /api/queue/my/ — FR-M02: mahasiswa lihat nomor antrian + estimasi waktu."""
    permission_classes = [IsStudent]

    def get(self, request):
        session = (
            Session.objects
            .filter(
                submission__student=request.user,
                status__in=[Session.Status.WAITING, Session.Status.IN_PROGRESS],
            )
            .select_related('submission__student__adviser')
            .order_by('-created_at')
            .first()
        )

        if not session:
            return Response({'hasActiveQueue': False, 'session': None})

        serializer = StudentQueueSerializer(session)
        return Response({'hasActiveQueue': True, 'session': serializer.data})


class CancelStudentQueueView(APIView):
    """POST /api/queue/<id>/cancel/ — mahasiswa batalkan antrian."""
    permission_classes = [IsStudent]

    def post(self, request, pk):
        try:
            session = (
                Session.objects
                .select_related('submission__student', 'submission__student__adviser')
                .get(pk=pk)
            )
        except Session.DoesNotExist:
            return Response({'detail': 'Sesi tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        if session.submission.student != request.user:
            return Response({'detail': 'Anda tidak memiliki izin.'}, status=status.HTTP_403_FORBIDDEN)

        if session.status != Session.Status.WAITING:
            return Response(
                {'detail': 'Hanya sesi dengan status WAITING yang dapat dibatalkan.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        dosen = session.submission.student.adviser

        # Cancel
        session.status = Session.Status.CANCELLED
        session.save(update_fields=['status', 'updated_at'])

        session.submission.status = Submission.Status.CANCELLED
        session.submission.save(update_fields=['status', 'updated_at'])

        # Delete Google Calendar event
        if session.google_event_id and dosen:
            cal_service.delete_event(dosen, session.google_event_id)

        # Notify dosen
        if dosen:
            notify_lecturer(
                dosen,
                f'Sesi bimbingan dengan {request.user.full_name} telah dibatalkan oleh mahasiswa.',
                session=session,
                event_type='STUDENT_CANCEL',
            )

        # Recalculate remaining queue
        if dosen:
            from .scheduler import _recalculate_queue
            _recalculate_queue(dosen)

        SystemLog.objects.create(
            level=SystemLog.Level.INFO,
            event_type='STUDENT_CANCEL',
            message=f'Mahasiswa {request.user.email} membatalkan sesi #{session.id}',
            context={'session_id': session.id, 'student_id': request.user.id},
        )

        return Response({'message': 'Antrian berhasil dibatalkan.'})


# ── Lecturer Queue ─────────────────────────────────────────────────────────────

class LecturerQueueView(APIView):
    """GET /api/queue/lecturer/ — dosen lihat antrian hari ini."""
    permission_classes = [IsLecturer]

    def get(self, request):
        dosen = request.user
        today = timezone.now().date()
        waiting = Session.objects.filter(
            submission__student__adviser=dosen,
            status=Session.Status.WAITING,
            scheduled_at__date=today,
        ).select_related(
            'submission__student',
        ).prefetch_related(
            'submission__symptoms',
        ).order_by('scheduled_at')

        total_waiting = waiting.count()
        total_minutes = sum(s.estimated_minutes for s in waiting)
        estimated_end_time = timezone.now() + timedelta(minutes=total_minutes)

        serializer = LecturerQueueItemSerializer(waiting, many=True)
        return Response({
            'totalWaiting': total_waiting,
            'estimatedEndTime': estimated_end_time.isoformat(),
            'queue': serializer.data,
        })


# ── Google Calendar OAuth ──────────────────────────────────────────────────────

class CalendarAuthView(APIView):
    """GET /api/calendar/auth/ — redirect dosen ke Google OAuth consent screen."""
    permission_classes = [IsLecturer]

    def get(self, request):
        if not getattr(settings, 'GOOGLE_CALENDAR_ENABLED', False):
            return Response(
                {'detail': 'Google Calendar tidak diaktifkan di server ini.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            from google_auth_oauthlib.flow import Flow
            from django.shortcuts import redirect as django_redirect

            flow = Flow.from_client_config(
                {
                    'web': {
                        'client_id': settings.GOOGLE_CLIENT_ID,
                        'client_secret': settings.GOOGLE_CLIENT_SECRET,
                        'redirect_uris': [settings.GOOGLE_REDIRECT_URI],
                        'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
                        'token_uri': 'https://oauth2.googleapis.com/token',
                    }
                },
                scopes=['https://www.googleapis.com/auth/calendar'],
            )
            flow.redirect_uri = settings.GOOGLE_REDIRECT_URI

            authorization_url, state = flow.authorization_url(
                access_type='offline',
                include_granted_scopes='true',
                prompt='consent',
            )

            request.session['oauth_state'] = state
            request.session['oauth_dosen_id'] = str(request.user.id)

            return django_redirect(authorization_url)
        except Exception as e:
            logger.exception('CalendarAuthView error: %s', e)
            return Response(
                {'detail': 'Gagal membuat URL autentikasi Google.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CalendarCallbackView(APIView):
    """GET /api/calendar/callback/ — terima code dari Google, simpan token."""
    permission_classes = [IsLecturer]

    def get(self, request):
        if not getattr(settings, 'GOOGLE_CALENDAR_ENABLED', False):
            return Response({'detail': 'Google Calendar tidak diaktifkan.'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        code = request.GET.get('code')
        state = request.GET.get('state')
        stored_state = request.session.get('oauth_state')

        if not code or state != stored_state:
            return Response({'detail': 'Parameter OAuth tidak valid.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from google_auth_oauthlib.flow import Flow
            from django.utils import timezone as dj_timezone

            flow = Flow.from_client_config(
                {
                    'web': {
                        'client_id': settings.GOOGLE_CLIENT_ID,
                        'client_secret': settings.GOOGLE_CLIENT_SECRET,
                        'redirect_uris': [settings.GOOGLE_REDIRECT_URI],
                        'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
                        'token_uri': 'https://oauth2.googleapis.com/token',
                    }
                },
                scopes=['https://www.googleapis.com/auth/calendar'],
                state=state,
            )
            flow.redirect_uri = settings.GOOGLE_REDIRECT_URI
            flow.fetch_token(code=code)

            creds = flow.credentials
            from datetime import timezone as dt_tz

            expires_at = (
                creds.expiry.replace(tzinfo=dt_tz.utc)
                if creds.expiry else dj_timezone.now()
            )

            DosenCalendarToken.objects.update_or_create(
                dosen=request.user,
                defaults={
                    'access_token_enc': cal_service.encrypt_token(creds.token),
                    'refresh_token_enc': cal_service.encrypt_token(creds.refresh_token or ''),
                    'expires_at': expires_at,
                },
            )

            del request.session['oauth_state']
            del request.session['oauth_dosen_id']

            return Response({'message': 'Google Calendar berhasil dihubungkan.'})
        except Exception as e:
            logger.exception('CalendarCallbackView error: %s', e)
            return Response({'detail': 'Gagal menyimpan token Google.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CalendarStatusView(APIView):
    """GET /api/calendar/status/ — cek apakah dosen sudah connect Google Calendar."""
    permission_classes = [IsLecturer]

    def get(self, request):
        connected = DosenCalendarToken.objects.filter(dosen=request.user).exists()
        enabled = getattr(settings, 'GOOGLE_CALENDAR_ENABLED', False)
        return Response({
            'enabled': enabled,
            'connected': connected,
        })


# ── Mulai & Rekam ──────────────────────────────────────────────────────────────

class StartSessionView(APIView):
    """POST /api/queue/<id>/start/ — Dosen mulai sesi (set ts1, status → IN_PROGRESS)."""
    permission_classes = [IsLecturer]

    def post(self, request, pk):
        try:
            session = Session.objects.select_related(
                'submission__student__adviser'
            ).get(pk=pk)
        except Session.DoesNotExist:
            return Response({'detail': 'Sesi tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        if session.submission.student.adviser != request.user:
            return Response({'detail': 'Anda tidak memiliki izin.'}, status=status.HTTP_403_FORBIDDEN)

        if session.status != Session.Status.WAITING:
            return Response(
                {'detail': 'Hanya sesi WAITING yang dapat dimulai.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session.status = Session.Status.IN_PROGRESS
        session.ts1 = timezone.now()
        session.save(update_fields=['status', 'ts1', 'updated_at'])

        notify_student(
            session.submission.student,
            f'Giliran Anda tiba! Silakan temui {request.user.full_name} sekarang.',
            session=session,
            event_type='SESSION_STARTED',
        )

        SystemLog.objects.create(
            level=SystemLog.Level.INFO,
            event_type='SESSION_STARTED',
            message=f'Sesi #{session.id} dimulai oleh {request.user.email}',
            context={'session_id': session.id},
        )
        return Response({'message': 'Sesi berhasil dimulai.', 'ts1': session.ts1.isoformat()})


# ── Dashboard Stats ────────────────────────────────────────────────────────────

class LecturerStatsView(APIView):
    """GET /api/stats/lecturer/ — statistik mingguan dosen."""
    permission_classes = [IsLecturer]

    def get(self, request):
        from datetime import timedelta as td
        dosen = request.user
        now = timezone.now()
        week_start = now - td(days=7)

        sessions_week = Session.objects.filter(
            submission__student__adviser=dosen,
            created_at__gte=week_start,
        )
        total_week = sessions_week.count()
        done_week = sessions_week.filter(status=Session.Status.DONE).count()

        durations = [
            s.estimated_minutes for s in sessions_week
            if s.estimated_minutes > 0
        ]
        avg_duration = round(sum(durations) / len(durations)) if durations else 0

        return Response({
            'total_sessions_week': total_week,
            'done_sessions_week': done_week,
            'avg_duration_minutes': avg_duration,
        })


class AdminStatsView(APIView):
    """GET /api/stats/admin/ — statistik untuk admin dashboard."""
    permission_classes = [IsLecturer]  # overridden below

    def get_permissions(self):
        from apps.accounts.permissions import IsAdmin
        return [IsAdmin()]

    def get(self, request):
        from apps.accounts.models import CustomUser
        now = timezone.now()
        today = now.date()

        recent_errors = list(
            SystemLog.objects.filter(level=SystemLog.Level.ERROR)
            .order_by('-created_at')[:8]
            .values('id', 'event_type', 'message', 'created_at')
        )
        # Serialize datetime for JSON
        for e in recent_errors:
            e['created_at'] = e['created_at'].isoformat()

        return Response({
            'total_students': CustomUser.objects.filter(role='student', is_approved=True).count(),
            'total_lecturers': CustomUser.objects.filter(role='lecturer', is_approved=True).count(),
            'total_pending_users': CustomUser.objects.filter(is_approved=False).count(),
            'active_sessions_today': Session.objects.filter(
                status__in=[Session.Status.WAITING, Session.Status.IN_PROGRESS],
            ).count(),
            'recent_errors': recent_errors,
            'integrations': {
                'google_calendar': {
                    'enabled': getattr(settings, 'GOOGLE_CALENDAR_ENABLED', False),
                    'connected_dosens': DosenCalendarToken.objects.count(),
                },
                'logbook': {'enabled': False},
            },
        })


class AdminEmergencyCancelView(APIView):
    """POST /api/stats/admin/emergency-cancel/ — batalkan semua sesi aktif satu dosen."""

    def get_permissions(self):
        from apps.accounts.permissions import IsAdmin
        return [IsAdmin()]

    def post(self, request):
        from apps.accounts.models import CustomUser
        dosen_id = request.data.get('dosen_id')
        if not dosen_id:
            return Response({'detail': 'dosen_id wajib diisi.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            dosen = CustomUser.objects.get(pk=dosen_id, role='lecturer')
        except CustomUser.DoesNotExist:
            return Response({'detail': 'Dosen tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        sessions = Session.objects.filter(
            submission__student__adviser=dosen,
            status__in=[Session.Status.WAITING, Session.Status.IN_PROGRESS],
        ).select_related('submission__student')

        cancelled = 0
        for session in sessions:
            if session.google_event_id:
                cal_service.delete_event(dosen, session.google_event_id)
            session.status = Session.Status.CANCELLED
            session.save(update_fields=['status', 'updated_at'])
            session.submission.status = Submission.Status.CANCELLED
            session.submission.save(update_fields=['status', 'updated_at'])
            notify_student(
                session.submission.student,
                f'Sesi bimbingan dibatalkan oleh admin.',
                session=session,
                event_type='EMERGENCY_CANCEL',
            )
            cancelled += 1

        SystemLog.objects.create(
            level=SystemLog.Level.WARNING,
            event_type='EMERGENCY_CANCEL',
            message=f'Admin {request.user.email} membatalkan {cancelled} sesi dosen {dosen.email}',
            context={'dosen_id': dosen.id, 'cancelled': cancelled},
        )
        return Response({'message': f'{cancelled} sesi berhasil dibatalkan.', 'cancelled': cancelled})


class KaprodiStatsView(APIView):
    """GET /api/stats/kaprodi/ — statistik untuk kaprodi dashboard."""

    def get_permissions(self):
        from apps.accounts.permissions import IsKaprodi, IsAdmin
        from rest_framework.permissions import BasePermission

        class IsKaprodiOrAdmin(BasePermission):
            def has_permission(self, request, view):
                return bool(request.user and request.user.is_authenticated and
                            request.user.role in ('kaprodi', 'admin'))
        return [IsKaprodiOrAdmin()]

    def get(self, request):
        from apps.accounts.models import CustomUser
        from datetime import timedelta as td
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        week_start = now - td(days=7)

        sessions_month = Session.objects.filter(created_at__gte=month_start)
        total_month = sessions_month.count()

        # Average wait = average estimated_minutes for done sessions
        done = Session.objects.filter(
            status=Session.Status.DONE,
            created_at__gte=month_start,
        )
        waits = [s.estimated_minutes for s in done if s.estimated_minutes]
        avg_wait = round(sum(waits) / len(waits)) if waits else 0

        # Per-dosen workload (this month)
        lecturers = CustomUser.objects.filter(role='lecturer', is_approved=True)
        workload = []
        for dosen in lecturers:
            s = Session.objects.filter(
                submission__student__adviser=dosen,
                created_at__gte=month_start,
            )
            total = s.count()
            if total == 0:
                continue
            mins = [x.estimated_minutes for x in s if x.estimated_minutes]
            workload.append({
                'dosen_id': dosen.id,
                'dosen_name': dosen.full_name,
                'total_sessions': total,
                'avg_duration': round(sum(mins) / len(mins)) if mins else 0,
            })
        workload.sort(key=lambda x: x['total_sessions'], reverse=True)

        return Response({
            'total_sessions_month': total_month,
            'avg_wait_minutes': avg_wait,
            'dosen_workload': workload,
            'month_label': month_start.strftime('%B %Y'),
        })


class KaprodiExportView(APIView):
    """GET /api/stats/kaprodi/export/ — ekspor laporan CSV."""

    def get_permissions(self):
        from rest_framework.permissions import BasePermission

        class IsKaprodiOrAdmin(BasePermission):
            def has_permission(self, request, view):
                return bool(request.user and request.user.is_authenticated and
                            request.user.role in ('kaprodi', 'admin'))
        return [IsKaprodiOrAdmin()]

    def get(self, request):
        import csv
        from django.http import HttpResponse
        now = timezone.now()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        sessions = Session.objects.filter(
            created_at__gte=month_start,
        ).select_related('submission__student', 'submission__student__adviser').prefetch_related('submission__symptoms')

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="laporan_{now.strftime("%Y%m")}.csv"'
        response.write('﻿')  # UTF-8 BOM for Excel

        writer = csv.writer(response)
        writer.writerow(['ID Sesi', 'Mahasiswa', 'NIM', 'Dosen', 'Status', 'Metode',
                         'Estimasi (menit)', 'Dijadwalkan', 'Dibuat'])
        for s in sessions:
            writer.writerow([
                s.id,
                s.submission.student.full_name,
                s.submission.student.nim or '-',
                s.submission.student.adviser.full_name if s.submission.student.adviser else '-',
                s.get_status_display(),
                s.get_method_display() if s.method else '-',
                s.estimated_minutes,
                s.scheduled_at.strftime('%Y-%m-%d %H:%M') if s.scheduled_at else '-',
                s.created_at.strftime('%Y-%m-%d %H:%M'),
            ])
        return response
