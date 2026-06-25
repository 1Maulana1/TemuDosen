"""
URL configuration for TemuDosen.

Endpoints registered here:
  /api/csrf/        → core.urls (Task 1 stub, implemented Task 2)
  /api/auth/        → apps.accounts.urls (Task 2)
  /api/symptoms/    → apps.symptoms.urls (Plan 03)
  /api/submissions/ → apps.submissions.urls (Plan 04)
  /api/files/<uuid>/→ apps.submissions.file_urlpatterns (Plan 04 — D-29 protected serving)
  /api/users/       → apps.accounts.urls (Plan 02)
"""
from django.contrib import admin
from django.urls import path, include

from apps.submissions.urls import file_urlpatterns

urlpatterns = [
    path('admin/', admin.site.urls),
    # Core cross-cutting endpoints (CSRF cookie)
    path('api/', include('core.urls')),
    # Auth: login, logout, me
    path('api/auth/', include('apps.accounts.urls')),
    # Plan 03: Symptom category CRUD
    path('api/symptoms/', include('apps.symptoms.urls')),
    # Plan 04: Submission management
    path('api/submissions/', include('apps.submissions.urls')),
    # Plan 04: Protected file serving (D-29) — separate from submissions/ prefix
    path('api/files/', include((file_urlpatterns, 'submission-files'))),
    # Plan 02: User registration + approval
    path('api/users/', include('apps.accounts.user_urls')),
]
