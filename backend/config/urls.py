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
"""
from django.contrib import admin
from django.urls import path, include

from apps.submissions.urls import file_urlpatterns
from apps.bimbingan.urls import queue_urlpatterns, calendar_urlpatterns, stats_urlpatterns

urlpatterns = [
    path('admin/', admin.site.urls),
    # Core
    path('api/', include('core.urls')),
    # Auth
    path('api/auth/', include('apps.accounts.urls')),
    # Symptoms
    path('api/symptoms/', include('apps.symptoms.urls')),
    # Submissions (Phase 1 + Phase 2 approve/reject)
    path('api/submissions/', include('apps.submissions.urls')),
    # Protected file serving (D-29)
    path('api/files/', include((file_urlpatterns, 'submission-files'))),
    # User registration + approval
    path('api/users/', include('apps.accounts.user_urls')),
    # Phase 2: Queue
    path('api/queue/', include((queue_urlpatterns, 'queue'))),
    # Phase 2: Calendar OAuth
    path('api/calendar/', include((calendar_urlpatterns, 'calendar'))),
    # Dashboard stats
    path('api/stats/', include((stats_urlpatterns, 'stats'))),
]
