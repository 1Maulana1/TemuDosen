"""URL patterns for bimbingan app — Phase 2 + Phase 3 (Admin/Kaprodi)."""
from django.urls import path

from .views import (
    CalendarAuthView, CalendarCallbackView, CalendarStatusView,
    CancelStudentQueueView, LecturerQueueView, StudentQueueView, StartSessionView,
    LecturerStatsView, AdminStatsView, AdminEmergencyCancelView,
    AdminLogsView, AdminLogsCleanupView,
    KaprodiStatsView, KaprodiExportView, KaprodiComplianceView,
    SessionActionItemsView, CompleteActionItemView,
)

queue_urlpatterns = [
    path('my/', StudentQueueView.as_view(), name='queue-my'),
    path('<int:pk>/cancel/', CancelStudentQueueView.as_view(), name='queue-cancel'),
    path('<int:pk>/start/', StartSessionView.as_view(), name='queue-start'),
    path('lecturer/', LecturerQueueView.as_view(), name='queue-lecturer'),
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

# FR-KP01/02/03/04: kaprodi-facing endpoints
kaprodi_urlpatterns = [
    path('stats/', KaprodiStatsView.as_view(), name='kaprodi-stats'),
    path('export/', KaprodiExportView.as_view(), name='kaprodi-export'),
    path('compliance/', KaprodiComplianceView.as_view(), name='kaprodi-compliance'),
]

# FR-KP04: mark a saran/action-item as done (student-owned, not session-scoped)
action_item_urlpatterns = [
    path('<int:pk>/complete/', CompleteActionItemView.as_view(), name='action-item-complete'),
]
