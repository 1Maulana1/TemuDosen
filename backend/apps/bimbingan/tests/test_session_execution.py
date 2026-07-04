"""
Phase 5 (SESSION-03/04) — Selesai/TS2 + upload rekaman audio.

Covers:
  POST /api/queue/<id>/complete/ → CompleteSessionView (IsLecturer)
  GET  /api/queue/lecturer/      → activeSession field (IN_PROGRESS session)

The consent gate is enforced server-side: audio is only accepted when
consent_given_at was recorded at session start (FR-M04).
"""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.bimbingan.models import Session, SessionRecording, SystemLog


def client_for(user):
    """A dedicated APIClient authenticated as `user`."""
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _approve(lecturer, submission):
    """Helper: approve a submission (offline) as `lecturer` and return its Session."""
    resp = client_for(lecturer).post(
        f'/api/submissions/{submission.id}/approve/', {'method': 'offline'}, format='json'
    )
    assert resp.status_code == 200, resp.data
    return Session.objects.get(submission=submission)


def _start(lecturer, session, with_consent=False):
    """Helper: start a WAITING session, optionally with both-party consent."""
    resp = client_for(lecturer).post(
        f'/api/queue/{session.id}/start/',
        {'consent_by_dosen': with_consent, 'consent_by_mahasiswa': with_consent},
        format='json',
    )
    assert resp.status_code == 200, resp.data
    session.refresh_from_db()
    return session


def complete_url(pk):
    return f'/api/queue/{pk}/complete/'


def _webm_upload(webm_audio_file):
    return SimpleUploadedFile(
        'session_recording.webm', webm_audio_file.read(), content_type='audio/webm'
    )


@pytest.mark.django_db
class TestCompleteSession:
    """POST /api/queue/<id>/complete/ — dosen menyelesaikan sesi (TS2)."""

    def test_complete_sets_ts2_and_done(self, lecturer_user, pending_submission):
        session = _start(lecturer_user, _approve(lecturer_user, pending_submission))

        resp = client_for(lecturer_user).post(complete_url(session.id))
        assert resp.status_code == 200, resp.data
        assert resp.data['ts2'] is not None
        assert resp.data['has_recording'] is False

        session.refresh_from_db()
        assert session.status == Session.Status.DONE
        assert session.ts2 is not None
        assert session.ts1 is not None
        assert session.ts2 >= session.ts1

    def test_optional_notes_saved(self, lecturer_user, pending_submission):
        session = _start(lecturer_user, _approve(lecturer_user, pending_submission))

        resp = client_for(lecturer_user).post(
            complete_url(session.id), {'notes': '  Revisi bab 3, lanjut bab 4.  '}
        )
        assert resp.status_code == 200, resp.data

        session.refresh_from_db()
        assert session.result_notes == 'Revisi bab 3, lanjut bab 4.'

    def test_notes_optional_defaults_empty(self, lecturer_user, pending_submission):
        session = _start(lecturer_user, _approve(lecturer_user, pending_submission))

        resp = client_for(lecturer_user).post(complete_url(session.id))
        assert resp.status_code == 200

        session.refresh_from_db()
        assert session.result_notes == ''

    def test_only_in_progress_can_be_completed(self, lecturer_user, pending_submission):
        session = _approve(lecturer_user, pending_submission)  # still WAITING

        resp = client_for(lecturer_user).post(complete_url(session.id))
        assert resp.status_code == 400
        session.refresh_from_db()
        assert session.status == Session.Status.WAITING
        assert session.ts2 is None

    def test_already_done_cannot_be_completed_again(self, lecturer_user, pending_submission):
        session = _start(lecturer_user, _approve(lecturer_user, pending_submission))
        assert client_for(lecturer_user).post(complete_url(session.id)).status_code == 200

        resp = client_for(lecturer_user).post(complete_url(session.id))
        assert resp.status_code == 400

    def test_other_lecturer_forbidden(
        self, lecturer_user, approved_lecturer, pending_submission
    ):
        session = _start(lecturer_user, _approve(lecturer_user, pending_submission))

        resp = client_for(approved_lecturer).post(complete_url(session.id))
        assert resp.status_code == 403
        session.refresh_from_db()
        assert session.status == Session.Status.IN_PROGRESS

    def test_student_forbidden(self, lecturer_user, advisee_student, pending_submission):
        session = _start(lecturer_user, _approve(lecturer_user, pending_submission))

        resp = client_for(advisee_student).post(complete_url(session.id))
        assert resp.status_code == 403

    def test_missing_session_404(self, lecturer_user):
        resp = client_for(lecturer_user).post(complete_url(99999))
        assert resp.status_code == 404

    def test_logs_session_completed_event(self, lecturer_user, pending_submission):
        session = _start(lecturer_user, _approve(lecturer_user, pending_submission))

        client_for(lecturer_user).post(complete_url(session.id))
        log = SystemLog.objects.filter(event_type='SESSION_COMPLETED').first()
        assert log is not None
        assert log.context['session_id'] == session.id


