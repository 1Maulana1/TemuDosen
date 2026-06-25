"""
Tests for admin approval/rejection of pending users (Plan 02).

Covers:
- GET /api/users/pending/ lists pending students and lecturers (admin only)
- GET /api/users/pending/ returns 403 for non-admin
- POST /api/users/<id>/approve/ sets is_approved=True (admin only)
- POST /api/users/<id>/reject/ deactivates/deletes the account (admin only)
- Non-admin approve/reject returns 403
"""
import pytest
from apps.accounts.models import CustomUser


@pytest.mark.django_db
class TestPendingUsersList:
    """GET /api/users/pending/ — admin only."""

    url = '/api/users/pending/'

    def test_admin_sees_pending_users(
        self, authenticated_admin, pending_student, pending_lecturer
    ):
        """Admin gets a list containing both pending students and lecturers."""
        response = authenticated_admin.get(self.url)
        assert response.status_code == 200
        ids = [u['id'] for u in response.data]
        assert pending_student.id in ids
        assert pending_lecturer.id in ids

    def test_pending_list_includes_role_field(
        self, authenticated_admin, pending_student
    ):
        """Each entry in the pending list has a role field (S-11 Role column)."""
        response = authenticated_admin.get(self.url)
        assert response.status_code == 200
        item = next(u for u in response.data if u['id'] == pending_student.id)
        assert 'role' in item

    def test_approved_users_not_in_pending_list(
        self, authenticated_admin, student_user, lecturer_user
    ):
        """Approved users do not appear in the pending list."""
        response = authenticated_admin.get(self.url)
        assert response.status_code == 200
        ids = [u['id'] for u in response.data]
        assert student_user.id not in ids
        assert lecturer_user.id not in ids

    def test_non_admin_gets_403(self, authenticated_student):
        """Non-admin user is forbidden from accessing pending list."""
        response = authenticated_student.get(self.url)
        assert response.status_code == 403

    def test_anonymous_gets_403(self, api_client):
        """Anonymous user is forbidden from accessing pending list."""
        response = api_client.get(self.url)
        assert response.status_code == 403


@pytest.mark.django_db
class TestApproveUser:
    """POST /api/users/<id>/approve/ — admin only."""

    def approve_url(self, user_id):
        return f'/api/users/{user_id}/approve/'

    def test_admin_can_approve_pending_user(
        self, authenticated_admin, pending_student
    ):
        """Admin approval sets is_approved=True."""
        assert pending_student.is_approved is False
        response = authenticated_admin.post(self.approve_url(pending_student.id))
        assert response.status_code == 200
        pending_student.refresh_from_db()
        assert pending_student.is_approved is True

    def test_approve_returns_updated_user(
        self, authenticated_admin, pending_lecturer
    ):
        """Approve response contains the updated user object with is_approved=True."""
        response = authenticated_admin.post(self.approve_url(pending_lecturer.id))
        assert response.status_code == 200
        assert response.data['is_approved'] is True

    def test_non_admin_cannot_approve(self, authenticated_student, pending_student):
        """Non-admin is forbidden from approving users."""
        response = authenticated_student.post(self.approve_url(pending_student.id))
        assert response.status_code == 403

    def test_anonymous_cannot_approve(self, api_client, pending_student):
        """Anonymous user is forbidden from approving users."""
        response = api_client.post(self.approve_url(pending_student.id))
        assert response.status_code == 403

    def test_approve_nonexistent_user_returns_404(self, authenticated_admin):
        """Approving a nonexistent user returns 404."""
        response = authenticated_admin.post(self.approve_url(99999))
        assert response.status_code == 404


@pytest.mark.django_db
class TestRejectUser:
    """POST /api/users/<id>/reject/ — admin only."""

    def reject_url(self, user_id):
        return f'/api/users/{user_id}/reject/'

    def test_admin_can_reject_pending_user(
        self, authenticated_admin, pending_student
    ):
        """Admin rejection deactivates the account."""
        response = authenticated_admin.post(self.reject_url(pending_student.id))
        assert response.status_code == 200
        pending_student.refresh_from_db()
        assert pending_student.is_active is False

    def test_non_admin_cannot_reject(self, authenticated_student, pending_student):
        """Non-admin is forbidden from rejecting users."""
        response = authenticated_student.post(self.reject_url(pending_student.id))
        assert response.status_code == 403

    def test_anonymous_cannot_reject(self, api_client, pending_student):
        """Anonymous user is forbidden from rejecting users."""
        response = api_client.post(self.reject_url(pending_student.id))
        assert response.status_code == 403

    def test_reject_nonexistent_user_returns_404(self, authenticated_admin):
        """Rejecting a nonexistent user returns 404."""
        response = authenticated_admin.post(self.reject_url(99999))
        assert response.status_code == 404
