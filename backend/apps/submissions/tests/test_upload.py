"""
Submission upload tests — Task 1 TDD behaviors (TRIAGE-01, TRIAGE-02, D-13, D-26, D-27).

Tests:
- T-1: Approved student POSTing symptom_ids + valid <=5MB PDF → 201 with Submission (status=pending) and SubmissionFile (UUID name, written to MEDIA_ROOT)
- T-2: POST with no symptom_ids → 400 with "Pilih minimal satu gejala akademik."
- T-3: POST with no file → 400 with "Unggah file PDF draft sebelum melanjutkan."
- T-4: POST >5MB file → 400 with "Ukuran file melebihi batas 5MB..." and NO file written to disk
- T-5: POST wrong MIME bytes (renamed non-PDF) → 400 with "Hanya file PDF yang diizinkan." (magic-bytes check)
"""
import io
import os
import pytest
from django.conf import settings
from rest_framework import status


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_pdf_file(size_bytes: int = 1024, valid_magic: bool = True) -> io.BytesIO:
    """Return a BytesIO fake PDF (or fake PNG) at the given size."""
    if valid_magic:
        # PDF magic bytes: %PDF-
        content = b'%PDF-1.4\n' + b'x' * max(0, size_bytes - 9)
    else:
        # PNG magic bytes: \x89PNG
        content = b'\x89PNG\r\n\x1a\n' + b'x' * max(0, size_bytes - 8)
    buf = io.BytesIO(content)
    buf.name = 'test.pdf'
    buf.seek(0)
    return buf


FIVE_MB = 5 * 1024 * 1024
SIX_MB = 6 * 1024 * 1024 - 1  # just under Django transport limit to avoid 413


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def student_with_adviser(db):
    """Approved student linked to an approved lecturer (adviser)."""
    from apps.accounts.models import CustomUser, UserRole
    lecturer = CustomUser.objects.create_user(
        email='adviser.upload@test.com',
        password='pass',
        full_name='Dr. Upload Adviser',
        role=UserRole.LECTURER,
        is_approved=True,
        nidn='0099000001',
    )
    student = CustomUser.objects.create_user(
        email='student.upload@test.com',
        password='pass',
        full_name='Upload Student',
        role=UserRole.STUDENT,
        is_approved=True,
        nim='20230100',
        adviser=lecturer,
    )
    return student


@pytest.fixture
def symptom(db):
    """One active SymptomCategory for submission tests."""
    from apps.symptoms.models import SymptomCategory
    cat, _ = SymptomCategory.objects.get_or_create(
        name='Test Symptom Upload',
        defaults={'duration_minutes': 30},
    )
    return cat


