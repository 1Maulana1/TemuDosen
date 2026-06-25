"""
Unit tests for the CustomUser model (Task 1 TDD behaviors).

Tests cover:
- create_user: authenticates with check_password, is_approved=False by default
- create_superuser: role='admin', is_approved=True, is_staff=True, is_superuser=True
- USERNAME_FIELD is 'email'; can look up by email
- nim/nidn accept null
- adviser FK limited to lecturers; student can reference an approved lecturer
"""
import pytest

from apps.accounts.models import CustomUser, UserRole


@pytest.mark.django_db
class TestCreateUser:
    def test_create_user_with_email_and_password(self):
        """create_user sets email, hashed password, and default is_approved=False."""
        user = CustomUser.objects.create_user(
            email='student@example.com',
            password='testpass123',
            full_name='Test Student',
            role=UserRole.STUDENT,
        )
        assert user.email == 'student@example.com'
        assert user.check_password('testpass123')
        assert not user.is_approved  # default False
        assert user.is_active        # default True
        assert not user.is_staff     # default False

    def test_create_user_email_is_normalized(self):
        """Email domain is normalized to lowercase."""
        user = CustomUser.objects.create_user(
            email='Student@EXAMPLE.COM',
            password='testpass123',
            full_name='Test Student',
        )
        assert user.email == 'Student@example.com'

    def test_create_user_requires_email(self):
        """create_user raises ValueError when email is empty."""
        with pytest.raises(ValueError, match='Email'):
            CustomUser.objects.create_user(email='', password='testpass123', full_name='Test')

    def test_create_user_is_approved_false_by_default(self):
        """Freshly created users have is_approved=False until admin approves."""
        user = CustomUser.objects.create_user(
            email='pending@example.com',
            password='testpass',
            full_name='Pending User',
        )
        assert user.is_approved is False


@pytest.mark.django_db
class TestCreateSuperuser:
    def test_create_superuser_has_admin_role_and_flags(self):
        """create_superuser produces role='admin', is_approved=True, is_staff=True, is_superuser=True."""
        admin = CustomUser.objects.create_superuser(
            email='admin@temudosen.ac.id',
            password='adminpass123',
            full_name='System Admin',
        )
        assert admin.role == UserRole.ADMIN
        assert admin.is_approved is True
        assert admin.is_staff is True
        assert admin.is_superuser is True

    def test_create_superuser_check_password(self):
        """Superuser password is stored hashed and verifiable."""
        admin = CustomUser.objects.create_superuser(
            email='admin2@temudosen.ac.id',
            password='securepass!',
            full_name='Admin Two',
        )
        assert admin.check_password('securepass!')


@pytest.mark.django_db
class TestUsernameFieldAndLookup:
    def test_username_field_is_email(self):
        """USERNAME_FIELD attribute is 'email'."""
        assert CustomUser.USERNAME_FIELD == 'email'

    def test_required_fields_contains_full_name(self):
        """REQUIRED_FIELDS includes 'full_name'."""
        assert 'full_name' in CustomUser.REQUIRED_FIELDS

    def test_lookup_by_email(self):
        """Users can be found via CustomUser.objects.get(email=...)."""
        user = CustomUser.objects.create_user(
            email='lookup@example.com',
            password='testpass',
            full_name='Lookup User',
        )
        found = CustomUser.objects.get(email='lookup@example.com')
        assert found.pk == user.pk

    def test_nim_accepts_null(self):
        """nim field allows null (non-students have no NIM)."""
        user = CustomUser.objects.create_user(
            email='lecturer@example.com',
            password='testpass',
            full_name='Dr. Lecturer',
            role=UserRole.LECTURER,
            nim=None,
        )
        assert user.nim is None

    def test_nidn_accepts_null(self):
        """nidn field allows null (students have no NIDN)."""
        user = CustomUser.objects.create_user(
            email='student2@example.com',
            password='testpass',
            full_name='Student No NIDN',
            role=UserRole.STUDENT,
            nidn=None,
        )
        assert user.nidn is None

    def test_nim_unique(self):
        """Two users with the same NIM cannot coexist."""
        from django.db import IntegrityError
        CustomUser.objects.create_user(
            email='s1@example.com',
            password='pass',
            full_name='Student 1',
            nim='12345678',
        )
        with pytest.raises(IntegrityError):
            CustomUser.objects.create_user(
                email='s2@example.com',
                password='pass',
                full_name='Student 2',
                nim='12345678',
            )


@pytest.mark.django_db
class TestAdviserFK:
    def test_student_can_reference_approved_lecturer(self):
        """A student's adviser FK can be set to an approved lecturer."""
        lecturer = CustomUser.objects.create_user(
            email='lecturer@example.com',
            password='lecpass',
            full_name='Dr. Lecturer',
            role=UserRole.LECTURER,
            is_approved=True,
        )
        student = CustomUser.objects.create_user(
            email='student@example.com',
            password='stupass',
            full_name='Student A',
            role=UserRole.STUDENT,
            adviser=lecturer,
        )
        assert student.adviser == lecturer
        assert student.adviser.role == UserRole.LECTURER

    def test_adviser_set_null_on_lecturer_delete(self):
        """When a lecturer is deleted, the student's adviser is set to NULL (on_delete=SET_NULL)."""
        lecturer = CustomUser.objects.create_user(
            email='lecturer2@example.com',
            password='lecpass',
            full_name='Dr. Deletable',
            role=UserRole.LECTURER,
            is_approved=True,
        )
        student = CustomUser.objects.create_user(
            email='student2@example.com',
            password='stupass',
            full_name='Student B',
            role=UserRole.STUDENT,
            adviser=lecturer,
        )
        lecturer.delete()
        student.refresh_from_db()
        assert student.adviser is None

    def test_google_oauth_token_default_null(self):
        """google_oauth_token is null by default (Phase 4 forward-compat)."""
        user = CustomUser.objects.create_user(
            email='oauth@example.com',
            password='pass',
            full_name='OAuth User',
        )
        assert user.google_oauth_token is None
