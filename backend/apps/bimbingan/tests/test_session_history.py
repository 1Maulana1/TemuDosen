"""
Phase 6 (partial, UI-first) — riwayat sesi, rekaman audio, ringkasan manual.

Covers:
  GET  /api/queue/lecturer/history/       → LecturerSessionHistoryView
  GET  /api/queue/my/history/             → StudentSessionHistoryView
  GET  /api/queue/<id>/recording/         → SessionRecordingFileView
  GET  /api/logbook/<id>/                 → LecturerLogbookDetailView
  GET  /api/logbook/student/<id>/         → StudentLogbookView
  POST /api/logbook/<id>/manual-notes/    → ManualNotesView (fallback STT-07)

Ringkasan kini disimpan di SessionLogbook (apps.logbook), bukan Session.summary.
STT/LLM otomatis belum ada — dosen mengisi via jalur manual (manual-notes), yang
menyetujui logbook (status pending → approved, is_manual=True).
"""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.bimbingan.models import Session


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


def _start(lecturer, session, with_consent=False):
    resp = client_for(lecturer).post(
        f'/api/queue/{session.id}/start/',
        {'consent_by_dosen': with_consent, 'consent_by_mahasiswa': with_consent},
        format='json',
    )
    assert resp.status_code == 200, resp.data
    session.refresh_from_db()
    return session


def _complete(lecturer, session, audio=None):
    data = {}
    if audio is not None:
        data['audio'] = audio
    resp = client_for(lecturer).post(
        f'/api/queue/{session.id}/complete/', data, format='multipart' if audio else 'json'
    )
    assert resp.status_code == 200, resp.data
    session.refresh_from_db()
    return session


def _done_session(lecturer, submission, with_recording=False, webm_audio_file=None):
    session = _start(lecturer, _approve(lecturer, submission), with_consent=with_recording)
    audio = None
    if with_recording:
        audio = SimpleUploadedFile(
            'rec.webm', webm_audio_file.read(), content_type='audio/webm'
        )
    return _complete(lecturer, session, audio=audio)


@pytest.mark.django_db
class TestLecturerSessionHistory:
    def test_lists_own_done_sessions(self, lecturer_user, pending_submission):
        session = _done_session(lecturer_user, pending_submission)

        resp = client_for(lecturer_user).get('/api/queue/lecturer/history/')
        assert resp.status_code == 200
        ids = [row['id'] for row in resp.data]
        assert session.id in ids

    def test_excludes_other_lecturers_sessions(
        self, lecturer_user, pending_submission, second_advisee_student, symptom_category
    ):
        from apps.submissions.models import Submission

        other_lecturer_client = client_for(lecturer_user)
        _done_session(lecturer_user, pending_submission)

        # Second lecturer with no sessions should see an empty list, not the first's.
        other_sub = Submission.objects.create(
            student=second_advisee_student, description='lain'
        )
        other_sub.symptoms.set([symptom_category])

        resp = other_lecturer_client.get('/api/queue/lecturer/history/')
        assert resp.status_code == 200
        assert len(resp.data) == 1  # only the one session belonging to lecturer_user


@pytest.mark.django_db
class TestStudentSessionHistory:
    def test_lists_own_done_sessions(self, lecturer_user, advisee_student, pending_submission):
        session = _done_session(lecturer_user, pending_submission)

        resp = client_for(advisee_student).get('/api/queue/my/history/')
        assert resp.status_code == 200
        ids = [row['id'] for row in resp.data]
        assert session.id in ids

    def test_other_student_sees_nothing(self, lecturer_user, pending_submission, second_advisee_student):
        _done_session(lecturer_user, pending_submission)

        resp = client_for(second_advisee_student).get('/api/queue/my/history/')
        assert resp.status_code == 200
        assert resp.data == []


