"""URL patterns for the logbook app — Phase 6 (06-04)."""
from django.urls import path

from .views import (
    ApproveLogbookView,
    LecturerLogbookDetailView,
    LecturerLogbookListView,
    ManualNotesView,
    RejectLogbookView,
    StudentLogbookView,
)

logbook_urlpatterns = [
    path('lecturer/', LecturerLogbookListView.as_view(), name='logbook-lecturer-list'),
    path('<int:session_id>/', LecturerLogbookDetailView.as_view(), name='logbook-detail'),
    path('<int:session_id>/approve/', ApproveLogbookView.as_view(), name='logbook-approve'),
    path('<int:session_id>/reject/', RejectLogbookView.as_view(), name='logbook-reject'),
    path('<int:session_id>/manual-notes/', ManualNotesView.as_view(), name='logbook-manual-notes'),
    path('student/<int:session_id>/', StudentLogbookView.as_view(), name='logbook-student'),
]
