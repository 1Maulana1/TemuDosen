"""
Audit T2 — thesis (skripsi) progress checklist. Replaces the previously-static
"Progres Skripsi" mock on the student dashboard with a real, per-student model.

Covers:
  GET   /api/thesis-progress/        → ThesisProgressView (seed + percent)
  PATCH /api/thesis-progress/<id>/   → ThesisChapterUpdateView (toggle)
"""
import pytest
from rest_framework.test import APIClient

from apps.submissions.models import ThesisChapter


def client_for(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


URL = '/api/thesis-progress/'


@pytest.mark.django_db
class TestThesisProgressView:
    def test_get_seeds_default_chapters_on_first_access(self, student_user):
        assert ThesisChapter.objects.filter(student=student_user).count() == 0

        resp = client_for(student_user).get(URL)
        assert resp.status_code == 200
        assert resp.data['total'] == len(ThesisChapter.DEFAULT_TITLES)
        assert resp.data['completed'] == 0
        assert resp.data['percent'] == 0
        assert [c['title'] for c in resp.data['chapters']] == ThesisChapter.DEFAULT_TITLES
        # seeded exactly once in the DB
        assert ThesisChapter.objects.filter(student=student_user).count() == 5

    def test_get_is_idempotent(self, student_user):
        client_for(student_user).get(URL)
        client_for(student_user).get(URL)
        assert ThesisChapter.objects.filter(student=student_user).count() == 5

    def test_percent_reflects_completed_chapters(self, student_user):
        client_for(student_user).get(URL)
        chapters = list(ThesisChapter.objects.filter(student=student_user).order_by('order'))
        client_for(student_user).patch(f'{URL}{chapters[0].id}/', {'is_completed': True}, format='json')
        client_for(student_user).patch(f'{URL}{chapters[1].id}/', {'is_completed': True}, format='json')

        resp = client_for(student_user).get(URL)
        assert resp.data['completed'] == 2
        assert resp.data['percent'] == 40  # 2/5

    def test_lecturer_forbidden(self, lecturer_user):
        assert client_for(lecturer_user).get(URL).status_code == 403


@pytest.mark.django_db
class TestThesisChapterUpdateView:
    def _chapter(self, student):
        client_for(student).get(URL)  # seed
        return ThesisChapter.objects.filter(student=student).order_by('order').first()

    def test_student_can_toggle_own_chapter(self, student_user):
        chapter = self._chapter(student_user)
        resp = client_for(student_user).patch(f'{URL}{chapter.id}/', {'is_completed': True}, format='json')
        assert resp.status_code == 200
        assert resp.data['is_completed'] is True
        chapter.refresh_from_db()
        assert chapter.is_completed is True

    def test_toggle_back_to_incomplete(self, student_user):
        chapter = self._chapter(student_user)
        chapter.is_completed = True
        chapter.save(update_fields=['is_completed'])
        resp = client_for(student_user).patch(f'{URL}{chapter.id}/', {'is_completed': False}, format='json')
        assert resp.status_code == 200
        assert resp.data['is_completed'] is False

    def test_non_boolean_rejected(self, student_user):
        chapter = self._chapter(student_user)
        resp = client_for(student_user).patch(f'{URL}{chapter.id}/', {'is_completed': 'yes'}, format='json')
        assert resp.status_code == 400

    def test_cannot_toggle_another_students_chapter(self, student_user, second_approved_student):
        chapter = self._chapter(student_user)
        resp = client_for(second_approved_student).patch(
            f'{URL}{chapter.id}/', {'is_completed': True}, format='json')
        assert resp.status_code == 404  # scoped to own → looks nonexistent

    def test_missing_chapter_404(self, student_user):
        resp = client_for(student_user).patch(f'{URL}999999/', {'is_completed': True}, format='json')
        assert resp.status_code == 404