@pytest.mark.django_db
class TestSessionRecordingFileView:
    def test_owner_can_stream_recording(
        self, lecturer_user, advisee_student, pending_submission, webm_audio_file
    ):
        session = _done_session(
            lecturer_user, pending_submission, with_recording=True, webm_audio_file=webm_audio_file
        )
        resp = client_for(advisee_student).get(f'/api/queue/{session.id}/recording/')
        assert resp.status_code == 200
        assert resp['Content-Type'] == 'audio/webm'

    def test_adviser_can_stream_recording(
        self, lecturer_user, pending_submission, webm_audio_file
    ):
        session = _done_session(
            lecturer_user, pending_submission, with_recording=True, webm_audio_file=webm_audio_file
        )
        resp = client_for(lecturer_user).get(f'/api/queue/{session.id}/recording/')
        assert resp.status_code == 200

    def test_unrelated_student_forbidden(
        self, lecturer_user, pending_submission, second_advisee_student, webm_audio_file
    ):
        session = _done_session(
            lecturer_user, pending_submission, with_recording=True, webm_audio_file=webm_audio_file
        )
        resp = client_for(second_advisee_student).get(f'/api/queue/{session.id}/recording/')
        assert resp.status_code == 403

    def test_404_when_no_recording(self, lecturer_user, advisee_student, pending_submission):
        session = _done_session(lecturer_user, pending_submission, with_recording=False)
        resp = client_for(advisee_student).get(f'/api/queue/{session.id}/recording/')
        assert resp.status_code == 404


@pytest.mark.django_db
class TestSessionLogbookView:
    """Phase 6 (merge): ringkasan pindah ke SessionLogbook via /api/logbook/.

    _done_session() otomatis membuat SessionLogbook (status pending) saat sesi
    selesai, jadi setiap sesi selesai punya logbook yang bisa diisi manual.
    """

    def test_lecturer_can_read_own_logbook(self, lecturer_user, pending_submission):
        session = _done_session(lecturer_user, pending_submission)
        resp = client_for(lecturer_user).get(f'/api/logbook/{session.id}/')
        assert resp.status_code == 200
        assert resp.data['status'] == 'pending'
        assert resp.data['summary_edited'] is None

    def test_student_cannot_view_unapproved_logbook(
        self, lecturer_user, advisee_student, pending_submission
    ):
        session = _done_session(lecturer_user, pending_submission)
        resp = client_for(advisee_student).get(f'/api/logbook/student/{session.id}/')
        assert resp.status_code == 403  # pending → konten tak pernah bocor (STT-06)

    def test_manual_notes_approves_logbook(self, lecturer_user, pending_submission):
        session = _done_session(lecturer_user, pending_submission)
        resp = client_for(lecturer_user).post(
            f'/api/logbook/{session.id}/manual-notes/',
            {'notes': 'Sudah bagus, lanjut bab 4.'}, format='json',
        )
        assert resp.status_code == 200
        assert resp.data['status'] == 'approved'
        assert resp.data['is_manual'] is True
        assert resp.data['summary_edited'] == {'manual_notes': 'Sudah bagus, lanjut bab 4.'}
        assert resp.data['approved_at'] is not None

    def test_student_sees_summary_after_approval(
        self, lecturer_user, advisee_student, pending_submission
    ):
        session = _done_session(lecturer_user, pending_submission)
        client_for(lecturer_user).post(
            f'/api/logbook/{session.id}/manual-notes/',
            {'notes': 'Lanjutkan.'}, format='json',
        )
        resp = client_for(advisee_student).get(f'/api/logbook/student/{session.id}/')
        assert resp.status_code == 200
        assert resp.data['summary_edited'] == {'manual_notes': 'Lanjutkan.'}
        # D-11: token/biaya LLM tidak pernah dikirim ke mahasiswa.
        assert 'llm_input_tokens' not in resp.data
        assert 'llm_cost_estimate_idr' not in resp.data

    def test_manual_notes_empty_rejected(self, lecturer_user, pending_submission):
        session = _done_session(lecturer_user, pending_submission)
        resp = client_for(lecturer_user).post(
            f'/api/logbook/{session.id}/manual-notes/', {'notes': '   '}, format='json'
        )
        assert resp.status_code == 400

    def test_student_cannot_write_notes(self, lecturer_user, advisee_student, pending_submission):
        session = _done_session(lecturer_user, pending_submission)
        resp = client_for(advisee_student).post(
            f'/api/logbook/{session.id}/manual-notes/', {'notes': 'coba edit'}, format='json'
        )
        assert resp.status_code == 403

    def test_unrelated_lecturer_forbidden(self, lecturer_user, pending_submission):
        from apps.accounts.models import CustomUser

        other_lecturer = CustomUser.objects.create_user(
            email='other_lecturer@test.com', password='pass12345', role='lecturer',
            full_name='Dr. Lain', nidn='9999999999', is_approved=True,
        )
        session = _done_session(lecturer_user, pending_submission)
        resp = client_for(other_lecturer).post(
            f'/api/logbook/{session.id}/manual-notes/', {'notes': 'mencoba'}, format='json'
        )
        assert resp.status_code == 403


