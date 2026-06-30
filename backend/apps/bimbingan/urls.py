"""URL patterns for bimbingan app — Phase 2."""
from django.urls import path

from .views import (
    CalendarAuthView, CalendarCallbackView, CalendarStatusView,
    CancelStudentQueueView, LecturerQueueView, StudentQueueView, StartSessionView,
    LecturerStatsView, AdminStatsView, AdminEmergencyCancelView,
    KaprodiStatsView, KaprodiExportView,
)

queue_urlpatterns = [
    path('my/', StudentQueueView.as_view(), name='queue-my'),
    path('<int:pk>/cancel/', CancelStudentQueueView.as_view(), name='queue-cancel'),
    path('<int:pk>/start/', StartSessionView.as_view(), name='queue-start'),
    path('lecturer/', LecturerQueueView.as_view(), name='queue-lecturer'),
]

calendar_urlpatterns = [
    path('auth/', CalendarAuthView.as_view(), name='calendar-auth'),
    path('callback/', CalendarCallbackView.as_view(), name='calendar-callback'),
    path('status/', CalendarStatusView.as_view(), name='calendar-status'),
]

stats_urlpatterns = [
    path('lecturer/', LecturerStatsView.as_view(), name='stats-lecturer'),
    path('admin/', AdminStatsView.as_view(), name='stats-admin'),
    path('admin/emergency-cancel/', AdminEmergencyCancelView.as_view(), name='stats-admin-cancel'),
    path('kaprodi/', KaprodiStatsView.as_view(), name='stats-kaprodi'),
    path('kaprodi/export/', KaprodiExportView.as_view(), name='stats-kaprodi-export'),
]
