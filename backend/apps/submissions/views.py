"""
Submission views — Plan 04 (student) + Plan 05 (lecturer).

Views:
  SubmissionListCreateView:
    - POST /api/submissions/ — student creates a submission (IsStudent + IsApprovedUser)
    - GET  /api/submissions/ — student lists own submissions (IsStudent + IsApprovedUser)

  LecturerSubmissionListView (Plan 05 — REVIEW-01):
    - GET /api/submissions/lecturer/ — lecturer lists their advisees' submissions
    - Filtered to student__adviser == request.user (REVIEW-01 isolation, T-1-21)
    - Supports ?status= filter, ?search= (NIM/name), ?ordering= (created_at)
    - IsLecturer + IsApprovedUser permissions (T-1-22)
    - Read-only in Phase 1 — NO approve/reject actions (D-12)

  serve_submission_file:
    - GET /api/files/<uuid>/ — serves file ONLY to the owning student, their adviser, or admin/ketua_jurusan
    - Implements D-29 protected serving (RESEARCH Pattern 3)
    - Returns FileResponse inline for in-app preview (D-14)
    - NEVER uses MEDIA_URL (anti-pattern per RESEARCH / D-29)
"""
import os

from django.http import FileResponse, Http404
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters, generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsLecturer, IsStudent

from .filters import SubmissionFilter
from .models import Submission, SubmissionFile, ThesisChapter
from .serializers import (
    LecturerSubmissionSerializer,
    SubmissionCreateSerializer,
    SubmissionListSerializer,
)


