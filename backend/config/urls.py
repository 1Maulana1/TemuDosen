"""
URL configuration for TemuDosen.

Phase 1:
  /api/csrf/        → core.urls
  /api/auth/        → apps.accounts.urls
  /api/symptoms/    → apps.symptoms.urls
  /api/submissions/ → apps.submissions.urls  (includes Phase 2 approve/reject)
  /api/files/<uuid>/→ protected file serving (D-29)
  /api/users/       → apps.accounts.user_urls

Phase 2:
  /api/queue/       → apps.bimbingan queue views
  /api/calendar/    → apps.bimbingan calendar OAuth views
  /api/stats/       → lecturer/admin summary stats

Phase 3 (Admin/Ketua Jurusan):
  /api/admin/          → symptom catalog CRUD, emergency cancel, error logs (FR-AD01/02/03)
  /api/ketua-jurusan/  → workload/compliance stats + logbook export (FR-KP01-04)
  /api/action-items/   → mark a saran/tindak-lanjut as done (FR-KP04)
"""
from django.contrib import admin
from django.urls import path, include

from apps.submissions.urls import file_urlpatterns, thesis_urlpatterns
from apps.bimbingan.urls import (
    queue_urlpatterns, calendar_urlpatterns, stats_urlpatterns,
    admin_urlpatterns, ketua_jurusan_urlpatterns, action_item_urlpatterns,
    notification_urlpatterns,
)
from apps.symptoms.urls import router as symptoms_router
from apps.logbook.urls import logbook_urlpatterns

urlpatterns = [
    path('admin/', admin.site.urls),
    # Core
    path('api/', include('core.urls')),
    # Auth
    path('api/auth/', include('apps.accounts.urls')),
    # Symptoms (general read access for all approved users)
    path('api/symptoms/', include('apps.symptoms.urls')),
    # Submissions (Phase 1 + Phase 2 approve/reject)
    path('api/submissions/', include('apps.submissions.urls')),
    # Protected file serving (D-29)
    path('api/files/', include((file_urlpatterns, 'submission-files'))),
    # Thesis progress checklist (audit T2)
    path('api/thesis-progress/', include((thesis_urlpatterns, 'thesis-progress'))),
    # User registration + approval
    path('api/users/', include('apps.accounts.user_urls')),
    # Phase 2: Queue
    path('api/queue/', include((queue_urlpatterns, 'queue'))),
    # Phase 2: Calendar OAuth
    path('api/calendar/', include((calendar_urlpatterns, 'calendar'))),
    # Dashboard stats
    path('api/stats/', include((stats_urlpatterns, 'stats'))),
    # Phase 3: Admin (FR-AD01/02/03) — same SymptomCategoryViewSet, admin-scoped alias
    path('api/admin/symptoms/', include((symptoms_router.urls, 'admin-symptoms'))),
    path('api/admin/', include((admin_urlpatterns, 'admin-api'))),
    # Phase 3: Ketua Jurusan (FR-KP01-04)
    path('api/ketua-jurusan/', include((ketua_jurusan_urlpatterns, 'ketua-jurusan'))),
    # Phase 3: Action items (FR-KP04)
    path('api/action-items/', include((action_item_urlpatterns, 'action-items'))),
    path('api/notifications/', include((notification_urlpatterns, 'notifications'))),
    # Phase 6: Logbook (STT/AI summarization + manual fallback) — menggantikan /api/queue/<id>/summary/
    path('api/logbook/', include((logbook_urlpatterns, 'logbook'))),
]
