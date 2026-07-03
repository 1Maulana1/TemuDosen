"""
TDD RED — test_views.py for SymptomCategory ViewSet.

Asserts:
1. Admin can POST a new category (create), PATCH a duration (update), DELETE a category (destroy).
2. Non-admin (student/lecturer) GET is allowed (read) but POST/PATCH/DELETE returns 403.
3. Unauthenticated user gets 403 on all endpoints.
4. POST /api/symptoms/bulk-update/ persists all changes atomically (D-07) and is admin-only.
5. Bulk-update with invalid payload returns 400.
"""
import pytest
from django.urls import reverse

from apps.symptoms.models import SymptomCategory


@pytest.mark.django_db
class TestSymptomCategoryList:
    """GET /api/symptoms/ and POST /api/symptoms/"""

    def test_admin_can_list_categories(self, authenticated_admin):
        """Admin can GET the symptom list."""
        response = authenticated_admin.get('/api/symptoms/')
        assert response.status_code == 200

    def test_approved_student_can_list_categories(self, authenticated_student):
        """Approved student can GET the symptom list (read-only access)."""
        response = authenticated_student.get('/api/symptoms/')
        assert response.status_code == 200

    def test_approved_lecturer_can_list_categories(self, authenticated_lecturer):
        """Approved lecturer can GET the symptom list (read-only access)."""
        response = authenticated_lecturer.get('/api/symptoms/')
        assert response.status_code == 200

    def test_unauthenticated_user_cannot_list(self, api_client):
        """Unauthenticated user cannot GET the symptom list."""
        response = api_client.get('/api/symptoms/')
        assert response.status_code in (401, 403)

    def test_list_returns_six_seeded_categories(self, authenticated_student):
        """List endpoint returns all 6 seeded categories."""
        response = authenticated_student.get('/api/symptoms/')
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 6

    def test_admin_can_create_category(self, authenticated_admin):
        """Admin can POST a new symptom category (D-03)."""
        payload = {'name': 'Masalah teknis', 'category': 'Umum', 'duration_minutes': 20, 'is_active': True}
        response = authenticated_admin.post(
            '/api/symptoms/', data=payload, format='json'
        )
        assert response.status_code == 201
        assert SymptomCategory.objects.filter(name='Masalah teknis').exists()

    def test_student_cannot_create_category(self, authenticated_student):
        """Non-admin (student) cannot POST a new category — returns 403 (D-05, T-1-11)."""
        payload = {'name': 'Masalah teknis', 'duration_minutes': 20}
        response = authenticated_student.post(
            '/api/symptoms/', data=payload, format='json'
        )
        assert response.status_code == 403

    def test_lecturer_cannot_create_category(self, authenticated_lecturer):
        """Non-admin (lecturer) cannot POST a new category — returns 403 (D-05, T-1-11)."""
        payload = {'name': 'Masalah teknis', 'duration_minutes': 20}
        response = authenticated_lecturer.post(
            '/api/symptoms/', data=payload, format='json'
        )
        assert response.status_code == 403

    def test_create_with_invalid_duration_returns_400(self, authenticated_admin):
        """Creating a category with invalid duration returns 400 (T-1-12)."""
        payload = {'name': 'Test', 'duration_minutes': -10}
        response = authenticated_admin.post(
            '/api/symptoms/', data=payload, format='json'
        )
        assert response.status_code == 400


@pytest.mark.django_db
class TestSymptomCategoryDetail:
    """PATCH /api/symptoms/<id>/ and DELETE /api/symptoms/<id>/"""

    def test_admin_can_update_category_duration(self, authenticated_admin):
        """Admin can PATCH duration_minutes of a category (D-03)."""
        category = SymptomCategory.objects.get(name='Analisis data')
        response = authenticated_admin.patch(
            f'/api/symptoms/{category.pk}/',
            data={'duration_minutes': 60},
            format='json',
        )
        assert response.status_code == 200
        category.refresh_from_db()
        assert category.duration_minutes == 60

    def test_admin_can_delete_category(self, authenticated_admin):
        """Admin can DELETE a category (D-03)."""
        category = SymptomCategory.objects.create(
            name='Temporary Category', duration_minutes=15
        )
        response = authenticated_admin.delete(f'/api/symptoms/{category.pk}/')
        assert response.status_code == 204
        assert not SymptomCategory.objects.filter(pk=category.pk).exists()

    def test_student_cannot_update_category(self, authenticated_student):
        """Non-admin (student) cannot PATCH — returns 403 (T-1-11)."""
        category = SymptomCategory.objects.get(name='Analisis data')
        response = authenticated_student.patch(
            f'/api/symptoms/{category.pk}/',
            data={'duration_minutes': 999},
            format='json',
        )
        assert response.status_code == 403

    def test_student_cannot_delete_category(self, authenticated_student):
        """Non-admin (student) cannot DELETE — returns 403 (T-1-11)."""
        category = SymptomCategory.objects.get(name='Analisis data')
        response = authenticated_student.delete(f'/api/symptoms/{category.pk}/')
        assert response.status_code == 403

    def test_lecturer_cannot_update_category(self, authenticated_lecturer):
        """Non-admin (lecturer) cannot PATCH — returns 403 (T-1-11)."""
        category = SymptomCategory.objects.get(name='Analisis data')
        response = authenticated_lecturer.patch(
            f'/api/symptoms/{category.pk}/',
            data={'duration_minutes': 999},
            format='json',
        )
        assert response.status_code == 403


