"""
URL configuration for TemuDosen.

Endpoints registered here:
  /api/csrf/       → core.urls (Task 1 stub, implemented Task 2)
  /api/auth/       → apps.accounts.urls (Task 2)
  /api/symptoms/   → apps.symptoms.urls (Plan 03 — placeholder include-guarded)
  /api/submissions/→ apps.submissions.urls (Plan 04 — placeholder include-guarded)
  /api/users/      → apps.accounts.urls (Plan 02 — placeholder)
"""
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    # Core cross-cutting endpoints (CSRF cookie)
    path('api/', include('core.urls')),
    # Auth: login, logout, me
    path('api/auth/', include('apps.accounts.urls')),
    # Feature plans uncomment their own include below:
    # Plan 03: Symptom category CRUD
    path('api/symptoms/', include('apps.symptoms.urls')),
    # Plan 04/05: Submission management
    # path('api/submissions/', include('apps.submissions.urls')),
    # Plan 02: User registration + approval
    path('api/users/', include('apps.accounts.user_urls')),
]
