"""
URL patterns for user management endpoints (Plan 02).
Mounted at /api/users/ in config/urls.py.

  GET  /api/users/lecturers/      → LecturerListView (approved-only dropdown)
  GET  /api/users/pending/        → PendingUsersView (admin only)
  POST /api/users/<id>/approve/   → ApproveUserView (admin only)
  POST /api/users/<id>/reject/    → RejectUserView (admin only)
"""
from django.urls import path

from .views import ApproveUserView, LecturerListView, PendingUsersView, RejectUserView

urlpatterns = [
    path('lecturers/', LecturerListView.as_view(), name='user-lecturers'),
    path('pending/', PendingUsersView.as_view(), name='user-pending'),
    path('<int:pk>/approve/', ApproveUserView.as_view(), name='user-approve'),
    path('<int:pk>/reject/', RejectUserView.as_view(), name='user-reject'),
]
