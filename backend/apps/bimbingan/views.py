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
  KetuaJurusanStatsView       — GET  /api/ketua-jurusan/stats/
  KetuaJurusanExportView      — GET  /api/ketua-jurusan/export/

Calendar OAuth:
  CalendarAuthView       — GET /api/calendar/auth/
  CalendarCallbackView   — GET /api/calendar/callback/
  CalendarStatusView     — GET /api/calendar/status/
"""
import logging
import threading
from datetime import timedelta

from django.conf import settings
from django.db import close_old_connections
from django.utils import timezone
from rest_framework import permissions as _permissions
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsLecturer, IsStudent
from apps.submissions.models import Submission

from .models import ActionItem, DosenCalendarToken, Session, SessionRecording, SystemLog
from .serializers import (
    ApproveSubmissionSerializer,
    LecturerQueueItemSerializer,
    RejectSubmissionSerializer,
    SessionDetailSerializer,
    SessionHistorySerializer,
    StudentQueueSerializer,
)
from .services import calendar as cal_service
from .services.notification import notify_lecturer, notify_student

logger = logging.getLogger(__name__)

# Daily quota in minutes (used for quota-full check)
DOSEN_DAILY_QUOTA_MINUTES = getattr(settings, 'DOSEN_DAILY_QUOTA_MINUTES', 480)


# ── Helpers ────────────────────────────────────────────────────────────────────

class IsKetuaJurusanOrAdmin(_permissions.BasePermission):
    """Shared permission for ketua-jurusan-facing endpoints (FR-KP01–04): ketua jurusan or admin."""

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated and
            request.user.role in ('ketua_jurusan', 'admin')
        )


def _period_start(period: str, now):
    """
    FR-KP01/02: resolve the cutoff datetime for a reporting period.
    weekly = last 7 days, monthly = start of this month, semester = last ~6 months.
    """
    from datetime import timedelta as td

    if period == 'weekly':
        return now - td(days=7)
    if period == 'semester':
        return now - td(days=182)
    # default: monthly
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


_PERIOD_LABELS = {'weekly': 'Minggu Ini', 'monthly': 'Bulan Ini', 'semester': 'Semester Ini'}

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
    ).order_by('scheduled_at')

    total_wait = sum(s.estimated_minutes for s in waiting_sessions)
    scheduled_at = timezone.now() + timedelta(minutes=total_wait)
    queue_position = waiting_sessions.count() + 1
    return scheduled_at, queue_position, total_wait


def _create_calendar_event_async(dosen_id, session_id, event_data):
    """
    FR-S07 / NFR-01: run the Google Calendar event creation in a background
    thread so the approve request never blocks on the Google API round-trip.

    Runs in its own thread, so it must open its own DB connection (Django
    connections are thread-local) and close it when done to avoid leaks.
    """
    close_old_connections()
    try:
        from apps.accounts.models import CustomUser

        dosen = CustomUser.objects.get(pk=dosen_id)
        session = Session.objects.get(pk=session_id)

        google_event_id = cal_service.create_event(dosen, event_data)
        if google_event_id:
            session.google_event_id = google_event_id
            session.save(update_fields=['google_event_id'])
    except Exception as e:
        logger.exception('Calendar event creation (async) gagal: %s', e)
        SystemLog.objects.create(
            level=SystemLog.Level.ERROR,
            event_type='CALENDAR_ERROR',
            message=f'Gagal membuat event Calendar (async) untuk sesi #{session_id}: {e}',
            context={'session_id': session_id, 'dosen_id': dosen_id},
        )
    finally:
        close_old_connections()


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
                {'detail': 'Kuota bimbingan dosen hari ini penuh. Silakan ajukan di hari lain.'},
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

        # FR-S07 / NFR-01: create the Google Calendar event ASYNC (background thread)
        # so the approve response doesn't wait on the Google API round-trip.
        # google_event_id is filled in on the Session once the thread completes.
        student = submission.student
        symptom_names = ', '.join(s.name for s in submission.symptoms.all())
        location = meeting_link if method == 'online' else None
        event_data = {
            'title': f'Bimbingan {student.full_name} - {symptom_names or "Bimbingan Akademik"}',
            'description': (
                f'Sesi bimbingan akademik.\n'
                f'Mahasiswa: {student.full_name} ({student.nim or "-"})\n'
                f'Dosen: {dosen.full_name}\n'
                f'Gejala: {symptom_names or "-"}\n'
                f'Metode: {"Online" if method == "online" else "Tatap Muka"}'
                + (f'\nLink: {meeting_link}' if meeting_link else '')
            ),
            'start_time': scheduled_at,
            'end_time': end_time,
            'attendee_emails': [dosen.email, student.email],
            'location': location,
        }
        threading.Thread(
            target=_create_calendar_event_async,
            args=(dosen.id, session.id, event_data),
            daemon=True,
        ).start()

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
        waiting = Session.objects.filter(
            submission__student__adviser=dosen,
            status=Session.Status.WAITING,
        ).select_related(
            'submission__student',
        ).prefetch_related(
            'submission__symptoms',
        ).order_by('scheduled_at')

        total_waiting = waiting.count()
        total_minutes = sum(s.estimated_minutes for s in waiting)
        estimated_end_time = timezone.now() + timedelta(minutes=total_minutes)

        # SESSION-04: sesi yang sedang berlangsung, agar dosen bisa menekan "Selesai"
        # (dan indikator rekaman tetap punya konteks setelah refresh halaman).
        active = Session.objects.filter(
            submission__student__adviser=dosen,
            status=Session.Status.IN_PROGRESS,
        ).select_related('submission__student').prefetch_related(
            'submission__symptoms',
        ).order_by('-ts1').first()

        active_data = None
        if active:
            active_data = LecturerQueueItemSerializer(active).data
            active_data['ts1'] = active.ts1.isoformat() if active.ts1 else None
            active_data['consent_given'] = bool(active.consent_given_at)

        serializer = LecturerQueueItemSerializer(waiting, many=True)
        return Response({
            'totalWaiting': total_waiting,
            'estimatedEndTime': estimated_end_time.isoformat(),
            'queue': serializer.data,
            'activeSession': active_data,
        })


# ── Phase 6 (partial): riwayat sesi, rekaman, ringkasan manual ─────────────────
# STT/LLM otomatis belum dibangun — dosen mengisi/menyetujui ringkasan secara
# manual (fallback resmi di spec STT-05 selama pipeline otomatis belum ada).

def _can_view_session(session, user):
    student = session.submission.student
    adviser = student.adviser
    is_owner = user == student
    is_adviser = adviser is not None and user == adviser
    is_admin_or_kajur = user.role in ('admin', 'ketua_jurusan')
    return is_owner or is_adviser or is_admin_or_kajur


class LecturerSessionHistoryView(APIView):
    """GET /api/queue/lecturer/history/ — dosen lihat daftar sesi selesai miliknya."""
    permission_classes = [IsLecturer]

    def get(self, request):
        sessions = Session.objects.filter(
            submission__student__adviser=request.user,
            status=Session.Status.DONE,
        ).select_related('submission__student', 'recording').order_by('-ts2')[:50]
        serializer = SessionHistorySerializer(sessions, many=True)
        return Response(serializer.data)


class StudentSessionHistoryView(APIView):
    """GET /api/queue/my/history/ — mahasiswa lihat daftar sesi selesai miliknya."""
    permission_classes = [IsStudent]

    def get(self, request):
        sessions = Session.objects.filter(
            submission__student=request.user,
            status=Session.Status.DONE,
        ).select_related('submission__student__adviser', 'recording').order_by('-ts2')[:50]
        serializer = SessionHistorySerializer(sessions, many=True)
        return Response(serializer.data)


class SessionRecordingFileView(APIView):
    """GET /api/queue/<id>/recording/ — serve rekaman audio (auth-gated, pola D-29)."""
    permission_classes = [_permissions.IsAuthenticated]

    def get(self, request, pk):
        try:
            session = Session.objects.select_related(
                'submission__student__adviser', 'recording'
            ).get(pk=pk)
        except Session.DoesNotExist:
            return Response({'detail': 'Sesi tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        if not _can_view_session(session, request.user):
            return Response({'detail': 'Anda tidak memiliki izin.'}, status=status.HTTP_403_FORBIDDEN)

        recording = getattr(session, 'recording', None)
        if recording is None:
            return Response({'detail': 'Sesi ini tidak memiliki rekaman.'}, status=status.HTTP_404_NOT_FOUND)

        import os
        from django.http import FileResponse, Http404
        if not os.path.exists(recording.file_path):
            raise Http404

        response = FileResponse(open(recording.file_path, 'rb'), content_type=recording.mime_type)
        response['Content-Disposition'] = f'inline; filename="{recording.original_filename}"'
        return response


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
            # PKCE: google-auth-oauthlib autogenerates a code_verifier whose hash
            # is sent to Google; the callback builds a fresh Flow, so the verifier
            # must survive the redirect via the session or fetch_token() fails
            # with "invalid_grant: Missing code verifier".
            request.session['oauth_code_verifier'] = flow.code_verifier

            return django_redirect(authorization_url)
        except Exception as e:
            logger.exception('CalendarAuthView error: %s', e)
            return Response(
                {'detail': 'Gagal membuat URL autentikasi Google.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CalendarCallbackView(APIView):
    """GET /api/calendar/callback/ — terima code dari Google, simpan token.

    Google redirects the browser here directly (top-level navigation), so every
    outcome sends the browser back to the frontend settings page with a query
    flag rather than rendering a raw JSON/DRF page.
    """
    permission_classes = [IsLecturer]

    def _redirect_to_frontend(self, connected: bool, reason: str = ''):
        from django.shortcuts import redirect as django_redirect
        from urllib.parse import urlencode

        params = {'calendar': 'connected' if connected else 'error'}
        if reason:
            params['reason'] = reason
        return django_redirect(f'{settings.FRONTEND_URL}/dosen/pengaturan?{urlencode(params)}')

    def get(self, request):
        if not getattr(settings, 'GOOGLE_CALENDAR_ENABLED', False):
            return self._redirect_to_frontend(False, 'disabled')

        code = request.GET.get('code')
        state = request.GET.get('state')
        stored_state = request.session.get('oauth_state')

        if not code or state != stored_state:
            return self._redirect_to_frontend(False, 'invalid_state')

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
            flow.code_verifier = request.session.get('oauth_code_verifier')
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
            request.session.pop('oauth_code_verifier', None)

            return self._redirect_to_frontend(True)
        except Exception as e:
            logger.exception('CalendarCallbackView error: %s', e)
            return self._redirect_to_frontend(False, 'save_failed')


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
    """
    POST /api/queue/<id>/start/ — Dosen mulai sesi (set ts1, status → IN_PROGRESS).

    FR-M04: body opsional {consent_by_dosen: bool, consent_by_mahasiswa: bool}.
    Jika kedua nilai True, consent_given_at dicatat. Jika tidak dikirim / salah satu
    False, sesi tetap dimulai tanpa rekaman ("Lanjut Tanpa Rekaman").
    """
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

        consent_by_dosen = bool(request.data.get('consent_by_dosen', False))
        consent_by_mahasiswa = bool(request.data.get('consent_by_mahasiswa', False))

        session.status = Session.Status.IN_PROGRESS
        session.ts1 = timezone.now()
        session.consent_by_dosen = consent_by_dosen
        session.consent_by_mahasiswa = consent_by_mahasiswa
        session.consent_given_at = (
            timezone.now() if consent_by_dosen and consent_by_mahasiswa else None
        )
        session.save(update_fields=[
            'status', 'ts1', 'consent_by_dosen', 'consent_by_mahasiswa',
            'consent_given_at', 'updated_at',
        ])

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
            context={
                'session_id': session.id,
                'consent_recorded': bool(session.consent_given_at),
            },
        )
        return Response({
            'message': 'Sesi berhasil dimulai.',
            'ts1': session.ts1.isoformat(),
            'consent_given_at': session.consent_given_at.isoformat() if session.consent_given_at else None,
        })


# ── Selesai ────────────────────────────────────────────────────────────────────

# Magic bytes untuk format audio yang didukung MediaRecorder browser:
# WebM/Matroska (EBML), Ogg, dan MP4 (Safari — 'ftyp' di offset 4).
def _is_valid_audio_head(head: bytes) -> bool:
    if head.startswith(b'\x1a\x45\xdf\xa3'):  # EBML → audio/webm
        return True
    if head.startswith(b'OggS'):  # audio/ogg
        return True
    if len(head) >= 12 and head[4:8] == b'ftyp':  # MP4 container
        return True
    return False


_AUDIO_EXTENSIONS = {
    'audio/webm': 'webm',
    'video/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/mp4': 'mp4',
    'video/mp4': 'mp4',
}


class CompleteSessionView(APIView):
    """
    POST /api/queue/<id>/complete/ — Dosen menyelesaikan sesi (SESSION-04).

    Set ts2 + status → DONE. Body multipart/form-data (atau JSON tanpa audio):
      notes  — opsional, catatan hasil manual
      audio  — opsional, file rekaman dari MediaRecorder; HANYA diterima jika
               consent kedua pihak tercatat (consent_given_at terisi).
    """
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

        if session.status != Session.Status.IN_PROGRESS:
            return Response(
                {'detail': 'Hanya sesi yang sedang berlangsung yang dapat diselesaikan.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        audio = request.FILES.get('audio')
        if audio is not None:
            # Consent gate server-side: tanpa consent kedua pihak, rekaman ditolak
            # meskipun klien mengirimnya (FR-M04).
            if not session.consent_given_at:
                return Response(
                    {'detail': 'Rekaman ditolak: consent kedua pihak tidak tercatat untuk sesi ini.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            max_size = getattr(settings, 'RECORDING_MAX_UPLOAD_SIZE', 100 * 1024 * 1024)
            if audio.size > max_size:
                return Response(
                    {'detail': f'Ukuran rekaman melebihi batas {max_size // (1024 * 1024)}MB.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            head = audio.read(16)
            audio.seek(0)
            if not _is_valid_audio_head(head):
                return Response(
                    {'detail': 'Format rekaman tidak dikenali. Hanya WebM/Ogg/MP4 yang didukung.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        notes = (request.data.get('notes') or '').strip()

        session.status = Session.Status.DONE
        session.ts2 = timezone.now()
        session.result_notes = notes
        session.save(update_fields=['status', 'ts2', 'result_notes', 'updated_at'])

        recording = None
        if audio is not None:
            # Durasi opsional dari klien (MediaRecorder); STT bisa menimpanya nanti.
            try:
                duration = float(request.data.get('duration_seconds'))
            except (TypeError, ValueError):
                duration = None
            recording = self._save_recording(session, audio, duration_seconds=duration)

        # Phase 6: setiap sesi selesai punya satu SessionLogbook. Bila STT_LLM_ENABLED
        # aktif & ada rekaman, pipeline STT->LLM dijalankan (status → transcribing);
        # selain itu logbook tetap pending untuk diisi dosen via jalur manual (STT-07).
        from apps.logbook.models import SessionLogbook
        from apps.logbook.tasks import dispatch_pipeline
        logbook, _created = SessionLogbook.objects.get_or_create(
            session=session,
            defaults={
                'status': SessionLogbook.Status.PENDING,
                'source_mode': session.method or SessionLogbook.SourceMode.OFFLINE,
                'summary_edited': {'manual_notes': notes} if notes else None,
            },
        )
        if recording is not None:
            try:
                dispatch_pipeline(logbook)
            except Exception:
                logger.exception('Gagal memulai pipeline STT/LLM untuk logbook #%s', logbook.id)

        notify_student(
            session.submission.student,
            f'Sesi bimbingan dengan {request.user.full_name} telah selesai. Terima kasih!',
            session=session,
            event_type='SESSION_COMPLETED',
        )

        SystemLog.objects.create(
            level=SystemLog.Level.INFO,
            event_type='SESSION_COMPLETED',
            message=f'Sesi #{session.id} diselesaikan oleh {request.user.email}',
            context={
                'session_id': session.id,
                'has_recording': recording is not None,
                'has_notes': bool(notes),
            },
        )

        return Response({
            'message': 'Sesi berhasil diselesaikan.',
            'ts2': session.ts2.isoformat(),
            'has_recording': recording is not None,
        })

    def _save_recording(self, session, audio, duration_seconds=None):
        """Simpan file audio ke MEDIA_ROOT/recordings/<uuid>.<ext> (pola SubmissionFile)."""
        import os
        import uuid as _uuid

        content_type = (audio.content_type or '').split(';')[0].strip().lower()
        ext = _AUDIO_EXTENSIONS.get(content_type, 'webm')

        file_uuid = _uuid.uuid4()
        recordings_dir = os.path.join(settings.MEDIA_ROOT, 'recordings')
        os.makedirs(recordings_dir, exist_ok=True)
        file_path = os.path.join(recordings_dir, f'{file_uuid}.{ext}')

        audio.seek(0)
        with open(file_path, 'wb+') as destination:
            for chunk in audio.chunks():
                destination.write(chunk)

        return SessionRecording.objects.create(
            session=session,
            uuid=file_uuid,
            original_filename=audio.name or f'session_{session.id}.{ext}',
            file_path=file_path,
            file_size=audio.size,
            mime_type=content_type or 'audio/webm',
            duration_seconds=duration_seconds,
        )


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

        # FR-AD02: dosen list + their active session count, for the Emergency Cancel dropdown
        lecturers = []
        for dosen in CustomUser.objects.filter(role='lecturer', is_approved=True).order_by('full_name'):
            active_count = Session.objects.filter(
                submission__student__adviser=dosen,
                status__in=[Session.Status.WAITING, Session.Status.IN_PROGRESS],
            ).count()
            lecturers.append({
                'id': dosen.id,
                'full_name': dosen.full_name,
                'active_sessions': active_count,
            })

        return Response({
            'total_students': CustomUser.objects.filter(role='student', is_approved=True).count(),
            'total_lecturers': CustomUser.objects.filter(role='lecturer', is_approved=True).count(),
            'total_pending_users': CustomUser.objects.filter(is_approved=False).count(),
            'active_sessions_today': Session.objects.filter(
                status__in=[Session.Status.WAITING, Session.Status.IN_PROGRESS],
            ).count(),
            'recent_errors': recent_errors,
            'lecturers': lecturers,
            'integrations': {
                'google_calendar': {
                    'enabled': getattr(settings, 'GOOGLE_CALENDAR_ENABLED', False),
                    'connected_dosens': DosenCalendarToken.objects.count(),
                },
                'logbook': {'enabled': False},
            },
        })


class AdminEmergencyCancelView(APIView):
    """
    POST /api/admin/emergency-cancel/ — batalkan semua sesi aktif satu dosen (FR-AD02).
    Body: {"dosen_id": ..., "alasan": "..."} — alasan wajib, minimal 10 karakter.
    """

    def get_permissions(self):
        from apps.accounts.permissions import IsAdmin
        return [IsAdmin()]

    def post(self, request):
        from apps.accounts.models import CustomUser
        dosen_id = request.data.get('dosen_id')
        if not dosen_id:
            return Response({'detail': 'dosen_id wajib diisi.'}, status=status.HTTP_400_BAD_REQUEST)

        alasan = (request.data.get('alasan') or '').strip()
        if len(alasan) < 10:
            return Response(
                {'detail': 'Alasan wajib diisi (minimal 10 karakter).'},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
                f'Sesi bimbingan dibatalkan oleh admin. Alasan: {alasan}',
                session=session,
                event_type='EMERGENCY_CANCEL',
            )
            cancelled += 1

        notify_lecturer(
            dosen,
            f'Admin membatalkan {cancelled} sesi bimbingan Anda. Alasan: {alasan}',
            event_type='EMERGENCY_CANCEL',
        )

        SystemLog.objects.create(
            level=SystemLog.Level.WARNING,
            event_type='EMERGENCY_CANCEL',
            message=f'Admin {request.user.email} membatalkan {cancelled} sesi dosen {dosen.email}. Alasan: {alasan}',
            context={'dosen_id': dosen.id, 'cancelled': cancelled, 'alasan': alasan},
        )
        return Response({
            'message': 'Emergency cancel berhasil',
            'dosen_name': dosen.full_name,
            'sessions_cancelled': cancelled,
            'alasan': alasan,
        })


# ── Admin logs (FR-AD03) ─────────────────────────────────────────────────────────

class AdminLogsView(APIView):
    """GET /api/admin/logs/?type=&limit=50&page=1 — daftar SystemLog berpaginasi."""

    def get_permissions(self):
        from apps.accounts.permissions import IsAdmin
        return [IsAdmin()]

    def get(self, request):
        qs = SystemLog.objects.all()

        log_type = request.query_params.get('type')
        if log_type:
            qs = qs.filter(event_type__iexact=log_type)

        try:
            limit = max(1, min(int(request.query_params.get('limit', 50)), 200))
        except ValueError:
            limit = 50
        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except ValueError:
            page = 1

        total = qs.count()
        offset = (page - 1) * limit
        page_items = qs.order_by('-created_at')[offset:offset + limit]

        logs = [
            {
                'id': log.id,
                'type': log.event_type or log.level,
                'level': log.level,
                'message': log.message,
                'created_at': log.created_at.isoformat(),
            }
            for log in page_items
        ]

        return Response({'total': total, 'page': page, 'limit': limit, 'logs': logs})


class AdminLogsCleanupView(APIView):
    """POST /api/admin/logs/cleanup/ — hapus SystemLog yang lebih tua dari 30 hari."""

    def get_permissions(self):
        from apps.accounts.permissions import IsAdmin
        return [IsAdmin()]

    def post(self, request):
        from datetime import timedelta as td
        cutoff = timezone.now() - td(days=30)
        deleted, _ = SystemLog.objects.filter(created_at__lt=cutoff).delete()
        return Response({'deleted': deleted})


class KetuaJurusanStatsView(APIView):
    """GET /api/ketua-jurusan/stats/?period=weekly|monthly|semester — statistik ketua jurusan (FR-KP01/02)."""

    permission_classes = [IsKetuaJurusanOrAdmin]

    def get(self, request):
        from apps.accounts.models import CustomUser

        now = timezone.now()
        period = request.query_params.get('period', 'monthly')
        if period not in ('weekly', 'monthly', 'semester'):
            period = 'monthly'
        since = _period_start(period, now)

        sessions_period = Session.objects.filter(created_at__gte=since)
        total_sesi = sessions_period.count()
        sesi_selesai = sessions_period.filter(status=Session.Status.DONE).count()
        sesi_dibatalkan = sessions_period.filter(status=Session.Status.CANCELLED).count()

        # Rata-rata waktu tunggu = rata-rata estimated_minutes sesi yang sudah selesai
        done = sessions_period.filter(status=Session.Status.DONE)
        waits = [s.estimated_minutes for s in done if s.estimated_minutes]
        rata_rata_waktu_tunggu = round(sum(waits) / len(waits)) if waits else 0

        # Beban per dosen dalam periode ini
        lecturers = CustomUser.objects.filter(role='lecturer', is_approved=True)
        beban_per_dosen = []
        for dosen in lecturers:
            s = sessions_period.filter(submission__student__adviser=dosen)
            total = s.count()
            if total == 0:
                continue
            mins = [x.estimated_minutes for x in s if x.estimated_minutes]
            total_durasi = sum(mins)
            beban_per_dosen.append({
                'dosen_id': dosen.id,
                'dosen_name': dosen.full_name,
                'total_sesi': total,
                'total_durasi_menit': total_durasi,
                'rata_rata_durasi': round(total_durasi / len(mins)) if mins else 0,
                'kuota_harian_menit': DOSEN_DAILY_QUOTA_MINUTES,
            })
        beban_per_dosen.sort(key=lambda x: x['total_sesi'], reverse=True)

        return Response({
            'period': period,
            'period_label': _PERIOD_LABELS.get(period, period),
            'total_sesi': total_sesi,
            'rata_rata_waktu_tunggu': rata_rata_waktu_tunggu,
            'sesi_selesai': sesi_selesai,
            'sesi_dibatalkan': sesi_dibatalkan,
            'beban_per_dosen': beban_per_dosen,
        })


class KetuaJurusanExportView(APIView):
    """GET /api/ketua-jurusan/export/?format=csv|pdf&period=weekly|monthly|semester — FR-KP03."""

    permission_classes = [IsKetuaJurusanOrAdmin]

    def perform_content_negotiation(self, request, force=False):
        """
        This view's `?format=csv|pdf` is a domain query param (export format), not
        DRF's reserved URL_FORMAT_OVERRIDE renderer-selection param — the two share
        the same name and DRF's default negotiation would 404 on 'csv'/'pdf' since
        neither matches a registered renderer. Force JSON negotiation so DRF never
        inspects `format`; success responses bypass renderers entirely (raw HttpResponse).
        """
        from rest_framework.renderers import JSONRenderer
        return (JSONRenderer(), 'application/json')

    def get(self, request):
        now = timezone.now()
        period = request.query_params.get('period', 'monthly')
        if period not in ('weekly', 'monthly', 'semester'):
            period = 'monthly'
        since = _period_start(period, now)
        export_format = (request.query_params.get('format') or 'csv').lower()

        sessions = Session.objects.filter(
            created_at__gte=since,
        ).select_related(
            'submission__student', 'submission__student__adviser',
        ).prefetch_related('submission__symptoms').order_by('-created_at')

        period_label = _PERIOD_LABELS.get(period, period).replace(' ', '')
        filename_base = f'Logbook_{period_label}'

        rows = []
        for s in sessions:
            topik = ', '.join(sym.name for sym in s.submission.symptoms.all()) or '-'
            rows.append([
                s.submission.student.nim or '-',
                s.submission.student.full_name,
                s.submission.student.adviser.full_name if s.submission.student.adviser else '-',
                s.scheduled_at.strftime('%Y-%m-%d') if s.scheduled_at else s.created_at.strftime('%Y-%m-%d'),
                topik,
                s.estimated_minutes,
                s.get_status_display(),
                s.submission.description or '-',
            ])

        columns = ['NIM', 'Nama Mahasiswa', 'Nama Dosen', 'Tanggal', 'Topik',
                   'Durasi (menit)', 'Status', 'Ringkasan']

        if export_format == 'pdf':
            return self._render_pdf(columns, rows, filename_base, period)
        return self._render_csv(columns, rows, filename_base)

    def _render_csv(self, columns, rows, filename_base):
        import csv
        from django.http import HttpResponse

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename_base}.csv"'
        response.write('﻿')  # UTF-8 BOM for Excel

        writer = csv.writer(response)
        writer.writerow(columns)
        writer.writerows(rows)
        return response

    def _render_pdf(self, columns, rows, filename_base, period):
        from django.http import HttpResponse

        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import landscape, A4
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
            from reportlab.lib.styles import getSampleStyleSheet
            import io

            buf = io.BytesIO()
            doc = SimpleDocTemplate(buf, pagesize=landscape(A4))
            styles = getSampleStyleSheet()
            title = Paragraph(f'Logbook Bimbingan — {_PERIOD_LABELS.get(period, period)}', styles['Title'])

            table_data = [columns] + [[str(c) for c in row] for row in rows]
            table = Table(table_data, repeatRows=1)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1D4ED8')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F3F4F6')]),
            ]))

            doc.build([title, table])
            pdf_bytes = buf.getvalue()
            buf.close()

            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename_base}.pdf"'
            return response
        except Exception as e:
            logger.exception('Gagal membuat PDF logbook: %s', e)
            SystemLog.objects.create(
                level=SystemLog.Level.ERROR,
                event_type='LOGBOOK_SYNC_ERROR',
                message=f'Gagal membuat ekspor PDF logbook: {e}',
                context={},
            )
            return Response(
                {'detail': 'Gagal membuat ekspor PDF. Coba gunakan format CSV.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class KetuaJurusanComplianceView(APIView):
    """
    GET /api/ketua-jurusan/compliance/?period=weekly|monthly|semester — FR-KP04.
    Rekap kepatuhan tindak lanjut saran (ActionItem) per dosen dan per mahasiswa.
    """

    permission_classes = [IsKetuaJurusanOrAdmin]

    def get(self, request):
        now = timezone.now()
        period = request.query_params.get('period', 'monthly')
        if period not in ('weekly', 'monthly', 'semester'):
            period = 'monthly'
        since = _period_start(period, now)

        items = ActionItem.objects.filter(created_at__gte=since).select_related(
            'session__submission__student', 'session__submission__student__adviser',
        )

        total = items.count()
        completed = items.filter(is_completed=True).count()
        compliance_rate = round(completed / total * 100) if total else 0

        per_dosen_map = {}
        per_mahasiswa_map = {}

        for item in items:
            student = item.session.submission.student
            dosen = student.adviser

            m_key = student.id
            if m_key not in per_mahasiswa_map:
                per_mahasiswa_map[m_key] = {
                    'nama': student.full_name, 'nim': student.nim or '-',
                    'total_saran': 0, 'saran_selesai': 0,
                }
            per_mahasiswa_map[m_key]['total_saran'] += 1
            if item.is_completed:
                per_mahasiswa_map[m_key]['saran_selesai'] += 1

            if dosen:
                d_key = dosen.id
                if d_key not in per_dosen_map:
                    per_dosen_map[d_key] = {
                        'dosen_name': dosen.full_name,
                        'total_saran': 0, 'saran_selesai': 0,
                    }
                per_dosen_map[d_key]['total_saran'] += 1
                if item.is_completed:
                    per_dosen_map[d_key]['saran_selesai'] += 1

        per_mahasiswa = []
        for row in per_mahasiswa_map.values():
            rate = round(row['saran_selesai'] / row['total_saran'] * 100) if row['total_saran'] else 0
            per_mahasiswa.append({**row, 'compliance_rate': rate})
        per_mahasiswa.sort(key=lambda x: x['compliance_rate'])

        per_dosen = []
        for row in per_dosen_map.values():
            rate = round(row['saran_selesai'] / row['total_saran'] * 100) if row['total_saran'] else 0
            per_dosen.append({**row, 'compliance_rate': rate})
        per_dosen.sort(key=lambda x: x['compliance_rate'])

        return Response({
            'period': period,
            'period_label': _PERIOD_LABELS.get(period, period),
            'compliance_rate': compliance_rate,
            'per_dosen': per_dosen,
            'per_mahasiswa': per_mahasiswa,
        })


# ── Action items / saran bimbingan (backs FR-KP04) ────────────────────────────

class SessionActionItemsView(APIView):
    """
    GET  /api/queue/<session_id>/action-items/ — daftar saran untuk sesi ini.
    POST /api/queue/<session_id>/action-items/ — dosen menambah saran (body: {description}).
    """
    permission_classes = [_permissions.IsAuthenticated]

    def _get_session(self, request, session_id):
        try:
            session = Session.objects.select_related(
                'submission__student__adviser'
            ).get(pk=session_id)
        except Session.DoesNotExist:
            return None, Response({'detail': 'Sesi tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        is_owner_student = user == session.submission.student
        is_owner_dosen = user == session.submission.student.adviser
        if not (is_owner_student or is_owner_dosen):
            return None, Response({'detail': 'Anda tidak memiliki izin.'}, status=status.HTTP_403_FORBIDDEN)
        return session, None

    def get(self, request, session_id):
        session, err = self._get_session(request, session_id)
        if err:
            return err
        items = session.action_items.all()
        return Response([
            {
                'id': i.id, 'description': i.description, 'is_completed': i.is_completed,
                'created_at': i.created_at.isoformat(),
                'completed_at': i.completed_at.isoformat() if i.completed_at else None,
            }
            for i in items
        ])

    def post(self, request, session_id):
        session, err = self._get_session(request, session_id)
        if err:
            return err
        if request.user != session.submission.student.adviser:
            return Response({'detail': 'Hanya dosen yang dapat menambah saran.'}, status=status.HTTP_403_FORBIDDEN)

        description = (request.data.get('description') or '').strip()
        if not description:
            return Response({'detail': 'Deskripsi saran wajib diisi.'}, status=status.HTTP_400_BAD_REQUEST)

        item = ActionItem.objects.create(session=session, description=description)
        return Response(
            {'id': item.id, 'description': item.description, 'is_completed': False,
             'created_at': item.created_at.isoformat()},
            status=status.HTTP_201_CREATED,
        )


class CompleteActionItemView(APIView):
    """POST /api/action-items/<id>/complete/ — mahasiswa menandai saran sebagai selesai."""
    permission_classes = [IsStudent]

    def post(self, request, pk):
        try:
            item = ActionItem.objects.select_related(
                'session__submission__student'
            ).get(pk=pk)
        except ActionItem.DoesNotExist:
            return Response({'detail': 'Saran tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        if item.session.submission.student != request.user:
            return Response({'detail': 'Anda tidak memiliki izin.'}, status=status.HTTP_403_FORBIDDEN)

        item.is_completed = True
        item.completed_at = timezone.now()
        item.save(update_fields=['is_completed', 'completed_at'])
        return Response({'id': item.id, 'is_completed': True, 'completed_at': item.completed_at.isoformat()})
