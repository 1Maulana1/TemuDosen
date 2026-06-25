"""
Lecturer submission list view tests — Plan 05 (REVIEW-01).

TDD behaviors (RED phase — all tests fail before implementation):

T-1: Lecturer GET /api/submissions/ returns only their own advisees' submissions (REVIEW-01 isolation).
T-2: Lecturer cannot see another lecturer's students' submissions.
T-3: The serialized list includes student NIM, name, symptom names, status, created_at,
     original_filename, and file_url pointing at /api/files/<uuid>/ (D-10).
T-4: ?status=pending filters to pending submissions; other statuses are supported (D-09).
T-5: ?search=<nim> matches by student NIM (D-11).
T-6: ?search=<name> matches by student full_name (D-11).
T-7: ?ordering=created_at sorts ascending (D-11).
T-8: A student hitting the lecturer endpoint is rejected with 403.
T-9: An unapproved user hitting the lecturer endpoint is rejected with 403.
T-10: Unauthenticated request is rejected.
"""
import io
import os
import uuid as _uuid

import pytest
from django.urls import reverse
from rest_framework import status

from apps.accounts.models import CustomUser, UserRole
from apps.submissions.models import Submission, SubmissionFile
from apps.symptoms.models import SymptomCategory


# ── Fixtures ───────────────────────────────────────────────────────────────────

@pytest.fixture
def lecturer_a(db):
    """Approved lecturer A (primary test lecturer)."""
    return CustomUser.objects.create_user(
        email='lecturer.a@test.com',
        password='testpass123',
        full_name='Dr. Rina Sari',
        role=UserRole.LECTURER,
        is_approved=True,
        nidn='0011223344',
    )


@pytest.fixture
def lecturer_b(db):
    """Approved lecturer B (second lecturer for isolation test)."""
    return CustomUser.objects.create_user(
        email='lecturer.b@test.com',
        password='testpass123',
        full_name='Dr. Budi Santoso',
        role=UserRole.LECTURER,
        is_approved=True,
        nidn='0055667788',
    )


@pytest.fixture
def student_of_a(db, lecturer_a):
    """Approved student assigned to lecturer A."""
    return CustomUser.objects.create_user(
        email='student.a1@test.com',
        password='testpass123',
        full_name='Ahmad Fauzi',
        role=UserRole.STUDENT,
        is_approved=True,
        nim='20230101',
        adviser=lecturer_a,
    )


@pytest.fixture
def student_of_b(db, lecturer_b):
    """Approved student assigned to lecturer B (isolation test)."""
    return CustomUser.objects.create_user(
        email='student.b1@test.com',
        password='testpass123',
        full_name='Budi Rahayu',
        role=UserRole.STUDENT,
        is_approved=True,
        nim='20230202',
        adviser=lecturer_b,
    )


@pytest.fixture
def symptom(db):
    """A SymptomCategory for submission tests."""
    cat, _ = SymptomCategory.objects.get_or_create(
        name='Analisis Data',
        defaults={'duration_minutes': 45},
    )
    return cat


def make_submission(student, symptom, tmp_path, status_val='pending'):
    """Helper: create a Submission + SubmissionFile on disk."""
    sub = Submission.objects.create(
        student=student,
        description='Test submission',
        status=status_val,
    )
    sub.symptoms.add(symptom)

    file_uuid = _uuid.uuid4()
    file_path = os.path.join(str(tmp_path), f'{file_uuid}.pdf')
    pdf_content = b'%PDF-1.4\n' + b'x' * 1015
    os.makedirs(str(tmp_path), exist_ok=True)
    with open(file_path, 'wb') as f:
        f.write(pdf_content)

    sub_file = SubmissionFile.objects.create(
        submission=sub,
        uuid=file_uuid,
        original_filename='draft.pdf',
        file_path=file_path,
        file_size=len(pdf_content),
    )
    return sub, sub_file


# ── Tests ──────────────────────────────────────────────────────────────────────

LECTURER_URL = '/api/submissions/lecturer/'


class TestLecturerSubmissionListIsolation:
    """REVIEW-01: Lecturer sees only their own advisees' submissions."""

    @pytest.mark.django_db
    def test_lecturer_sees_own_advisee_submissions(
        self, api_client, lecturer_a, student_of_a, symptom, tmp_path, settings
    ):
        """T-1: Lecturer A sees submissions from their own advisee."""
        settings.MEDIA_ROOT = str(tmp_path)
        sub, _ = make_submission(student_of_a, symptom, tmp_path)

        api_client.force_authenticate(user=lecturer_a)
        response = api_client.get(LECTURER_URL)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]['id'] == sub.id

    @pytest.mark.django_db
    def test_lecturer_cannot_see_other_lecturers_submissions(
        self, api_client, lecturer_a, lecturer_b, student_of_b, symptom, tmp_path, settings
    ):
        """T-2: Lecturer A cannot see submissions belonging to lecturer B's students."""
        settings.MEDIA_ROOT = str(tmp_path)
        make_submission(student_of_b, symptom, tmp_path)

        api_client.force_authenticate(user=lecturer_a)
        response = api_client.get(LECTURER_URL)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 0  # A sees nothing — submission belongs to B's student


