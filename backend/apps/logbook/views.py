"""
Phase 6 (06-04): DRF views over SessionLogbook.

Menggantikan SessionSummaryView di apps/bimbingan/views.py. Menerapkan disiplin
akses proyek yang sama: urutan 404 -> 403 -> 400, ownership via
session.submission.student.adviser, dan state-guard di server (jangan percaya klien).
"""
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsLecturer, IsStudent
from apps.bimbingan.models import SystemLog
from apps.bimbingan.services.notification import notify_student

from .models import SessionLogbook
from .serializers import (
    ApproveLogbookSerializer,
    LogbookDetailSerializer,
    LogbookListSerializer,
    ManualNotesSerializer,
    StudentLogbookDetailSerializer,
)


def _get_logbook_or_404(session_id):
    return (
        SessionLogbook.objects
        .select_related('session__submission__student__adviser', 'session__recording')
        .filter(session_id=session_id)
        .first()
    )


class LecturerLogbookListView(APIView):
    """GET /api/logbook/lecturer/ — daftar logbook mahasiswa bimbingan (advisee-scoped)."""
    permission_classes = [IsLecturer]

    def get(self, request):
        qs = (
            SessionLogbook.objects
            .filter(session__submission__student__adviser=request.user)
            .select_related('session__submission__student__adviser')
            .order_by('-created_at')
        )
        return Response(LogbookListSerializer(qs, many=True).data)


class LecturerLogbookDetailView(APIView):
    """GET /api/logbook/<session_id>/ — detail 1 logbook milik dosen pembimbing."""
    permission_classes = [IsLecturer]

    def get(self, request, session_id):
        logbook = _get_logbook_or_404(session_id)
        if logbook is None:
            return Response({'detail': 'Logbook tidak ditemukan.'},
                            status=status.HTTP_404_NOT_FOUND)
        if logbook.session.submission.student.adviser != request.user:
            return Response({'detail': 'Anda tidak memiliki izin.'},
                            status=status.HTTP_403_FORBIDDEN)
        return Response(LogbookDetailSerializer(logbook).data)


