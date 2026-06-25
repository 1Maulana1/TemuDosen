"""
Shared pytest fixtures for the TemuDosen backend test suite (Wave 0).

Fixtures:
- api_client: DRF APIClient (unauthenticated)
- student_user: approved student CustomUser
- lecturer_user: approved lecturer CustomUser
- admin_user: admin CustomUser (is_staff=True, is_superuser=True)
"""
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import CustomUser, UserRole


@pytest.fixture
def api_client():
    """Unauthenticated DRF APIClient."""
    return APIClient()


@pytest.fixture
def student_user(db):
    """An approved student user."""
    user = CustomUser.objects.create_user(
        email='student@test.com',
        password='testpass123',
        full_name='Test Student',
        role=UserRole.STUDENT,
        is_approved=True,
        nim='20230001',
    )
    return user


@pytest.fixture
def lecturer_user(db):
    """An approved lecturer user."""
    user = CustomUser.objects.create_user(
        email='lecturer@test.com',
        password='testpass123',
        full_name='Dr. Test Lecturer',
        role=UserRole.LECTURER,
        is_approved=True,
        nidn='0012345678',
    )
    return user


@pytest.fixture
def admin_user(db):
    """An admin user with full staff/superuser flags."""
    user = CustomUser.objects.create_superuser(
        email='admin@test.com',
        password='adminpass123',
        full_name='Test Admin',
    )
    return user


@pytest.fixture
def authenticated_student(api_client, student_user):
    """APIClient authenticated as student_user."""
    api_client.force_authenticate(user=student_user)
    return api_client


@pytest.fixture
def authenticated_lecturer(api_client, lecturer_user):
    """APIClient authenticated as lecturer_user."""
    api_client.force_authenticate(user=lecturer_user)
    return api_client


@pytest.fixture
def authenticated_admin(api_client, admin_user):
    """APIClient authenticated as admin_user."""
    api_client.force_authenticate(user=admin_user)
    return api_client
