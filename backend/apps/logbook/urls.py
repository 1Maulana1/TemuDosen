"""Phase 6 (06-04): rute API logbook — disertakan di config/urls.py sebagai 'api/logbook/'."""
from django.urls import path

from .views import (
    ApproveLogbookView,
    LecturerLogbookDetailView,
    LecturerLogbookListView,
    ManualNotesView,
    StudentLogbookListView,
    StudentLogbookView,
)

logbook_urlpatterns = [
    path('lecturer/', LecturerLogbookListView.as_view(), name='logbook-lecturer'),
    path('student/', StudentLogbookListView.as_view(), name='logbook-student-list'),
    path('student/<int:session_id>/', StudentLogbookView.as_view(), name='logbook-student'),
    path('<int:session_id>/', LecturerLogbookDetailView.as_view(), name='logbook-detail'),
    path('<int:session_id>/approve/', ApproveLogbookView.as_view(), name='logbook-approve'),
    path('<int:session_id>/manual-notes/', ManualNotesView.as_view(), name='logbook-manual-notes'),
]