class ApproveLogbookView(APIView):
    """POST /api/logbook/<session_id>/approve/ — simpan ringkasan editan + setujui."""
    permission_classes = [IsLecturer]

    def post(self, request, session_id):
        logbook = _get_logbook_or_404(session_id)
        if logbook is None:
            return Response({'detail': 'Logbook tidak ditemukan.'},
                            status=status.HTTP_404_NOT_FOUND)
        if logbook.session.submission.student.adviser != request.user:
            return Response({'detail': 'Hanya dosen pembimbing yang dapat menyetujui.'},
                            status=status.HTTP_403_FORBIDDEN)
        if logbook.status != SessionLogbook.Status.READY_FOR_REVIEW:
            return Response(
                {'detail': 'Hanya logbook berstatus "Menunggu Tinjauan" yang dapat disetujui.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ApproveLogbookSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        logbook.summary_edited = serializer.validated_data['summary_edited']
        logbook.status = SessionLogbook.Status.APPROVED
        logbook.approved_at = timezone.now()
        logbook.approved_by = request.user
        logbook.save(update_fields=[
            'summary_edited', 'status', 'approved_at', 'approved_by', 'updated_at'])

        notify_student(
            logbook.session.submission.student,
            'Ringkasan hasil bimbingan Anda sudah tersedia.',
            session=logbook.session,
            event_type='SUMMARY_APPROVED',
        )
        return Response(LogbookDetailSerializer(logbook).data)


class RejectLogbookView(APIView):
    """POST /api/logbook/<session_id>/reject/ — tolak draf AI, alihkan ke jalur manual.

    Gate tambahan (STT-04): dosen bisa menolak ringkasan AI yang meragukan alih-alih
    dipaksa menyetujuinya. Menandai FAILED sehingga ManualNotesView menerimanya
    seperti pipeline yang gagal — tidak ada field/status baru yang perlu ditambahkan.
    """
    permission_classes = [IsLecturer]

    def post(self, request, session_id):
        logbook = _get_logbook_or_404(session_id)
        if logbook is None:
            return Response({'detail': 'Logbook tidak ditemukan.'},
                            status=status.HTTP_404_NOT_FOUND)
        if logbook.session.submission.student.adviser != request.user:
            return Response({'detail': 'Hanya dosen pembimbing yang dapat menolak.'},
                            status=status.HTTP_403_FORBIDDEN)
        if logbook.status != SessionLogbook.Status.READY_FOR_REVIEW:
            return Response(
                {'detail': 'Hanya logbook berstatus "Menunggu Tinjauan" yang dapat ditolak.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        logbook.status = SessionLogbook.Status.FAILED
        logbook.save(update_fields=['status', 'updated_at'])

        SystemLog.objects.create(
            level=SystemLog.Level.INFO,
            event_type='LOGBOOK_REJECTED',
            message=f'Dosen {request.user.email} menolak draf ringkasan AI logbook #{logbook.id}',
            context={'logbook_id': logbook.id, 'session_id': session_id},
        )
        return Response(LogbookDetailSerializer(logbook).data)


class ManualNotesView(APIView):
    """POST /api/logbook/<session_id>/manual-notes/ — fallback manual (STT-07)."""
    permission_classes = [IsLecturer]

    def post(self, request, session_id):
        logbook = _get_logbook_or_404(session_id)
        if logbook is None:
            return Response({'detail': 'Logbook tidak ditemukan.'},
                            status=status.HTTP_404_NOT_FOUND)
        if logbook.session.submission.student.adviser != request.user:
            return Response({'detail': 'Hanya dosen pembimbing yang dapat mengisi catatan.'},
                            status=status.HTTP_403_FORBIDDEN)
        # Catatan manual hanya untuk logbook yang pipeline-nya gagal / belum jalan.
        if logbook.status not in (
            SessionLogbook.Status.FAILED, SessionLogbook.Status.PENDING,
        ):
            return Response(
                {'detail': 'Catatan manual hanya untuk logbook yang gagal/menunggu.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ManualNotesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Catatan bebas disimpan sebagai bentuk terstruktur minimal agar UI seragam.
        logbook.summary_edited = {'manual_notes': serializer.validated_data['notes']}
        logbook.is_manual = True
        logbook.status = SessionLogbook.Status.APPROVED
        logbook.approved_at = timezone.now()
        logbook.approved_by = request.user
        logbook.save(update_fields=[
            'summary_edited', 'is_manual', 'status',
            'approved_at', 'approved_by', 'updated_at'])

        notify_student(
            logbook.session.submission.student,
            'Ringkasan hasil bimbingan Anda sudah tersedia.',
            session=logbook.session,
            event_type='SUMMARY_APPROVED',
        )
        return Response(LogbookDetailSerializer(logbook).data)


class StudentLogbookListView(APIView):
    """GET /api/logbook/student/ — daftar logbook milik mahasiswa yang sudah disetujui.

    Endpoint ini TIDAK ada di plan tim lain (mereka hanya punya detail mahasiswa);
    ditambahkan agar StudentHistory.tsx punya sumber daftar. (Celah D di MERGE-PLAN.)
    """
    permission_classes = [IsStudent]

    def get(self, request):
        qs = (
            SessionLogbook.objects
            .filter(session__submission__student=request.user,
                    status=SessionLogbook.Status.APPROVED)
            .select_related('session__submission__student__adviser')
            .order_by('-created_at')
        )
        return Response(LogbookListSerializer(qs, many=True).data)


class StudentLogbookView(APIView):
    """GET /api/logbook/student/<session_id>/ — hanya logbook milik sendiri & sudah approved."""
    permission_classes = [IsStudent]

    def get(self, request, session_id):
        logbook = _get_logbook_or_404(session_id)
        # Jangan bocorkan keberadaan: bukan milik sendiri -> 404.
        if logbook is None or logbook.session.submission.student != request.user:
            return Response({'detail': 'Logbook tidak ditemukan.'},
                            status=status.HTTP_404_NOT_FOUND)
        # Milik sendiri tapi belum disetujui -> 403 (konten tak pernah bocor, STT-06).
        if logbook.status != SessionLogbook.Status.APPROVED:
            return Response({'detail': 'Ringkasan belum tersedia.'},
                            status=status.HTTP_403_FORBIDDEN)
        return Response(StudentLogbookDetailSerializer(logbook).data)
