"""URL patterns for submissions app — Plan 04."""
from django.urls import path

from .views import SubmissionListCreateView, serve_submission_file

urlpatterns = [
    path('', SubmissionListCreateView.as_view(), name='submission-list-create'),
]

# File serving: /api/files/<uuid>/ is registered at root URL config level
# so it sits at /api/files/<uuid>/ (not under /api/submissions/files/)
file_urlpatterns = [
    path('<uuid:file_uuid>/', serve_submission_file, name='serve-submission-file'),
]