@pytest.mark.django_db
class TestCompleteSessionRecordingUpload:
    """Upload rekaman audio saat Selesai — gerbang consent + validasi file."""

    def test_upload_with_consent_creates_recording(
        self, lecturer_user, pending_submission, webm_audio_file, tmp_path, settings
    ):
        settings.MEDIA_ROOT = str(tmp_path)
        session = _start(
            lecturer_user, _approve(lecturer_user, pending_submission), with_consent=True
        )
        assert session.consent_given_at is not None

        resp = client_for(lecturer_user).post(
            complete_url(session.id),
            {'audio': _webm_upload(webm_audio_file), 'notes': 'Sesi produktif.'},
            format='multipart',
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['has_recording'] is True

        recording = SessionRecording.objects.get(session=session)
        assert recording.mime_type == 'audio/webm'
        assert recording.file_size == 1024
        # File actually written to disk under MEDIA_ROOT/recordings/
        import os
        assert os.path.exists(recording.file_path)
        assert str(tmp_path) in recording.file_path
        with open(recording.file_path, 'rb') as f:
            assert f.read(4) == b'\x1a\x45\xdf\xa3'

    def test_upload_without_consent_rejected(
        self, lecturer_user, pending_submission, webm_audio_file, tmp_path, settings
    ):
        """FR-M04: server menolak audio jika consent kedua pihak tidak tercatat."""
        settings.MEDIA_ROOT = str(tmp_path)
        session = _start(
            lecturer_user, _approve(lecturer_user, pending_submission), with_consent=False
        )
        assert session.consent_given_at is None

        resp = client_for(lecturer_user).post(
            complete_url(session.id),
            {'audio': _webm_upload(webm_audio_file)},
            format='multipart',
        )
        assert resp.status_code == 400
        assert 'consent' in resp.data['detail'].lower()

        # Session untouched — dosen can retry Selesai without audio
        session.refresh_from_db()
        assert session.status == Session.Status.IN_PROGRESS
        assert session.ts2 is None
        assert not SessionRecording.objects.filter(session=session).exists()

    def test_invalid_magic_bytes_rejected(
        self, lecturer_user, pending_submission, tmp_path, settings
    ):
        settings.MEDIA_ROOT = str(tmp_path)
        session = _start(
            lecturer_user, _approve(lecturer_user, pending_submission), with_consent=True
        )

        fake = SimpleUploadedFile(
            'evil.webm', b'%PDF-1.4 not audio at all', content_type='audio/webm'
        )
        resp = client_for(lecturer_user).post(
            complete_url(session.id), {'audio': fake}, format='multipart'
        )
        assert resp.status_code == 400
        session.refresh_from_db()
        assert session.status == Session.Status.IN_PROGRESS
        assert not SessionRecording.objects.filter(session=session).exists()

    def test_oversize_recording_rejected(
        self, lecturer_user, pending_submission, webm_audio_file, tmp_path, settings
    ):
        settings.MEDIA_ROOT = str(tmp_path)
        settings.RECORDING_MAX_UPLOAD_SIZE = 512  # force the 1KB fixture over the limit
        session = _start(
            lecturer_user, _approve(lecturer_user, pending_submission), with_consent=True
        )

        resp = client_for(lecturer_user).post(
            complete_url(session.id),
            {'audio': _webm_upload(webm_audio_file)},
            format='multipart',
        )
        assert resp.status_code == 400
        session.refresh_from_db()
        assert session.status == Session.Status.IN_PROGRESS

    def test_ogg_upload_accepted(
        self, lecturer_user, pending_submission, tmp_path, settings
    ):
        """Firefox can produce audio/ogg — magic bytes 'OggS'."""
        settings.MEDIA_ROOT = str(tmp_path)
        session = _start(
            lecturer_user, _approve(lecturer_user, pending_submission), with_consent=True
        )

        ogg = SimpleUploadedFile(
            'rec.ogg', b'OggS' + b'\x00' * 100, content_type='audio/ogg'
        )
        resp = client_for(lecturer_user).post(
            complete_url(session.id), {'audio': ogg}, format='multipart'
        )
        assert resp.status_code == 200, resp.data
        recording = SessionRecording.objects.get(session=session)
        assert recording.mime_type == 'audio/ogg'
        assert recording.file_path.endswith('.ogg')


@pytest.mark.django_db
class TestLecturerQueueActiveSession:
    """GET /api/queue/lecturer/ — field activeSession untuk sesi IN_PROGRESS."""

    url = '/api/queue/lecturer/'

    def test_no_active_session_is_null(self, lecturer_user, pending_submission):
        _approve(lecturer_user, pending_submission)  # WAITING only

        resp = client_for(lecturer_user).get(self.url)
        assert resp.status_code == 200
        assert resp.data['activeSession'] is None

    def test_in_progress_session_returned(self, lecturer_user, pending_submission):
        session = _start(
            lecturer_user, _approve(lecturer_user, pending_submission), with_consent=True
        )

        resp = client_for(lecturer_user).get(self.url)
        assert resp.status_code == 200
        active = resp.data['activeSession']
        assert active is not None
        assert active['id'] == session.id
        assert active['ts1'] is not None
        assert active['consent_given'] is True
        # The started session left the waiting queue
        assert all(item['id'] != session.id for item in resp.data['queue'])

    def test_completed_session_not_active(self, lecturer_user, pending_submission):
        session = _start(lecturer_user, _approve(lecturer_user, pending_submission))
        client_for(lecturer_user).post(complete_url(session.id))

        resp = client_for(lecturer_user).get(self.url)
        assert resp.data['activeSession'] is None
