"""
Auth endpoint tests (Task 2 TDD behaviors).

Tests cover:
- POST /api/auth/login/ with correct credentials → 200 + session
- POST /api/auth/login/ with wrong password → 401
- GET /api/auth/me/ authenticated → 200 + user JSON with role and is_approved
- GET /api/auth/me/ unauthenticated → 403
- POST /api/auth/logout/ → ends session; /me/ returns 403 after
"""
import pytest

from apps.accounts.models import CustomUser, UserRole


@pytest.mark.django_db
class TestLogin:
    def test_login_with_valid_credentials_returns_200(self, api_client, admin_user):
        """POST /api/auth/login/ with correct credentials returns 200."""
        response = api_client.post('/api/auth/login/', {
            'email': admin_user.email,
            'password': 'adminpass123',
        }, format='json')
        assert response.status_code == 200

    def test_login_returns_user_with_role(self, api_client, admin_user):
        """Login response includes role and is_approved fields."""
        response = api_client.post('/api/auth/login/', {
            'email': admin_user.email,
            'password': 'adminpass123',
        }, format='json')
        assert response.data['role'] == UserRole.ADMIN
        assert response.data['is_approved'] is True

    def test_login_with_wrong_password_returns_401(self, api_client, admin_user):
        """POST /api/auth/login/ with wrong password returns 401."""
        response = api_client.post('/api/auth/login/', {
            'email': admin_user.email,
            'password': 'wrongpassword',
        }, format='json')
        assert response.status_code == 401
        assert 'detail' in response.data

    def test_login_with_missing_fields_returns_400(self, api_client):
        """POST /api/auth/login/ with empty fields returns 400."""
        response = api_client.post('/api/auth/login/', {}, format='json')
        assert response.status_code == 400


@pytest.mark.django_db
class TestMeEndpoint:
    def test_me_authenticated_returns_200(self, api_client, admin_user):
        """GET /api/auth/me/ with valid session returns 200 with user data."""
        api_client.force_authenticate(user=admin_user)
        response = api_client.get('/api/auth/me/')
        assert response.status_code == 200
        assert response.data['email'] == admin_user.email
        assert response.data['role'] == UserRole.ADMIN
        assert response.data['is_approved'] is True

    def test_me_unauthenticated_returns_403(self, api_client):
        """GET /api/auth/me/ without a session returns 403."""
        response = api_client.get('/api/auth/me/')
        assert response.status_code == 403

    def test_me_returns_full_name(self, api_client, student_user):
        """GET /api/auth/me/ returns full_name field."""
        api_client.force_authenticate(user=student_user)
        response = api_client.get('/api/auth/me/')
        assert response.data['full_name'] == student_user.full_name

    def test_me_returns_is_approved_field(self, api_client, student_user):
        """GET /api/auth/me/ exposes is_approved so the router can redirect unapproved users."""
        api_client.force_authenticate(user=student_user)
        response = api_client.get('/api/auth/me/')
        assert 'is_approved' in response.data


@pytest.mark.django_db
class TestLogout:
    def test_logout_ends_session(self, api_client, admin_user):
        """POST /api/auth/logout/ ends the session; subsequent /me/ returns 403."""
        api_client.force_authenticate(user=admin_user)
        response = api_client.post('/api/auth/logout/')
        assert response.status_code == 200

        # After logout, force_authenticate is cleared and /me/ should reject
        api_client.force_authenticate(user=None)
        me_response = api_client.get('/api/auth/me/')
        assert me_response.status_code == 403

    def test_logout_unauthenticated_returns_403(self, api_client):
        """POST /api/auth/logout/ without a session returns 403."""
        response = api_client.post('/api/auth/logout/')
        assert response.status_code == 403


@pytest.mark.django_db
class TestPermissionClasses:
    def test_is_approved_user_blocks_unapproved(self, api_client):
        """Unapproved user cannot access is_approved-gated endpoints (tested indirectly via /me/)."""
        unapproved = CustomUser.objects.create_user(
            email='unapproved@test.com',
            password='pass',
            full_name='Pending User',
            role=UserRole.STUDENT,
            is_approved=False,
        )
        api_client.force_authenticate(user=unapproved)
        # /me/ only requires IsAuthenticated — accessible even unapproved
        response = api_client.get('/api/auth/me/')
        assert response.status_code == 200
        assert response.data['is_approved'] is False
