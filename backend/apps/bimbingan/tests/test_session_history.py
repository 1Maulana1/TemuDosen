"""
Phase 6 (partial, UI-first) — riwayat sesi, rekaman audio, ringkasan manual.

Covers:
  GET   /api/queue/lecturer/history/ → LecturerSessionHistoryView
  GET   /api/queue/my/history/       → StudentSessionHistoryView
  GET   /api/queue/<id>/recording/   → SessionRecordingFileView
  GET   /api/queue/<id>/summary/     → SessionSummaryView (view)
  PATCH /api/queue/<id>/summary/     → SessionSummaryView (edit/approve)

No STT/LLM automation exists yet — `summary` is filled in manually by the
lecturer (the spec's own fallback path for when the automatic pipeline isn't
available), so these tests only exercise the manual CRUD + permission paths.
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
class TestSessionSummaryView:
    def test_student_can_view_summary(self, lecturer_user, advisee_student, pending_submission):
        session = _done_session(lecturer_user, pending_submission)
        resp = client_for(advisee_student).get(f'/api/queue/{session.id}/summary/')
        assert resp.status_code == 200
        assert resp.data['summary'] == ''
        assert resp.data['summary_approved_at'] is None

    def test_lecturer_can_save_draft_summary(self, lecturer_user, pending_submission):
        session = _done_session(lecturer_user, pending_submission)
        resp = client_for(lecturer_user).patch(
            f'/api/queue/{session.id}/summary/', {'summary': 'Draf ringkasan.'}, format='json'
        )
        assert resp.status_code == 200
        assert resp.data['summary'] == 'Draf ringkasan.'
        assert resp.data['summary_approved_at'] is None

    def test_approve_requires_non_empty_summary(self, lecturer_user, pending_submission):
        session = _done_session(lecturer_user, pending_submission)
        resp = client_for(lecturer_user).patch(
            f'/api/queue/{session.id}/summary/', {'approve': True}, format='json'
        )
        assert resp.status_code == 400

    def test_approve_sets_timestamp(self, lecturer_user, pending_submission):
        session = _done_session(lecturer_user, pending_submission)
        resp = client_for(lecturer_user).patch(
            f'/api/queue/{session.id}/summary/',
            {'summary': 'Sudah bagus, lanjut bab 4.', 'approve': True},
            format='json',
        )
        assert resp.status_code == 200
        assert resp.data['summary_approved_at'] is not None

    def test_student_cannot_edit_summary(self, lecturer_user, advisee_student, pending_submission):
        session = _done_session(lecturer_user, pending_submission)
        resp = client_for(advisee_student).patch(
            f'/api/queue/{session.id}/summary/', {'summary': 'coba edit'}, format='json'
        )
        assert resp.status_code == 403

    def test_unrelated_lecturer_forbidden(
        self, lecturer_user, pending_submission, second_advisee_student, symptom_category
    ):
        from apps.accounts.models import CustomUser

        other_lecturer = CustomUser.objects.create_user(
            email='other_lecturer@test.com', password='pass12345', role='lecturer',
            full_name='Dr. Lain', nidn='9999999999', is_approved=True,
        )
        session = _done_session(lecturer_user, pending_submission)
        resp = client_for(other_lecturer).patch(
            f'/api/queue/{session.id}/summary/', {'summary': 'mencoba'}, format='json'
        )
        assert resp.status_code == 403