@pytest.fixture
def auth_student_client(api_client, student_with_adviser):
    """APIClient authenticated as student_with_adviser."""
    api_client.force_authenticate(user=student_with_adviser)
    return api_client


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.django_db
class TestSubmissionCreate:
    def test_valid_submission_creates_pending_submission(self, auth_student_client, symptom, tmp_path, settings):
        """Approved student with symptom_ids + valid PDF → 201, status=pending, UUID file on disk."""
        settings.MEDIA_ROOT = str(tmp_path)
        pdf = make_pdf_file(size_bytes=1024)

        response = auth_student_client.post(
            '/api/submissions/',
            data={
                'symptom_ids': [symptom.id],
                'description': 'Test description',
                'draft_file': pdf,
            },
            format='multipart',
        )

        assert response.status_code == status.HTTP_201_CREATED, response.data
        assert response.data['status'] == 'pending'
        assert 'file_uuid' in response.data

    def test_valid_submission_writes_file_to_disk(self, auth_student_client, symptom, tmp_path, settings):
        """File must be written to MEDIA_ROOT with a UUID-based name."""
        settings.MEDIA_ROOT = str(tmp_path)
        pdf = make_pdf_file(size_bytes=2048)

        response = auth_student_client.post(
            '/api/submissions/',
            data={
                'symptom_ids': [symptom.id],
                'draft_file': pdf,
            },
            format='multipart',
        )

        assert response.status_code == status.HTTP_201_CREATED, response.data
        # The file should exist on disk
        from apps.submissions.models import SubmissionFile
        file_obj = SubmissionFile.objects.first()
        assert file_obj is not None
        assert os.path.exists(file_obj.file_path)

    def test_missing_symptom_ids_returns_400_with_exact_copy(self, auth_student_client, tmp_path, settings):
        """POST with no symptom_ids → 400 with 'Pilih minimal satu gejala akademik.'"""
        settings.MEDIA_ROOT = str(tmp_path)
        pdf = make_pdf_file()

        response = auth_student_client.post(
            '/api/submissions/',
            data={
                'symptom_ids': [],  # empty — invalid
                'draft_file': pdf,
            },
            format='multipart',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        error_text = str(response.data)
        assert 'Pilih minimal satu gejala akademik.' in error_text

    def test_missing_file_returns_400_with_exact_copy(self, auth_student_client, symptom):
        """POST with no file → 400 with 'Unggah file PDF draft sebelum melanjutkan.'"""
        response = auth_student_client.post(
            '/api/submissions/',
            data={
                'symptom_ids': [symptom.id],
                # no draft_file
            },
            format='multipart',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        error_text = str(response.data)
        assert 'Unggah file PDF draft sebelum melanjutkan.' in error_text

    def test_oversized_file_returns_400_and_no_file_on_disk(self, auth_student_client, symptom, tmp_path, settings):
        """POST >5MB file → 400 with size error, NO file written to disk."""
        settings.MEDIA_ROOT = str(tmp_path)
        # Create a file slightly over 5MB
        over_5mb = make_pdf_file(size_bytes=FIVE_MB + 1024)

        response = auth_student_client.post(
            '/api/submissions/',
            data={
                'symptom_ids': [symptom.id],
                'draft_file': over_5mb,
            },
            format='multipart',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        error_text = str(response.data)
        assert 'Ukuran file melebihi batas 5MB' in error_text

        # Ensure no file was written to disk
        files_on_disk = list(tmp_path.iterdir())
        assert len(files_on_disk) == 0, f"File was written to disk: {files_on_disk}"

    def test_wrong_mime_bytes_returns_400_and_no_file_on_disk(self, auth_student_client, symptom, tmp_path, settings):
        """POST file with non-PDF magic bytes (renamed .pdf) → 400 with MIME error, NO file on disk."""
        settings.MEDIA_ROOT = str(tmp_path)
        # PNG bytes disguised as a .pdf
        fake_pdf = make_pdf_file(valid_magic=False)

        response = auth_student_client.post(
            '/api/submissions/',
            data={
                'symptom_ids': [symptom.id],
                'draft_file': fake_pdf,
            },
            format='multipart',
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        error_text = str(response.data)
        assert 'Hanya file PDF yang diizinkan.' in error_text

        # Ensure no file was written to disk
        files_on_disk = list(tmp_path.iterdir())
        assert len(files_on_disk) == 0, f"File was written to disk: {files_on_disk}"

    def test_unauthenticated_returns_403(self, api_client, symptom, tmp_path, settings):
        """Unauthenticated POST → 403."""
        settings.MEDIA_ROOT = str(tmp_path)
        pdf = make_pdf_file()

        response = api_client.post(
            '/api/submissions/',
            data={
                'symptom_ids': [symptom.id],
                'draft_file': pdf,
            },
            format='multipart',
        )

        assert response.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_401_UNAUTHORIZED)

    def test_unapproved_student_returns_403(self, api_client, db, symptom, tmp_path, settings):
        """Unapproved student POST → 403."""
        settings.MEDIA_ROOT = str(tmp_path)
        from apps.accounts.models import CustomUser, UserRole
        unapproved = CustomUser.objects.create_user(
            email='unapproved.upload@test.com',
            password='pass',
            full_name='Unapproved Student',
            role=UserRole.STUDENT,
            is_approved=False,
            nim='20230200',
        )
        api_client.force_authenticate(user=unapproved)
        pdf = make_pdf_file()

        response = api_client.post(
            '/api/submissions/',
            data={
                'symptom_ids': [symptom.id],
                'draft_file': pdf,
            },
            format='multipart',
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