@pytest.mark.django_db
class TestRejectLogbookView:
    """Gate tambahan (STT-04): dosen menolak draf AI yang meragukan alih-alih
    dipaksa menyetujuinya. _done_session() membuat logbook berstatus 'pending'
    (STT/LLM mati di test) — di-set manual ke 'ready_for_review' untuk mensimulasikan
    draf AI yang sudah jadi."""

    def _ready_for_review(self, lecturer, submission):
        from apps.logbook.models import SessionLogbook

        session = _done_session(lecturer, submission)
        logbook = SessionLogbook.objects.get(session=session)
        logbook.transcript = 'dosen membahas metodologi penelitian'
        logbook.summary_raw = {
            'advice_points': [{'topic': 'Metodologi', 'detail': 'Perbaiki bab 3'}],
            'improvement_notes': [],
        }
        logbook.status = SessionLogbook.Status.READY_FOR_REVIEW
        logbook.save()
        return session

    def test_reject_falls_back_to_failed(self, lecturer_user, pending_submission):
        session = self._ready_for_review(lecturer_user, pending_submission)
        resp = client_for(lecturer_user).post(f'/api/logbook/{session.id}/reject/')
        assert resp.status_code == 200
        assert resp.data['status'] == 'failed'

    def test_rejected_logbook_accepts_manual_notes(self, lecturer_user, pending_submission):
        session = self._ready_for_review(lecturer_user, pending_submission)
        client_for(lecturer_user).post(f'/api/logbook/{session.id}/reject/')

        resp = client_for(lecturer_user).post(
            f'/api/logbook/{session.id}/manual-notes/',
            {'notes': 'Ditulis manual setelah menolak draf AI.'}, format='json',
        )
        assert resp.status_code == 200
        assert resp.data['status'] == 'approved'
        assert resp.data['is_manual'] is True

    def test_cannot_reject_when_not_ready_for_review(self, lecturer_user, pending_submission):
        session = _done_session(lecturer_user, pending_submission)  # status masih 'pending'
        resp = client_for(lecturer_user).post(f'/api/logbook/{session.id}/reject/')
        assert resp.status_code == 400

    def test_unrelated_lecturer_cannot_reject(self, lecturer_user, pending_submission):
        from apps.accounts.models import CustomUser

        other_lecturer = CustomUser.objects.create_user(
            email='other_lecturer2@test.com', password='pass12345', role='lecturer',
            full_name='Dr. Lain Lagi', nidn='8888888888', is_approved=True,
        )
        session = self._ready_for_review(lecturer_user, pending_submission)
        resp = client_for(other_lecturer).post(f'/api/logbook/{session.id}/reject/')
        assert resp.status_code == 403

    def test_student_cannot_reject(self, lecturer_user, advisee_student, pending_submission):
        session = self._ready_for_review(lecturer_user, pending_submission)
        resp = client_for(advisee_student).post(f'/api/logbook/{session.id}/reject/')
        assert resp.status_code == 403


