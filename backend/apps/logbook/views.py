"""
Views for Phase 6 (06-04) — lecturer list/detail/approve/manual-notes and the
student read-only logbook endpoint. Mirrors the 404 -> 403 -> 400 ownership +
state-guard sequence established by apps.bimbingan.views.CompleteSessionView.
"""
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsLecturer, IsStudent
from apps.bimbingan.models import SystemLog

from .models import SessionLogbook
from .serializers import (
    ApproveLogbookSerializer,
    LogbookDetailSerializer,
    LogbookListSerializer,
    ManualNotesSerializer,
)


class LecturerLogbookListView(APIView):
    permission_classes = [IsLecturer]

    def get(self, request):
        logbooks = SessionLogbook.objects.filter(
            session__submission__student__adviser=request.user,
        ).select_related(
            'session', 'session__submission__student',
        ).order_by('-created_at')
        return Response(LogbookListSerializer(logbooks, many=True).data)


class LecturerLogbookDetailView(APIView):
    permission_classes = [IsLecturer]

    def get(self, request, session_id):
        try:
            logbook = SessionLogbook.objects.select_related(
                'session__submission__student__adviser',
            ).get(session_id=session_id)
        except SessionLogbook.DoesNotExist:
            return Response({'detail': 'Logbook tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        if logbook.session.submission.student.adviser != request.user:
            return Response({'detail': 'Anda tidak memiliki izin.'}, status=status.HTTP_403_FORBIDDEN)

        return Response(LogbookDetailSerializer(logbook).data)


class ApproveLogbookView(APIView):
    permission_classes = [IsLecturer]

    def post(self, request, session_id):
        try:
            logbook = SessionLogbook.objects.select_related(
                'session__submission__student__adviser',
            ).get(session_id=session_id)
        except SessionLogbook.DoesNotExist:
            return Response({'detail': 'Logbook tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        if logbook.session.submission.student.adviser != request.user:
            return Response({'detail': 'Anda tidak memiliki izin.'}, status=status.HTTP_403_FORBIDDEN)

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
        logbook.save(update_fields=['summary_edited', 'status', 'approved_at', 'approved_by', 'updated_at'])

        SystemLog.objects.create(
            level=SystemLog.Level.INFO,
            event_type='LOGBOOK_APPROVED',
            message=f'Logbook sesi #{logbook.session_id} disetujui oleh {request.user.email}',
            context={'session_id': logbook.session_id, 'logbook_id': logbook.id},
        )

        return Response(LogbookDetailSerializer(logbook).data)


class ManualNotesView(APIView):
    permission_classes = [IsLecturer]

    def post(self, request, session_id):
        try:
            logbook = SessionLogbook.objects.select_related(
                'session__submission__student__adviser',
            ).get(session_id=session_id)
        except SessionLogbook.DoesNotExist:
            return Response({'detail': 'Logbook tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        if logbook.session.submission.student.adviser != request.user:
            return Response({'detail': 'Anda tidak memiliki izin.'}, status=status.HTTP_403_FORBIDDEN)

        if logbook.status != SessionLogbook.Status.FAILED:
            return Response(
                {'detail': 'Catatan manual hanya dapat diisi untuk logbook berstatus "Gagal".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ManualNotesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        logbook.summary_edited = {'manual_notes': serializer.validated_data['notes']}
        logbook.is_manual = True
        logbook.status = SessionLogbook.Status.APPROVED
        logbook.approved_at = timezone.now()
        logbook.approved_by = request.user
        logbook.save(update_fields=[
            'summary_edited', 'is_manual', 'status', 'approved_at', 'approved_by', 'updated_at',
        ])

        SystemLog.objects.create(
            level=SystemLog.Level.INFO,
            event_type='LOGBOOK_MANUAL',
            message=f'Catatan manual logbook sesi #{logbook.session_id} disimpan oleh {request.user.email}',
            context={'session_id': logbook.session_id, 'logbook_id': logbook.id},
        )

        return Response(LogbookDetailSerializer(logbook).data)


class StudentLogbookView(APIView):
    permission_classes = [IsStudent]

    def get(self, request, session_id):
        try:
            logbook = SessionLogbook.objects.select_related(
                'session__submission__student',
            ).get(session_id=session_id)
        except SessionLogbook.DoesNotExist:
            return Response({'detail': 'Logbook tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        if logbook.session.submission.student != request.user:
            return Response({'detail': 'Logbook tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        if logbook.status != SessionLogbook.Status.APPROVED:
            return Response(
                {'detail': 'Logbook belum disetujui dosen.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        return Response(LogbookDetailSerializer(logbook).data)
