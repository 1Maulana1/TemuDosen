"""
Shared pytest fixtures for the TemuDosen backend test suite.

Fixtures:
- api_client: DRF APIClient (unauthenticated)
- student_user: approved student CustomUser
- lecturer_user: approved lecturer CustomUser
- admin_user: admin CustomUser (is_staff=True, is_superuser=True)
- approved_lecturer: approved lecturer (alias for lecturer_user, for Plan 02 readability)
- pending_student: unapproved student (Plan 02)
- pending_lecturer: unapproved lecturer (Plan 02)
- symptom_category: a SymptomCategory (Plan 04)
- second_approved_student: a second approved student for non-owner file access tests (Plan 04)
- pdf_file: a BytesIO object with valid PDF magic bytes (Plan 04)
- submission_factory: callable that creates a Submission + SubmissionFile on disk (Plan 04)
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


# ── Plan 02 fixtures ───────────────────────────────────────────────────────────

@pytest.fixture
def approved_lecturer(db):
    """An approved lecturer — used in registration tests as a valid adviser."""
    user = CustomUser.objects.create_user(
        email='approved.lecturer@test.com',
        password='testpass123',
        full_name='Dr. Approved Lecturer',
        role=UserRole.LECTURER,
        is_approved=True,
        nidn='0011111111',
    )
    return user


@pytest.fixture
def pending_student(db):
    """A student who has registered but not yet been approved by admin."""
    user = CustomUser.objects.create_user(
        email='pending.student@test.com',
        password='testpass123',
        full_name='Pending Student',
        role=UserRole.STUDENT,
        is_approved=False,
        nim='20230999',
    )
    return user


@pytest.fixture
def pending_lecturer(db):
    """A lecturer who has registered but not yet been approved by admin."""
    user = CustomUser.objects.create_user(
        email='pending.lecturer@test.com',
        password='testpass123',
        full_name='Dr. Pending Lecturer',
        role=UserRole.LECTURER,
        is_approved=False,
        nidn='0022222222',
    )
    return user


@pytest.fixture
def authenticated_pending_student(api_client, pending_student):
    """APIClient authenticated as a pending (unapproved) student."""
    api_client.force_authenticate(user=pending_student)
    return api_client


# ── Plan 04 fixtures ───────────────────────────────────────────────────────────

@pytest.fixture
def symptom_category(db):
    """A single SymptomCategory for submission tests (Plan 04)."""
    from apps.symptoms.models import SymptomCategory
    cat, _ = SymptomCategory.objects.get_or_create(
        name='Test Methodology',
        defaults={'duration_minutes': 45},
    )
    return cat


@pytest.fixture
def second_approved_student(db):
    """A second approved student — used for non-owner file access tests (D-29, Plan 04)."""
    user = CustomUser.objects.create_user(
        email='second.student@test.com',
        password='testpass123',
        full_name='Second Student',
        role=UserRole.STUDENT,
        is_approved=True,
        nim='20230002',
    )
    return user


@pytest.fixture
def pdf_file():
    """A BytesIO with valid PDF magic bytes for upload tests (Plan 04)."""
    import io
    content = b'%PDF-1.4\n' + b'x' * 1015  # total ~1024 bytes
    buf = io.BytesIO(content)
    buf.name = 'test_draft.pdf'
    buf.seek(0)
    return buf


@pytest.fixture
def submission_factory(db, tmp_path, settings):
    """
    Factory fixture that creates a Submission + SubmissionFile on disk.
    Usage: submission_factory(student, symptom)
    Returns the SubmissionFile instance.
    """
    import uuid as _uuid
    import os
    settings.MEDIA_ROOT = str(tmp_path)

    def _make(student, symptom):
        from apps.submissions.models import Submission, SubmissionFile
        sub = Submission.objects.create(
            student=student,
            description='Factory submission',
            status='pending',
        )
        sub.symptoms.add(symptom)

        file_uuid = _uuid.uuid4()
        file_path = os.path.join(str(tmp_path), f'{file_uuid}.pdf')
        pdf_content = b'%PDF-1.4\n' + b'x' * 1015
        with open(file_path, 'wb') as f:
            f.write(pdf_content)

        sub_file = SubmissionFile.objects.create(
            submission=sub,
            uuid=file_uuid,
            original_filename='factory_draft.pdf',
            file_path=file_path,
            file_size=len(pdf_content),
        )
        return sub_file

    return _make