@pytest.mark.django_db
class TestApproveLogbookView:
    """STT-04 (approve AI-generated summary) + the Phase 6->7 handoff (STT-05):
    approving must split the summary's advice_points/improvement_notes into
    ActionItem rows so Phase 7's advice-tracking has real data. Previously
    untested — the only tested approval path was the manual-notes fallback."""

    def _ready_for_review(self, lecturer, submission):
        from apps.logbook.models import SessionLogbook

        session = _done_session(lecturer, submission)
        logbook = SessionLogbook.objects.get(session=session)
        logbook.transcript = 'dosen membahas metodologi penelitian'
        logbook.summary_raw = {
            'advice_points': [{'topic': 'Metodologi', 'detail': 'Perbaiki bab 3'}],
            'improvement_notes': [{'area': 'Penulisan', 'action': 'Rapikan sitasi'}],
        }
        logbook.status = SessionLogbook.Status.READY_FOR_REVIEW
        logbook.save()
        return session

    def _payload(self):
        return {
            'summary_edited': {
                'advice_points': [{'topic': 'Metodologi', 'detail': 'Perbaiki bab 3'}],
                'improvement_notes': [{'area': 'Penulisan', 'action': 'Rapikan sitasi'}],
            }
        }

    def test_lecturer_can_approve_ready_for_review_logbook(self, lecturer_user, pending_submission):
        session = self._ready_for_review(lecturer_user, pending_submission)
        resp = client_for(lecturer_user).post(
            f'/api/logbook/{session.id}/approve/', self._payload(), format='json',
        )
        assert resp.status_code == 200
        assert resp.data['status'] == 'approved'
        assert resp.data['approved_at'] is not None

    def test_approve_creates_action_items_from_advice_and_improvement(
        self, lecturer_user, pending_submission
    ):
        from apps.bimbingan.models import ActionItem

        session = self._ready_for_review(lecturer_user, pending_submission)
        client_for(lecturer_user).post(
            f'/api/logbook/{session.id}/approve/', self._payload(), format='json',
        )
        descriptions = set(
            ActionItem.objects.filter(session=session).values_list('description', flat=True)
        )
        assert descriptions == {'Metodologi: Perbaiki bab 3', 'Penulisan: Rapikan sitasi'}

    def test_approve_with_empty_lists_creates_no_action_items(self, lecturer_user, pending_submission):
        from apps.bimbingan.models import ActionItem

        session = self._ready_for_review(lecturer_user, pending_submission)
        resp = client_for(lecturer_user).post(
            f'/api/logbook/{session.id}/approve/',
            {'summary_edited': {'advice_points': [], 'improvement_notes': []}}, format='json',
        )
        assert resp.status_code == 200
        assert ActionItem.objects.filter(session=session).count() == 0

    def test_approve_malformed_summary_does_not_crash(self, lecturer_user, pending_submission):
        """summary_edited is an arbitrary JSONField (ApproveLogbookSerializer only
        checks it's valid JSON) — an unexpected shape must degrade gracefully,
        never 500 and never create garbage ActionItems."""
        from apps.bimbingan.models import ActionItem

        session = self._ready_for_review(lecturer_user, pending_submission)
        resp = client_for(lecturer_user).post(
            f'/api/logbook/{session.id}/approve/',
            {'summary_edited': {'unexpected': 'shape'}}, format='json',
        )
        assert resp.status_code == 200
        assert ActionItem.objects.filter(session=session).count() == 0

    def test_student_sees_approved_summary_matching_action_items(
        self, lecturer_user, advisee_student, pending_submission
    ):
        session = self._ready_for_review(lecturer_user, pending_submission)
        client_for(lecturer_user).post(
            f'/api/logbook/{session.id}/approve/', self._payload(), format='json',
        )
        resp = client_for(advisee_student).get(f'/api/logbook/student/{session.id}/')
        assert resp.status_code == 200
        assert resp.data['summary_edited']['advice_points'][0]['detail'] == 'Perbaiki bab 3'

    def test_cannot_approve_when_not_ready_for_review(self, lecturer_user, pending_submission):
        session = _done_session(lecturer_user, pending_submission)  # status stays 'pending'
        resp = client_for(lecturer_user).post(
            f'/api/logbook/{session.id}/approve/', self._payload(), format='json',
        )
        assert resp.status_code == 400

    def test_unrelated_lecturer_cannot_approve(self, lecturer_user, pending_submission):
        from apps.accounts.models import CustomUser

        other_lecturer = CustomUser.objects.create_user(
            email='other_lecturer3@test.com', password='pass12345', role='lecturer',
            full_name='Dr. Lain Tiga', nidn='7777777777', is_approved=True,
        )
        session = self._ready_for_review(lecturer_user, pending_submission)
        resp = client_for(other_lecturer).post(
            f'/api/logbook/{session.id}/approve/', self._payload(), format='json',
        )
        assert resp.status_code == 403

    def test_student_cannot_approve(self, lecturer_user, advisee_student, pending_submission):
        session = self._ready_for_review(lecturer_user, pending_submission)
        resp = client_for(advisee_student).post(
            f'/api/logbook/{session.id}/approve/', self._payload(), format='json',
        )
        assert resp.status_code == 403

    def test_approve_nonexistent_logbook_404(self, lecturer_user):
        resp = client_for(lecturer_user).post(
            '/api/logbook/999999/approve/', self._payload(), format='json',
        )
        assert resp.status_code == 404


