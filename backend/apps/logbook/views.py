"""
Views for Phase 6 (06-04) — lecturer list/detail and the student read-only
logbook endpoint. Mirrors the 404 -> 403 ownership sequence established by
apps.bimbingan.views.CompleteSessionView.
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsLecturer, IsStudent

from .models import SessionLogbook
from .serializers import LogbookDetailSerializer, LogbookListSerializer


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
