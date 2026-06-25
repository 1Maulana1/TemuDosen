"""
Role-based DRF permission classes for TemuDosen (RESEARCH Pattern 6).

IsApprovedUser: authenticated AND admin-approved
IsStudent: approved student
IsLecturer: approved lecturer
IsAdmin: admin (is_approved not strictly required but implied by seeding)
"""
from rest_framework import permissions


class IsApprovedUser(permissions.BasePermission):
    """User must be authenticated AND approved by admin (D-20)."""

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.is_approved
        )


class IsStudent(IsApprovedUser):
    """Approved student."""

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role == 'student'


class IsLecturer(IsApprovedUser):
    """Approved lecturer."""

    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role == 'lecturer'


class IsAdmin(permissions.BasePermission):
    """Admin role — does not require is_approved check (admin is seeded with it True)."""

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'admin'
        )


class IsKaprodi(permissions.BasePermission):
    """Kaprodi role — read-only monitoring access."""

    def has_permission(self, request, view):
        return bool(
            request.user and
            request.user.is_authenticated and
            request.user.role == 'kaprodi'
        )
