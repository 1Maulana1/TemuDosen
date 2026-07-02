"""
URL patterns for submissions app — Phase 1 + Phase 2.

Routes:
  POST /api/submissions/              — student create submission
  GET  /api/submissions/              — student list own submissions
  GET  /api/submissions/lecturer/     — lecturer list advisees' submissions (REVIEW-01)
  POST /api/submissions/<id>/approve/ — lecturer approve submission (Phase 2)
  POST /api/submissions/<id>/reject/  — lecturer reject/revise submission (Phase 2)
  GET  /api/files/<uuid>/             — protected file serving (D-29)
"""
from django.urls import path

from .views import LecturerSubmissionListView, SubmissionListCreateView, serve_submission_file
from apps.bimbingan.views import ApproveSubmissionView, RejectSubmissionView

urlpatterns = [
    path('', SubmissionListCreateView.as_view(), name='submission-list-create'),
    path('lecturer/', LecturerSubmissionListView.as_view(), name='submission-lecturer-list'),
    # Phase 2 — approve/reject
    path('<int:pk>/approve/', ApproveSubmissionView.as_view(), name='submission-approve'),
    path('<int:pk>/reject/', RejectSubmissionView.as_view(), name='submission-reject'),
]

# File serving: /api/files/<uuid>/ is registered at root URL config level
file_urlpatterns = [
    path('<uuid:file_uuid>/', serve_submission_file, name='serve-submission-file'),
]