class SubmissionListCreateView(APIView):
    """
    POST /api/submissions/ — create a new guidance submission (student only).
    GET  /api/submissions/ — list own submissions (student only).

    Permissions: IsStudent (implies IsApprovedUser + role=student).
    """

    def get_permissions(self):
        return [IsStudent()]

    def post(self, request):
        """
        Create a submission with symptom selection + PDF file upload.
        Uses multipart/form-data. Validates before writing file to disk.

        Note: Django's QueryDict only returns the LAST value for a repeated key
        with plain .get(). We use getlist('symptom_ids') to retrieve ALL
        symptom ids sent as repeated multipart fields.
        """
        # Build mutable data dict, extracting symptom_ids list from QueryDict.
        # QueryDict.get() only returns the LAST value for repeated keys; getlist() returns all.
        if hasattr(request.data, 'getlist'):
            symptom_ids = request.data.getlist('symptom_ids')
            data = {
                'symptom_ids': symptom_ids,
                'description': request.data.get('description', ''),
                'draft_file': request.FILES.get('draft_file'),
            }
        else:
            data = request.data

        serializer = SubmissionCreateSerializer(
            data=data,
            context={'request': request},
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        submission = serializer.save()

        # Return lightweight response with key fields for the frontend redirect
        return Response(
            {
                'id': submission.id,
                'status': submission.status,
                'file_uuid': str(submission.file.uuid),
                'created_at': submission.created_at.isoformat(),
            },
            status=status.HTTP_201_CREATED,
        )

    def get(self, request):
        """
        Return the authenticated student's own submissions ordered by -created_at.
        """
        submissions = (
            Submission.objects
            .filter(student=request.user)
            .select_related('session', 'session__logbook')
            .prefetch_related('symptoms', 'file')
            .order_by('-created_at')
        )
        serializer = SubmissionListSerializer(submissions, many=True)
        return Response(serializer.data)


# ── Lecturer Submission List (Plan 05 — REVIEW-01) ────────────────────────────

class LecturerSubmissionListView(generics.ListAPIView):
    """
    GET /api/submissions/lecturer/ — Lecturer sees ONLY their own advisees' submissions.

    REVIEW-01 isolation: get_queryset filters Submission where
    student__adviser == request.user. A lecturer can never see another lecturer's
    students' data (T-1-21).

    D-12 read-only: No approve/reject actions in Phase 1 (deferred to Phase 2).

    Filters (D-09, D-11):
      - DjangoFilterBackend + SubmissionFilter: ?status=pending|approved|rejected|revision
      - SearchFilter: ?search=<nim-or-name> matches student__nim, student__full_name
      - OrderingFilter: ?ordering=created_at (ascending); ?ordering=-created_at (descending)

    Permissions: IsLecturer (implies IsApprovedUser + role=lecturer) — T-1-22.
    """

    serializer_class = LecturerSubmissionSerializer
    permission_classes = [IsLecturer]
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = SubmissionFilter
    search_fields = ['student__nim', 'student__full_name']
    ordering_fields = ['created_at']
    ordering = ['-created_at']  # default: newest first

    def get_queryset(self):
        """
        Return submissions for students whose adviser is the requesting lecturer.

        REVIEW-01: student__adviser=self.request.user
        This is the sole queryset filter — no other lecturer's data can leak through.
        T-1-21 mitigation: queryset is scoped at ORM level, not presentation layer.
        """
        return (
            Submission.objects
            .filter(student__adviser=self.request.user)
            .select_related('student', 'file')
            .prefetch_related('symptoms')
            .order_by('-created_at')
        )


# ── Protected File Serving (D-29) ──────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def serve_submission_file(request, file_uuid):
    """
    Serve an uploaded PDF file ONLY to authorised users.

    Access allowed if:
      - request.user == submission.student (the owner)
      - request.user == submission.student.adviser (the assigned lecturer)
      - request.user.role in ('admin', 'ketua_jurusan')

    Returns FileResponse with Content-Disposition: inline (for in-app preview, D-14).
    Does NOT use MEDIA_URL — files are not publicly accessible (D-29 / T-1-15).
    """
    try:
        submission_file = (
            SubmissionFile.objects
            .select_related('submission__student__adviser')
            .get(uuid=file_uuid)
        )
    except SubmissionFile.DoesNotExist:
        raise Http404

    user = request.user
    submission = submission_file.submission
    student = submission.student

    # Access control: owner OR adviser OR admin/ketua_jurusan (T-1-15, T-1-18)
    is_owner = (user == student)
    is_adviser = (student.adviser is not None and user == student.adviser)
    is_admin_or_ketua_jurusan = user.role in ('admin', 'ketua_jurusan')

    if not (is_owner or is_adviser or is_admin_or_ketua_jurusan):
        raise PermissionDenied

    file_path = submission_file.file_path
    if not os.path.exists(file_path):
        raise Http404

    response = FileResponse(
        open(file_path, 'rb'),
        content_type='application/pdf',
    )
    # inline for preview (D-14); use 'attachment' for download button
    response['Content-Disposition'] = (
        f'inline; filename="{submission_file.original_filename}"'
    )
    return response


# ── Thesis progress (audit T2) ─────────────────────────────────────────────────

def _serialize_chapter(c):
    return {'id': c.id, 'order': c.order, 'title': c.title, 'is_completed': c.is_completed}


class ThesisProgressView(APIView):
    """GET /api/thesis-progress/ — the logged-in student's skripsi chapter checklist
    (seeded Bab I–V on first access) plus an overall completion percent."""
    permission_classes = [IsStudent]

    def get(self, request):
        chapters = [_serialize_chapter(c) for c in ThesisChapter.ensure_for(request.user)]
        total = len(chapters)
        completed = sum(1 for c in chapters if c['is_completed'])
        return Response({
            'chapters': chapters,
            'total': total,
            'completed': completed,
            'percent': round(completed / total * 100) if total else 0,
        })


class ThesisChapterUpdateView(APIView):
    """PATCH /api/thesis-progress/<id>/ — student toggles one of their own chapters."""
    permission_classes = [IsStudent]

    def patch(self, request, pk):
        try:
            chapter = ThesisChapter.objects.get(pk=pk, student=request.user)
        except ThesisChapter.DoesNotExist:
            return Response({'detail': 'Bab tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

        is_completed = request.data.get('is_completed')
        if not isinstance(is_completed, bool):
            return Response(
                {'detail': "Field 'is_completed' (boolean) wajib diisi."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        chapter.is_completed = is_completed
        chapter.save(update_fields=['is_completed', 'updated_at'])
        return Response(_serialize_chapter(chapter))