@pytest.mark.django_db
class TestLogbookListViews:
    """GET /api/logbook/lecturer/ and GET /api/logbook/student/ — previously untested."""

    def test_lecturer_list_scoped_to_own_advisees(
        self, lecturer_user, pending_submission, symptom_category, submission_for
    ):
        from apps.accounts.models import CustomUser

        session = _done_session(lecturer_user, pending_submission)

        other_lecturer = CustomUser.objects.create_user(
            email='other_lecturer_list@test.com', password='pass12345', role='lecturer',
            full_name='Dr. Lain List', nidn='6666666666', is_approved=True,
        )
        other_student = CustomUser.objects.create_user(
            email='other_student_list@test.com', password='pass12345', role='student',
            full_name='Mhs Lain', nim='20239999', is_approved=True, adviser=other_lecturer,
        )
        other_sub = submission_for(other_student, [symptom_category])
        _done_session(other_lecturer, other_sub)

        resp = client_for(lecturer_user).get('/api/logbook/lecturer/')
        assert resp.status_code == 200
        assert [row['session_id'] for row in resp.data] == [session.id]

    def test_student_list_only_shows_own_approved_logbooks(
        self, lecturer_user, advisee_student, second_advisee_student, pending_submission,
        symptom_category, submission_for,
    ):
        session = _done_session(lecturer_user, pending_submission)
        client_for(lecturer_user).post(
            f'/api/logbook/{session.id}/manual-notes/', {'notes': 'Selesai.'}, format='json',
        )

        # A second advisee's logbook, left unapproved, must never leak into this
        # student's own list even though it shares the same lecturer.
        other_sub = submission_for(second_advisee_student, [symptom_category])
        _done_session(lecturer_user, other_sub)

        resp = client_for(advisee_student).get('/api/logbook/student/')
        assert resp.status_code == 200
        assert len(resp.data) == 1
        assert resp.data[0]['session_id'] == session.id

    def test_student_list_excludes_unapproved(self, lecturer_user, advisee_student, pending_submission):
        _done_session(lecturer_user, pending_submission)  # status stays 'pending'

        resp = client_for(advisee_student).get('/api/logbook/student/')
        assert resp.status_code == 200
        assert resp.data == []

    def test_lecturer_list_requires_lecturer_role(self, advisee_student):
        resp = client_for(advisee_student).get('/api/logbook/lecturer/')
        assert resp.status_code == 403

    def test_student_list_requires_student_role(self, lecturer_user):
        resp = client_for(lecturer_user).get('/api/logbook/student/')
        assert resp.status_code == 403
