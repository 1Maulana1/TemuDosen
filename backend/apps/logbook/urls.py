"""Phase 6 (06-04): rute API logbook — disertakan di config/urls.py sebagai 'api/logbook/'."""
from django.urls import path

from .views import (
    ApproveLogbookView,
    CampusLogbookConfigView,
    LecturerLogbookDetailView,
    LecturerLogbookListView,
    LogbookExportView,
    RetryPipelineView,
    ManualNotesView,
    RejectLogbookView,
    StudentLogbookListView,
    StudentLogbookView,
)

logbook_urlpatterns = [
    # SC6 (ADMIN-04): admin mengatur kredensial/setelan integrasi logbook kampus
    path('admin/campus-config/', CampusLogbookConfigView.as_view(), name='logbook-campus-config'),
    path('lecturer/', LecturerLogbookListView.as_view(), name='logbook-lecturer'),
    path('student/', StudentLogbookListView.as_view(), name='logbook-student-list'),
    path('student/<int:session_id>/', StudentLogbookView.as_view(), name='logbook-student'),
    path('<int:session_id>/', LecturerLogbookDetailView.as_view(), name='logbook-detail'),
    path('<int:session_id>/approve/', ApproveLogbookView.as_view(), name='logbook-approve'),
    path('<int:session_id>/reject/', RejectLogbookView.as_view(), name='logbook-reject'),
    path('<int:session_id>/manual-notes/', ManualNotesView.as_view(), name='logbook-manual-notes'),
    # G6: dosen coba proses ulang pipeline STT/AI untuk logbook FAILED
    path('<int:session_id>/retry/', RetryPipelineView.as_view(), name='logbook-retry'),
    # SC4 (LOGBOOK-02): ekspor CSV/PDF ringkasan untuk upload manual ke logbook kampus
    path('<int:session_id>/export/', LogbookExportView.as_view(), name='logbook-export'),
]
