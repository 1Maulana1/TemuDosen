"""
Phase 7 — Advisory Continuity (FR-KP04): action items ("saran") attached to a
session, student follow-up marking, and the ketua jurusan compliance report.

Covers:
  GET/POST /api/queue/<session_id>/action-items/  → SessionActionItemsView
  POST     /api/action-items/<id>/complete/       → CompleteActionItemView
  GET      /api/ketua-jurusan/compliance/                → KetuaJurusanComplianceView
"""
import pytest
from rest_framework.test import APIClient

from apps.bimbingan.models import ActionItem, Session, SystemLog


def client_for(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _approve(lecturer, submission):
    resp = client_for(lecturer).post(
        f'/api/submissions/{submission.id}/approve/', {'method': 'offline'}, format='json'
    )
    assert resp.status_code == 200, resp.data
    return Session.objects.get(submission=submission)


def action_items_url(session_id):
    return f'/api/queue/{session_id}/action-items/'


def complete_url(pk):
    return f'/api/action-items/{pk}/complete/'


ADVICE_HISTORY_URL = '/api/queue/lecturer/advice-history/'


@pytest.mark.django_db
class TestSessionActionItemsView:
    def test_lecturer_can_add_an_action_item(self, lecturer_user, pending_submission):
        session = _approve(lecturer_user, pending_submission)

        resp = client_for(lecturer_user).post(
            action_items_url(session.id),
            {'description': 'Perbaiki bab metodologi sesuai catatan'},
            format='json',
        )
        assert resp.status_code == 201
        assert resp.data['is_completed'] is False
        assert ActionItem.objects.filter(session=session).count() == 1

    def test_student_cannot_add_an_action_item(
        self, lecturer_user, advisee_student, pending_submission
    ):
        """Only the dosen gives advice — the student side is read + complete only."""
        session = _approve(lecturer_user, pending_submission)

        resp = client_for(advisee_student).post(
            action_items_url(session.id), {'description': 'x'}, format='json'
        )
        assert resp.status_code == 403

    def test_add_rejects_empty_description(self, lecturer_user, pending_submission):
        session = _approve(lecturer_user, pending_submission)

        resp = client_for(lecturer_user).post(
            action_items_url(session.id), {'description': '  '}, format='json'
        )
        assert resp.status_code == 400

    def test_both_student_and_lecturer_can_list_items(
        self, lecturer_user, advisee_student, pending_submission
    ):
        session = _approve(lecturer_user, pending_submission)
        ActionItem.objects.create(session=session, description='Saran 1')

        for user in (lecturer_user, advisee_student):
            resp = client_for(user).get(action_items_url(session.id))
            assert resp.status_code == 200
            assert len(resp.data) == 1

    def test_unrelated_user_forbidden(
        self, lecturer_user, student_user, pending_submission
    ):
        """A student who isn't the advisee on this session can't see its action items."""
        session = _approve(lecturer_user, pending_submission)

        resp = client_for(student_user).get(action_items_url(session.id))
        assert resp.status_code == 403

    def test_nonexistent_session_returns_404(self, lecturer_user):
        resp = client_for(lecturer_user).get(action_items_url(999999))
        assert resp.status_code == 404

    def test_adding_advice_notifies_student(self, lecturer_user, advisee_student, pending_submission):
        """G3: creating an advice item fires an ADVICE_ADDED notification."""
        session = _approve(lecturer_user, pending_submission)
        client_for(lecturer_user).post(
            action_items_url(session.id), {'description': 'Perbaiki bab 3'}, format='json')
        assert SystemLog.objects.filter(event_type='ADVICE_ADDED').exists()


def item_detail_url(session_id, pk):
    return f'/api/queue/{session_id}/action-items/{pk}/'


@pytest.mark.django_db
class TestSessionActionItemDetailView:
    """G1: dosen can edit/delete an advice item they gave."""

    def test_lecturer_can_edit_description(self, lecturer_user, pending_submission):
        session = _approve(lecturer_user, pending_submission)
        item = ActionItem.objects.create(session=session, description='typo asli')

        resp = client_for(lecturer_user).patch(
            item_detail_url(session.id, item.id), {'description': 'Perbaiki bab 3 (revisi)'}, format='json')
        assert resp.status_code == 200
        assert resp.data['description'] == 'Perbaiki bab 3 (revisi)'
        item.refresh_from_db()
        assert item.description == 'Perbaiki bab 3 (revisi)'

    def test_edit_rejects_empty(self, lecturer_user, pending_submission):
        session = _approve(lecturer_user, pending_submission)
        item = ActionItem.objects.create(session=session, description='x')
        resp = client_for(lecturer_user).patch(
            item_detail_url(session.id, item.id), {'description': '  '}, format='json')
        assert resp.status_code == 400

    def test_lecturer_can_delete(self, lecturer_user, pending_submission):
        session = _approve(lecturer_user, pending_submission)
        item = ActionItem.objects.create(session=session, description='hapus aku')
        resp = client_for(lecturer_user).delete(item_detail_url(session.id, item.id))
        assert resp.status_code == 204
        assert not ActionItem.objects.filter(pk=item.id).exists()

    def test_other_lecturer_forbidden(self, lecturer_user, approved_lecturer, pending_submission):
        session = _approve(lecturer_user, pending_submission)
        item = ActionItem.objects.create(session=session, description='rahasia')
        resp = client_for(approved_lecturer).delete(item_detail_url(session.id, item.id))
        assert resp.status_code == 403
        assert ActionItem.objects.filter(pk=item.id).exists()

    def test_student_forbidden(self, lecturer_user, advisee_student, pending_submission):
        session = _approve(lecturer_user, pending_submission)
        item = ActionItem.objects.create(session=session, description='x')
        resp = client_for(advisee_student).patch(
            item_detail_url(session.id, item.id), {'description': 'y'}, format='json')
        assert resp.status_code == 403

    def test_missing_item_404(self, lecturer_user, pending_submission):
        session = _approve(lecturer_user, pending_submission)
        resp = client_for(lecturer_user).delete(item_detail_url(session.id, 999999))
        assert resp.status_code == 404


@pytest.mark.django_db
class TestCompleteActionItemView:
    def test_student_can_mark_own_action_item_complete(
        self, lecturer_user, advisee_student, pending_submission
    ):
        session = _approve(lecturer_user, pending_submission)
        item = ActionItem.objects.create(session=session, description='Perbaiki bab 2')

        resp = client_for(advisee_student).post(complete_url(item.id))
        assert resp.status_code == 200

        item.refresh_from_db()
        assert item.is_completed is True
        assert item.completed_at is not None

    def test_complete_with_optional_note_saves_it(
        self, lecturer_user, advisee_student, pending_submission
    ):
        """ADVICE-01: the student may attach an optional note/evidence when marking done."""
        session = _approve(lecturer_user, pending_submission)
        item = ActionItem.objects.create(session=session, description='Perbaiki bab 2')

        resp = client_for(advisee_student).post(
            complete_url(item.id), {'note': 'Sudah revisi, lihat lampiran bab2_v3.pdf'}, format='json')
        assert resp.status_code == 200
        assert resp.data['completion_note'] == 'Sudah revisi, lihat lampiran bab2_v3.pdf'
        item.refresh_from_db()
        assert item.completion_note == 'Sudah revisi, lihat lampiran bab2_v3.pdf'
        assert item.is_completed is True

    def test_complete_without_note_leaves_it_blank(
        self, lecturer_user, advisee_student, pending_submission
    ):
        session = _approve(lecturer_user, pending_submission)
        item = ActionItem.objects.create(session=session, description='Perbaiki bab 2')

        resp = client_for(advisee_student).post(complete_url(item.id))
        assert resp.status_code == 200
        assert resp.data['completion_note'] == ''

    def test_completion_note_surfaces_in_list(
        self, lecturer_user, advisee_student, pending_submission
    ):
        session = _approve(lecturer_user, pending_submission)
        item = ActionItem.objects.create(session=session, description='Perbaiki bab 2')
        client_for(advisee_student).post(complete_url(item.id), {'note': 'bukti terlampir'}, format='json')

        resp = client_for(lecturer_user).get(action_items_url(session.id))
        assert resp.status_code == 200
        assert resp.data[0]['completion_note'] == 'bukti terlampir'

    def test_other_student_cannot_complete_someone_elses_item(
        self, lecturer_user, student_user, pending_submission
    ):
        session = _approve(lecturer_user, pending_submission)
        item = ActionItem.objects.create(session=session, description='Perbaiki bab 2')

        resp = client_for(student_user).post(complete_url(item.id))
        assert resp.status_code == 403

    def test_lecturer_cannot_complete_an_action_item(
        self, lecturer_user, advisee_student, pending_submission
    ):
        """Completing is student-only (IsStudent permission) — the dosen who wrote
        the advice doesn't get to mark it addressed themselves."""
        session = _approve(lecturer_user, pending_submission)
        item = ActionItem.objects.create(session=session, description='Perbaiki bab 2')

        resp = client_for(lecturer_user).post(complete_url(item.id))
        assert resp.status_code == 403

    def test_nonexistent_item_returns_404(self, advisee_student):
        resp = client_for(advisee_student).post(complete_url(999999))
        assert resp.status_code == 404


@pytest.mark.django_db
class TestKetuaJurusanComplianceView:
    url = '/api/ketua-jurusan/compliance/'

    def test_compliance_rate_reflects_completed_vs_total(
        self, ketua_jurusan_user, lecturer_user, advisee_student, pending_submission
    ):
        session = _approve(lecturer_user, pending_submission)
        item1 = ActionItem.objects.create(session=session, description='Saran 1')
        ActionItem.objects.create(session=session, description='Saran 2')
        client_for(advisee_student).post(complete_url(item1.id))

        resp = client_for(ketua_jurusan_user).get(self.url)
        assert resp.status_code == 200
        assert resp.data['compliance_rate'] == 50

    def test_per_dosen_and_per_mahasiswa_breakdowns_present(
        self, ketua_jurusan_user, lecturer_user, pending_submission
    ):
        session = _approve(lecturer_user, pending_submission)
        ActionItem.objects.create(session=session, description='Saran 1')

        resp = client_for(ketua_jurusan_user).get(self.url)
        assert resp.status_code == 200
        assert len(resp.data['per_dosen']) == 1
        assert resp.data['per_dosen'][0]['dosen_name'] == lecturer_user.full_name
        assert len(resp.data['per_mahasiswa']) == 1

    def test_zero_action_items_reports_zero_percent_not_error(self, ketua_jurusan_user):
        """No division-by-zero when nothing has been created yet — the realistic
        current-day state, since no UI exists yet to create action items at all
        (see 07-VERIFICATION.md)."""
        resp = client_for(ketua_jurusan_user).get(self.url)
        assert resp.status_code == 200
        assert resp.data['compliance_rate'] == 0
        assert resp.data['per_dosen'] == []

    def test_lecturer_forbidden(self, authenticated_lecturer):
        resp = authenticated_lecturer.get(self.url)
        assert resp.status_code == 403


@pytest.mark.django_db
class TestLecturerAdviceHistoryView:
    """ADVICE-02 (Phase 7 SC2): dosen melihat rekap saran agregat lintas sesi,
    dikelompokkan per mahasiswa bimbingan, hanya untuk advisee-nya sendiri."""

    url = ADVICE_HISTORY_URL

    def test_groups_advice_per_advisee_with_stats(
        self, lecturer_user, advisee_student, pending_submission
    ):
        session = _approve(lecturer_user, pending_submission)
        item1 = ActionItem.objects.create(session=session, description='Perbaiki bab 2')
        ActionItem.objects.create(session=session, description='Tambah referensi')
        client_for(advisee_student).post(complete_url(item1.id))

        resp = client_for(lecturer_user).get(self.url)
        assert resp.status_code == 200
        assert resp.data['total_saran'] == 2
        assert resp.data['saran_selesai'] == 1
        assert resp.data['compliance_rate'] == 50

        assert len(resp.data['per_mahasiswa']) == 1
        bucket = resp.data['per_mahasiswa'][0]
        assert bucket['student_id'] == advisee_student.id
        assert bucket['nama'] == advisee_student.full_name
        assert bucket['total_saran'] == 2
        assert bucket['saran_selesai'] == 1
        assert len(bucket['items']) == 2
        # tiap item membawa session_id agar UI bisa tautkan ke detail sesi
        assert all(it['session_id'] == session.id for it in bucket['items'])

    def test_multiple_advisees_each_get_a_bucket(
        self, lecturer_user, advisee_student, second_advisee_student,
        pending_submission, submission_for, symptom_category
    ):
        s1 = _approve(lecturer_user, pending_submission)
        ActionItem.objects.create(session=s1, description='Saran utk advisee 1')

        sub2 = submission_for(second_advisee_student, [symptom_category])
        s2 = _approve(lecturer_user, sub2)
        ActionItem.objects.create(session=s2, description='Saran utk advisee 2')

        resp = client_for(lecturer_user).get(self.url)
        assert resp.status_code == 200
        assert resp.data['total_saran'] == 2
        assert len(resp.data['per_mahasiswa']) == 2
        ids = {b['student_id'] for b in resp.data['per_mahasiswa']}
        assert ids == {advisee_student.id, second_advisee_student.id}

    def test_scoped_to_own_advisees_only(
        self, lecturer_user, advisee_student, pending_submission, approved_lecturer
    ):
        """A different lecturer sees none of lecturer_user's advisees' advice."""
        session = _approve(lecturer_user, pending_submission)
        ActionItem.objects.create(session=session, description='Rahasia advisee')

        resp = client_for(approved_lecturer).get(self.url)
        assert resp.status_code == 200
        assert resp.data['total_saran'] == 0
        assert resp.data['per_mahasiswa'] == []

    def test_empty_returns_zero_not_error(self, lecturer_user):
        resp = client_for(lecturer_user).get(self.url)
        assert resp.status_code == 200
        assert resp.data['compliance_rate'] == 0
        assert resp.data['per_mahasiswa'] == []

    def test_student_forbidden(self, authenticated_student):
        resp = authenticated_student.get(self.url)
        assert resp.status_code == 403

    def test_ketua_jurusan_forbidden(self, ketua_jurusan_user):
        resp = client_for(ketua_jurusan_user).get(self.url)
        assert resp.status_code == 403
