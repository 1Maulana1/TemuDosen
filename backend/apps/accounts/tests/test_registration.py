"""
Tests for POST /api/auth/register/ and GET /api/users/lecturers/?approved=true (Plan 02).

Covers:
- Student registration (NIM, name, email, password, adviser_id)
- Lecturer registration (NIDN, name, email, password)
- Duplicate NIM / email validation with exact Bahasa Indonesia error copy (UI-SPEC)
- Adviser must be an approved lecturer
- Approved-lecturer dropdown filters out pending lecturers (Pitfall 7)
- New accounts default to is_approved=False (D-20)
- Role forced by serializer — cannot inject role=admin (T-1-06)
"""
import pytest
from apps.accounts.models import CustomUser, UserRole


@pytest.mark.django_db
class TestStudentRegistration:
    """POST /api/auth/register/ with role=student."""

    url = '/api/auth/register/'

    def test_student_register_creates_user(self, api_client, approved_lecturer):
        """Student registration creates a user with correct role + fields."""
        payload = {
            'role': 'student',
            'nim': '20230099',
            'full_name': 'Budi Mahasiswa',
            'email': 'budi@test.com',
            'password': 'secret1234',
            'adviser_id': approved_lecturer.id,
        }
        response = api_client.post(self.url, payload, format='json')
        assert response.status_code == 201, response.data
        user = CustomUser.objects.get(email='budi@test.com')
        assert user.role == UserRole.STUDENT
        assert user.nim == '20230099'
        assert user.is_approved is False  # D-20: new accounts unapproved
        assert user.adviser_id == approved_lecturer.id

    def test_student_defaults_to_unapproved(self, api_client, approved_lecturer):
        """Newly registered student has is_approved=False regardless of payload."""
        payload = {
            'role': 'student',
            'nim': '20230088',
            'full_name': 'Siti Mahasiswi',
            'email': 'siti@test.com',
            'password': 'secret1234',
            'adviser_id': approved_lecturer.id,
        }
        response = api_client.post(self.url, payload, format='json')
        assert response.status_code == 201
        assert response.data['is_approved'] is False

    def test_duplicate_nim_returns_400_with_exact_copy(self, api_client, approved_lecturer):
        """Duplicate NIM returns HTTP 400 with UI-SPEC error string (Copywriting Contract)."""
        # Create first student with this NIM
        CustomUser.objects.create_user(
            email='first@test.com',
            password='pass1234',
            full_name='First Student',
            role=UserRole.STUDENT,
            nim='20230001',
        )
        payload = {
            'role': 'student',
            'nim': '20230001',
            'full_name': 'Second Student',
            'email': 'second@test.com',
            'password': 'pass1234',
            'adviser_id': approved_lecturer.id,
        }
        response = api_client.post(self.url, payload, format='json')
        assert response.status_code == 400
        # Must contain exact UI-SPEC copy
        error_text = str(response.data)
        assert 'NIM ini sudah terdaftar' in error_text

    def test_duplicate_email_returns_400_with_exact_copy(self, api_client, approved_lecturer):
        """Duplicate email returns HTTP 400 with UI-SPEC error string."""
        CustomUser.objects.create_user(
            email='taken@test.com',
            password='pass1234',
            full_name='Existing User',
            role=UserRole.STUDENT,
        )
        payload = {
            'role': 'student',
            'nim': '20230055',
            'full_name': 'New Student',
            'email': 'taken@test.com',
            'password': 'pass1234',
            'adviser_id': approved_lecturer.id,
        }
        response = api_client.post(self.url, payload, format='json')
        assert response.status_code == 400
        error_text = str(response.data)
        assert 'Email ini sudah terdaftar' in error_text

    def test_adviser_must_be_approved_lecturer(self, api_client, pending_lecturer):
        """Registering with an unapproved adviser_id is rejected."""
        payload = {
            'role': 'student',
            'nim': '20230077',
            'full_name': 'Student With Bad Adviser',
            'email': 'bad@test.com',
            'password': 'pass1234',
            'adviser_id': pending_lecturer.id,
        }
        response = api_client.post(self.url, payload, format='json')
        assert response.status_code == 400

    def test_cannot_self_register_as_admin(self, api_client, approved_lecturer):
        """Role is forced by serializer — injecting role=admin is rejected (T-1-06)."""
        payload = {
            'role': 'admin',
            'nim': '20230066',
            'full_name': 'Evil User',
            'email': 'evil@test.com',
            'password': 'pass1234',
            'adviser_id': approved_lecturer.id,
        }
        response = api_client.post(self.url, payload, format='json')
        assert response.status_code == 400


@pytest.mark.django_db
class TestLecturerRegistration:
    """POST /api/auth/register/ with role=lecturer."""

    url = '/api/auth/register/'

    def test_lecturer_register_creates_user(self, api_client):
        """Lecturer registration creates a user with correct role."""
        payload = {
            'role': 'lecturer',
            'nidn': '0099887766',
            'full_name': 'Dr. Budi Dosen',
            'email': 'drbudi@test.com',
            'password': 'secret1234',
        }
        response = api_client.post(self.url, payload, format='json')
        assert response.status_code == 201, response.data
        user = CustomUser.objects.get(email='drbudi@test.com')
        assert user.role == UserRole.LECTURER
        assert user.nidn == '0099887766'
        assert user.is_approved is False  # D-20

    def test_lecturer_defaults_to_unapproved(self, api_client):
        """Newly registered lecturer has is_approved=False."""
        payload = {
            'role': 'lecturer',
            'nidn': '0011223344',
            'full_name': 'Dr. Pending',
            'email': 'pending.dosen@test.com',
            'password': 'secret1234',
        }
        response = api_client.post(self.url, payload, format='json')
        assert response.status_code == 201
        assert response.data['is_approved'] is False


@pytest.mark.django_db
class TestApprovedLecturerList:
    """GET /api/users/lecturers/?approved=true returns only approved lecturers (Pitfall 7)."""

    url = '/api/users/lecturers/'

    def test_returns_only_approved_lecturers(self, api_client, approved_lecturer, pending_lecturer):
        """Pending lecturers must NOT appear in the dropdown list."""
        response = api_client.get(self.url)
        assert response.status_code == 200
        ids = [u['id'] for u in response.data]
        assert approved_lecturer.id in ids
        assert pending_lecturer.id not in ids  # Pitfall 7 compliance

    def test_does_not_return_students(self, api_client, approved_lecturer, student_user):
        """Lecturer list does not include student accounts."""
        response = api_client.get(self.url)
        assert response.status_code == 200
        ids = [u['id'] for u in response.data]
        assert student_user.id not in ids

    def test_anonymous_can_access(self, api_client, approved_lecturer):
        """Anonymous users can hit this endpoint (needed for registration form)."""
        response = api_client.get(self.url)
        assert response.status_code == 200
