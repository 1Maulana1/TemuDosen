"""URL patterns for the logbook app — Phase 6 (06-04)."""
from django.urls import path

from .views import LecturerLogbookDetailView, LecturerLogbookListView, StudentLogbookView

logbook_urlpatterns = [
    path('lecturer/', LecturerLogbookListView.as_view(), name='logbook-lecturer-list'),
    path('<int:session_id>/', LecturerLogbookDetailView.as_view(), name='logbook-detail'),
    path('student/<int:session_id>/', StudentLogbookView.as_view(), name='logbook-student'),
]
