"""
URL patterns for submissions app — Plan 04 (student) + Plan 05 (lecturer).

Routes:
  /api/submissions/           — SubmissionListCreateView (student POST/GET)
  /api/submissions/lecturer/  — LecturerSubmissionListView (lecturer GET, REVIEW-01)
  /api/files/<uuid>/          — serve_submission_file (D-29 protected serving)

The lecturer endpoint is a dedicated path so the student endpoint's IsStudent
permission is not mixed with the lecturer's IsLecturer permission. Each role
has its own URL and view class, keeping permissions clean.

No approve/reject route is added here — that is Phase 2 scope (D-12).
Absence of 'approve'/'reject' in this file confirms D-12 compliance.
"""
from django.urls import path

from .views import LecturerSubmissionListView, SubmissionListCreateView, serve_submission_file

urlpatterns = [
    path('', SubmissionListCreateView.as_view(), name='submission-list-create'),
    path('lecturer/', LecturerSubmissionListView.as_view(), name='submission-lecturer-list'),
]

# File serving: /api/files/<uuid>/ is registered at root URL config level
# so it sits at /api/files/<uuid>/ (not under /api/submissions/files/)
file_urlpatterns = [
    path('<uuid:file_uuid>/', serve_submission_file, name='serve-submission-file'),
]
