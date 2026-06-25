"""
File access (D-29) tests — Task 1 TDD behaviors.

Tests:
- GET /api/files/<uuid>/ unauthenticated → 403
- GET /api/files/<uuid>/ as non-owner, non-adviser approved student → 403
- GET /api/files/<uuid>/ as the owning student → 200 with content_type application/pdf
- GET /api/files/<uuid>/ as the student's adviser → 200 with content_type application/pdf
- GET /api/files/<uuid>/ as admin → 200
"""
import io
import os
import pytest
from rest_framework import status


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_pdf_content(size_bytes: int = 1024) -> bytes:
    return b'%PDF-1.4\n' + b'x' * max(0, size_bytes - 9)


def create_submission_with_file(student, symptom, tmp_path):
    """Create a Submission + SubmissionFile on disk and return the SubmissionFile."""
    import uuid as _uuid
    from apps.submissions.models import Submission, SubmissionFile

    sub = Submission.objects.create(
        student=student,
        description='Test',
        status='pending',
    )
    sub.symptoms.add(symptom)

    file_uuid = _uuid.uuid4()
    file_path = os.path.join(str(tmp_path), f'{file_uuid}.pdf')
    with open(file_path, 'wb') as f:
        f.write(make_pdf_content())

    sub_file = SubmissionFile.objects.create(
        submission=sub,
        uuid=file_uuid,
        original_filename='test_draft.pdf',
        file_path=file_path,
        file_size=1024,
    )
    return sub_file


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def adviser(db):
    from apps.accounts.models import CustomUser, UserRole
    return CustomUser.objects.create_user(
        email='file.adviser@test.com',
        password='pass',
        full_name='Dr. File Adviser',
        role=UserRole.LECTURER,
        is_approved=True,
        nidn='0099000010',
    )


@pytest.fixture
def owner_student(db, adviser):
    from apps.accounts.models import CustomUser, UserRole
    return CustomUser.objects.create_user(
        email='file.student@test.com',
        password='pass',
        full_name='File Owner Student',
        role=UserRole.STUDENT,
        is_approved=True,
        nim='20230300',
        adviser=adviser,
    )


@pytest.fixture
def other_student(db):
    """A different approved student who does NOT own the file."""
    from apps.accounts.models import CustomUser, UserRole
    return CustomUser.objects.create_user(
        email='other.student@test.com',
        password='pass',
        full_name='Other Student',
        role=UserRole.STUDENT,
        is_approved=True,
        nim='20230301',
    )


@pytest.fixture
def symptom_for_file(db):
    from apps.symptoms.models import SymptomCategory
    cat, _ = SymptomCategory.objects.get_or_create(
        name='Test Symptom File',
        defaults={'duration_minutes': 30},
    )
    return cat


@pytest.fixture
def submission_file(db, owner_student, symptom_for_file, tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    return create_submission_with_file(owner_student, symptom_for_file, tmp_path)


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestFileServing:
    def test_unauthenticated_returns_403(self, api_client, submission_file):
        """GET /api/files/<uuid>/ without auth → 403."""
        url = f'/api/files/{submission_file.uuid}/'
        response = api_client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_non_owner_non_adviser_returns_403(self, api_client, submission_file, other_student):
        """GET /api/files/<uuid>/ as unrelated student → 403."""
        api_client.force_authenticate(user=other_student)
        url = f'/api/files/{submission_file.uuid}/'
        response = api_client.get(url)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_owner_student_returns_200(self, api_client, submission_file, owner_student):
        """GET /api/files/<uuid>/ as the owning student → 200 with PDF content type."""
        api_client.force_authenticate(user=owner_student)
        url = f'/api/files/{submission_file.uuid}/'
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response['Content-Type'] == 'application/pdf'

    def test_adviser_returns_200(self, api_client, submission_file, adviser):
        """GET /api/files/<uuid>/ as the student's adviser → 200 with PDF content type."""
        api_client.force_authenticate(user=adviser)
        url = f'/api/files/{submission_file.uuid}/'
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK
        assert response['Content-Type'] == 'application/pdf'

    def test_admin_returns_200(self, api_client, submission_file, admin_user):
        """GET /api/files/<uuid>/ as admin → 200."""
        api_client.force_authenticate(user=admin_user)
        url = f'/api/files/{submission_file.uuid}/'
        response = api_client.get(url)
        assert response.status_code == status.HTTP_200_OK

    def test_nonexistent_uuid_returns_404(self, api_client, owner_student):
        """GET /api/files/<nonexistent-uuid>/ → 404."""
        import uuid
        api_client.force_authenticate(user=owner_student)
        url = f'/api/files/{uuid.uuid4()}/'
        response = api_client.get(url)
        assert response.status_code == status.HTTP_404_NOT_FOUND