@pytest.mark.django_db
class TestBulkUpdate:
    """POST /api/symptoms/bulk-update/ — atomic bulk weight update (D-07)."""

    def test_admin_can_bulk_update(self, authenticated_admin):
        """Admin can POST bulk-update with a list of {id, duration_minutes} and changes persist."""
        cat1 = SymptomCategory.objects.get(name='Analisis data')
        cat2 = SymptomCategory.objects.get(name='Manajemen waktu')
        payload = [
            {'id': cat1.pk, 'duration_minutes': 90},
            {'id': cat2.pk, 'duration_minutes': 75},
        ]
        response = authenticated_admin.post(
            '/api/symptoms/bulk-update/',
            data=payload,
            format='json',
        )
        assert response.status_code == 200
        cat1.refresh_from_db()
        cat2.refresh_from_db()
        assert cat1.duration_minutes == 90
        assert cat2.duration_minutes == 75

    def test_admin_bulk_update_can_also_update_name(self, authenticated_admin):
        """Admin can pass name in bulk-update payload and it persists."""
        category = SymptomCategory.objects.get(name='Manajemen waktu')
        payload = [{'id': category.pk, 'name': 'Manajemen waktu & jadwal', 'duration_minutes': 35}]
        response = authenticated_admin.post(
            '/api/symptoms/bulk-update/',
            data=payload,
            format='json',
        )
        assert response.status_code == 200
        category.refresh_from_db()
        assert category.name == 'Manajemen waktu & jadwal'
        assert category.duration_minutes == 35

    def test_student_cannot_bulk_update(self, authenticated_student):
        """Non-admin (student) cannot POST bulk-update — returns 403 (T-1-11)."""
        cat = SymptomCategory.objects.first()
        payload = [{'id': cat.pk, 'duration_minutes': 999}]
        response = authenticated_student.post(
            '/api/symptoms/bulk-update/',
            data=payload,
            format='json',
        )
        assert response.status_code == 403

    def test_lecturer_cannot_bulk_update(self, authenticated_lecturer):
        """Non-admin (lecturer) cannot POST bulk-update — returns 403 (T-1-11)."""
        cat = SymptomCategory.objects.first()
        payload = [{'id': cat.pk, 'duration_minutes': 999}]
        response = authenticated_lecturer.post(
            '/api/symptoms/bulk-update/',
            data=payload,
            format='json',
        )
        assert response.status_code == 403

    def test_unauthenticated_cannot_bulk_update(self, api_client):
        """Unauthenticated user cannot POST bulk-update."""
        cat = SymptomCategory.objects.first()
        payload = [{'id': cat.pk, 'duration_minutes': 999}]
        response = api_client.post(
            '/api/symptoms/bulk-update/',
            data=payload,
            format='json',
        )
        assert response.status_code in (401, 403)

    def test_bulk_update_with_invalid_id_returns_400(self, authenticated_admin):
        """Bulk-update with non-existent ID returns 400."""
        payload = [{'id': 99999, 'duration_minutes': 30}]
        response = authenticated_admin.post(
            '/api/symptoms/bulk-update/',
            data=payload,
            format='json',
        )
        assert response.status_code == 400

    def test_bulk_update_empty_payload_returns_400(self, authenticated_admin):
        """Bulk-update with empty list returns 400."""
        response = authenticated_admin.post(
            '/api/symptoms/bulk-update/',
            data=[],
            format='json',
        )
        assert response.status_code == 400
