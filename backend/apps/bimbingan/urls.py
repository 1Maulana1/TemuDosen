"""URL patterns for bimbingan app — Phase 2 + Phase 3 (Admin/Ketua Jurusan)."""
from django.urls import path

from .views import (
    CalendarAuthView, CalendarCallbackView, CalendarStatusView,
    CancelStudentQueueView, CompleteSessionView, LecturerQueueView,
    StudentQueueView, StartSessionView,
    LecturerStatsView, AdminStatsView, AdminEmergencyCancelView,
    AdminLogsView, AdminLogsCleanupView,
    KetuaJurusanStatsView, KetuaJurusanExportView, KetuaJurusanComplianceView,
    SessionActionItemsView, CompleteActionItemView, LecturerAdviceHistoryView,
    LecturerSessionHistoryView, StudentSessionHistoryView,
    SessionRecordingFileView,
)

queue_urlpatterns = [
    path('my/', StudentQueueView.as_view(), name='queue-my'),
    path('my/history/', StudentSessionHistoryView.as_view(), name='queue-my-history'),
    path('<int:pk>/cancel/', CancelStudentQueueView.as_view(), name='queue-cancel'),
    path('<int:pk>/start/', StartSessionView.as_view(), name='queue-start'),
    path('<int:pk>/complete/', CompleteSessionView.as_view(), name='queue-complete'),
    path('<int:pk>/recording/', SessionRecordingFileView.as_view(), name='queue-recording'),
    # Phase 6 merge: ringkasan pindah ke /api/logbook/ (lihat apps.logbook.urls)
    path('lecturer/', LecturerQueueView.as_view(), name='queue-lecturer'),
    path('lecturer/history/', LecturerSessionHistoryView.as_view(), name='queue-lecturer-history'),
    # ADVICE-02 (Phase 7 SC2): rekap saran agregat lintas sesi per mahasiswa bimbingan
    path('lecturer/advice-history/', LecturerAdviceHistoryView.as_view(), name='queue-lecturer-advice-history'),
    # FR-KP04: saran / tindak lanjut bimbingan, dilekatkan ke sebuah sesi
    path('<int:session_id>/action-items/', SessionActionItemsView.as_view(), name='queue-action-items'),
]

calendar_urlpatterns = [
    path('auth/', CalendarAuthView.as_view(), name='calendar-auth'),
    path('callback/', CalendarCallbackView.as_view(), name='calendar-callback'),
    path('status/', CalendarStatusView.as_view(), name='calendar-status'),
]

stats_urlpatterns = [
    path('lecturer/', LecturerStatsView.as_view(), name='stats-lecturer'),
    path('admin/', AdminStatsView.as_view(), name='stats-admin'),
]

# FR-AD01/02/03: admin-facing endpoints
admin_urlpatterns = [
    path('emergency-cancel/', AdminEmergencyCancelView.as_view(), name='admin-emergency-cancel'),
    path('logs/', AdminLogsView.as_view(), name='admin-logs'),
    path('logs/cleanup/', AdminLogsCleanupView.as_view(), name='admin-logs-cleanup'),
]

# FR-KP01/02/03/04: ketua-jurusan-facing endpoints
ketua_jurusan_urlpatterns = [
    path('stats/', KetuaJurusanStatsView.as_view(), name='ketua-jurusan-stats'),
    path('export/', KetuaJurusanExportView.as_view(), name='ketua-jurusan-export'),
    path('compliance/', KetuaJurusanComplianceView.as_view(), name='ketua-jurusan-compliance'),
]

# FR-KP04: mark a saran/action-item as done (student-owned, not session-scoped)
action_item_urlpatterns = [
    path('<int:pk>/complete/', CompleteActionItemView.as_view(), name='action-item-complete'),
]
