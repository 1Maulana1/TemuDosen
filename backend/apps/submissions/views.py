"""
Submission views — Plan 04.

Views:
  SubmissionListCreateView:
    - POST /api/submissions/ — student creates a submission (IsStudent + IsApprovedUser)
    - GET  /api/submissions/ — student lists own submissions (IsStudent + IsApprovedUser)

  serve_submission_file:
    - GET /api/files/<uuid>/ — serves file ONLY to the owning student, their adviser, or admin/kaprodi
    - Implements D-29 protected serving (RESEARCH Pattern 3)
    - Returns FileResponse inline for in-app preview (D-14)
    - NEVER uses MEDIA_URL (anti-pattern per RESEARCH / D-29)
"""
import os

from django.http import FileResponse, Http404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsStudent

from .models import Submission, SubmissionFile
from .serializers import SubmissionCreateSerializer, SubmissionListSerializer


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
            .prefetch_related('symptoms', 'file')
            .order_by('-created_at')
        )
        serializer = SubmissionListSerializer(submissions, many=True)
        return Response(serializer.data)


# ── Protected File Serving (D-29) ──────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def serve_submission_file(request, file_uuid):
    """
    Serve an uploaded PDF file ONLY to authorised users.

    Access allowed if:
      - request.user == submission.student (the owner)
      - request.user == submission.student.adviser (the assigned lecturer)
      - request.user.role in ('admin', 'kaprodi')

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

    # Access control: owner OR adviser OR admin/kaprodi (T-1-15, T-1-18)
    is_owner = (user == student)
    is_adviser = (student.adviser is not None and user == student.adviser)
    is_admin_or_kaprodi = user.role in ('admin', 'kaprodi')

    if not (is_owner or is_adviser or is_admin_or_kaprodi):
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
