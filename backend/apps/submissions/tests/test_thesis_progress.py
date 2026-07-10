"""
Audit T2 — thesis (skripsi) progress checklist. Replaces the previously-static
"Progres Skripsi" mock on the student dashboard with a real, per-student model.

Covers:
  GET /api/thesis-progress/ → ThesisProgressView (seed + percent, read-only for
  the student — chapters are marked by the advising lecturer, see below).
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
        client_for(student_user).get(URL)  # seed
        chapters = list(ThesisChapter.objects.filter(student=student_user).order_by('order'))
        chapters[0].is_completed = True
        chapters[0].save(update_fields=['is_completed'])
        chapters[1].is_completed = True
        chapters[1].save(update_fields=['is_completed'])

        resp = client_for(student_user).get(URL)
        assert resp.data['completed'] == 2
        assert resp.data['percent'] == 40  # 2/5

    def test_lecturer_forbidden(self, lecturer_user):
        assert client_for(lecturer_user).get(URL).status_code == 403


# ── Lecturer-side (advisee) thesis progress ───────────────────────────────────
#
# Penandaan bab kini otoritatif di sisi dosen; mahasiswa read-only. Endpoint dosen
# dibatasi ke advisee-nya (student.adviser == request.user).

def _lecturer_url(student_id, chapter_id=None):
    base = f'/api/thesis-progress/lecturer/{student_id}/'
    return f'{base}{chapter_id}/' if chapter_id is not None else base


@pytest.mark.django_db
class TestLecturerThesisProgressView:
    def test_adviser_can_read_and_seeds_chapters(self, student_user, lecturer_user):
        student_user.adviser = lecturer_user
        student_user.save(update_fields=['adviser'])
        assert ThesisChapter.objects.filter(student=student_user).count() == 0

        resp = client_for(lecturer_user).get(_lecturer_url(student_user.id))
        assert resp.status_code == 200
        assert resp.data['total'] == len(ThesisChapter.DEFAULT_TITLES)
        assert resp.data['percent'] == 0
        assert ThesisChapter.objects.filter(student=student_user).count() == 5

    def test_non_adviser_lecturer_404(self, student_user, lecturer_user):
        # student_user has no adviser → not this lecturer's advisee
        resp = client_for(lecturer_user).get(_lecturer_url(student_user.id))
        assert resp.status_code == 404

    def test_student_forbidden_on_lecturer_endpoint(self, student_user, lecturer_user):
        student_user.adviser = lecturer_user
        student_user.save(update_fields=['adviser'])
        resp = client_for(student_user).get(_lecturer_url(student_user.id))
        assert resp.status_code == 403


@pytest.mark.django_db
class TestLecturerThesisChapterUpdateView:
    def _setup(self, student, lecturer):
        student.adviser = lecturer
        student.save(update_fields=['adviser'])
        chapters = ThesisChapter.ensure_for(student)
        return chapters.order_by('order').first()

    def test_adviser_can_toggle_advisee_chapter(self, student_user, lecturer_user):
        chapter = self._setup(student_user, lecturer_user)
        resp = client_for(lecturer_user).patch(
            _lecturer_url(student_user.id, chapter.id), {'is_completed': True}, format='json')
        assert resp.status_code == 200
        assert resp.data['is_completed'] is True
        chapter.refresh_from_db()
        assert chapter.is_completed is True

    def test_toggle_reflected_in_student_own_view(self, student_user, lecturer_user):
        chapter = self._setup(student_user, lecturer_user)
        client_for(lecturer_user).patch(
            _lecturer_url(student_user.id, chapter.id), {'is_completed': True}, format='json')
        resp = client_for(student_user).get(URL)
        assert resp.data['completed'] == 1
        assert resp.data['percent'] == 20

    def test_non_adviser_lecturer_cannot_toggle(self, student_user, lecturer_user):
        # seed chapters but do NOT set adviser
        chapter = ThesisChapter.ensure_for(student_user).order_by('order').first()
        resp = client_for(lecturer_user).patch(
            _lecturer_url(student_user.id, chapter.id), {'is_completed': True}, format='json')
        assert resp.status_code == 404
        chapter.refresh_from_db()
        assert chapter.is_completed is False

    def test_non_boolean_rejected(self, student_user, lecturer_user):
        chapter = self._setup(student_user, lecturer_user)
        resp = client_for(lecturer_user).patch(
            _lecturer_url(student_user.id, chapter.id), {'is_completed': 'yes'}, format='json')
        assert resp.status_code == 400

    def test_student_forbidden(self, student_user, lecturer_user):
        chapter = self._setup(student_user, lecturer_user)
        resp = client_for(student_user).patch(
            _lecturer_url(student_user.id, chapter.id), {'is_completed': True}, format='json')
        assert resp.status_code == 403