class TestLecturerSubmissionListFields:
    """D-10: Serialized list includes all required fields."""

    @pytest.mark.django_db
    def test_serializer_returns_d10_columns(
        self, api_client, lecturer_a, student_of_a, symptom, tmp_path, settings
    ):
        """T-3: Each item includes student_nim, student_name, symptom_names, status,
        created_at, original_filename, and file_url pointing at /api/files/<uuid>/ (D-10)."""
        settings.MEDIA_ROOT = str(tmp_path)
        sub, sub_file = make_submission(student_of_a, symptom, tmp_path)

        api_client.force_authenticate(user=lecturer_a)
        response = api_client.get(LECTURER_URL)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        item = data[0]

        # D-10 columns
        assert item['student_nim'] == '20230101'
        assert item['student_name'] == 'Ahmad Fauzi'
        assert isinstance(item['symptom_names'], list)
        assert 'Analisis Data' in item['symptom_names']
        assert item['status'] == 'pending'
        assert 'created_at' in item
        assert item['original_filename'] == 'draft.pdf'
        # file_url must point at /api/files/<uuid>/ — NOT a media path
        assert f'/api/files/{sub_file.uuid}/' in item['file_url']


class TestLecturerSubmissionListFilters:
    """D-09 / D-11: Filtering, searching, ordering."""

    @pytest.mark.django_db
    def test_status_filter_pending(
        self, api_client, lecturer_a, student_of_a, symptom, tmp_path, settings
    ):
        """T-4: ?status=pending returns only pending submissions."""
        settings.MEDIA_ROOT = str(tmp_path)
        make_submission(student_of_a, symptom, tmp_path, status_val='pending')
        make_submission(student_of_a, symptom, tmp_path, status_val='approved')

        api_client.force_authenticate(user=lecturer_a)
        response = api_client.get(LECTURER_URL + '?status=pending')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]['status'] == 'pending'

    @pytest.mark.django_db
    def test_search_by_nim(
        self, api_client, lecturer_a, student_of_a, symptom, tmp_path, settings
    ):
        """T-5: ?search=<nim> returns matching submissions."""
        settings.MEDIA_ROOT = str(tmp_path)
        make_submission(student_of_a, symptom, tmp_path)

        api_client.force_authenticate(user=lecturer_a)
        response = api_client.get(LECTURER_URL + '?search=20230101')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]['student_nim'] == '20230101'

    @pytest.mark.django_db
    def test_search_by_name(
        self, api_client, lecturer_a, student_of_a, symptom, tmp_path, settings
    ):
        """T-6: ?search=<name> returns matching submissions."""
        settings.MEDIA_ROOT = str(tmp_path)
        make_submission(student_of_a, symptom, tmp_path)

        api_client.force_authenticate(user=lecturer_a)
        response = api_client.get(LECTURER_URL + '?search=Ahmad')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 1
        assert data[0]['student_name'] == 'Ahmad Fauzi'

    @pytest.mark.django_db
    def test_ordering_by_created_at(
        self, api_client, lecturer_a, student_of_a, symptom, tmp_path, settings
    ):
        """T-7: ?ordering=created_at sorts ascending."""
        settings.MEDIA_ROOT = str(tmp_path)
        sub1, _ = make_submission(student_of_a, symptom, tmp_path)
        sub2, _ = make_submission(student_of_a, symptom, tmp_path)

        api_client.force_authenticate(user=lecturer_a)
        response = api_client.get(LECTURER_URL + '?ordering=created_at')

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2
        # Ascending order: older submission first
        assert data[0]['id'] == sub1.id
        assert data[1]['id'] == sub2.id


class TestLecturerSubmissionListPermissions:
    """Privilege boundary tests — T-1-22."""

    @pytest.mark.django_db
    def test_student_cannot_access_lecturer_list(
        self, api_client, student_of_a
    ):
        """T-8: A student hitting the lecturer list endpoint is rejected (403)."""
        api_client.force_authenticate(user=student_of_a)
        response = api_client.get(LECTURER_URL)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_unapproved_user_cannot_access_lecturer_list(
        self, api_client, db
    ):
        """T-9: An unapproved user is rejected (403)."""
        unapproved = CustomUser.objects.create_user(
            email='unapproved.lecturer@test.com',
            password='testpass123',
            full_name='Unapproved Lecturer',
            role=UserRole.LECTURER,
            is_approved=False,
            nidn='0099999999',
        )
        api_client.force_authenticate(user=unapproved)
        response = api_client.get(LECTURER_URL)
        assert response.status_code == status.HTTP_403_FORBIDDEN

    @pytest.mark.django_db
    def test_unauthenticated_request_rejected(self, api_client):
        """T-10: Unauthenticated request to lecturer list is rejected."""
        response = api_client.get(LECTURER_URL)
        assert response.status_code in (
            status.HTTP_403_FORBIDDEN, status.HTTP_401_UNAUTHORIZED
        )
