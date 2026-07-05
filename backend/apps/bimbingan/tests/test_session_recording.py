"""
Phase 6 / Wave 6 (06-09-T2) — VIDEO-02/D-17: online sessions record
lecturer-mic-only via the exact same CompleteSessionView path as offline,
with no new capture code. Mirrors test_session_execution.py's
TestCompleteSessionRecordingUpload, scoped to the online-specific assertion.
"""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.bimbingan.models import Session, SessionRecording
from apps.logbook.models import SessionLogbook


def client_for(user):
    """A dedicated APIClient authenticated as `user`."""
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _approve(lecturer, submission, method='offline'):
    payload = {'method': method}
    if method == 'online':
        payload['meeting_link'] = 'https://meet.example.com/test-room'
    resp = client_for(lecturer).post(
        f'/api/submissions/{submission.id}/approve/', payload, format='json',
    )
    assert resp.status_code == 200, resp.data
    return Session.objects.get(submission=submission)


def _start(lecturer, session, with_consent=True):
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
        'session_recording.webm', webm_audio_file.read(), content_type='audio/webm',
    )


@pytest.mark.django_db
class TestOnlineSessionRecording:
    """VIDEO-02/D-17 — online sessions reuse the offline recording flow unchanged."""

    def test_online_session_lecturer_mic_only_recording(
        self, lecturer_user, pending_submission, webm_audio_file, tmp_path, settings,
    ):
        settings.MEDIA_ROOT = str(tmp_path)
        session = _start(
            lecturer_user, _approve(lecturer_user, pending_submission, method='online'),
        )
        assert session.method == Session.Method.ONLINE
        assert session.consent_given_at is not None

        resp = client_for(lecturer_user).post(
            complete_url(session.id), {'audio': _webm_upload(webm_audio_file)}, format='multipart',
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['has_recording'] is True

        recording = SessionRecording.objects.get(session=session)
        assert recording.mime_type == 'audio/webm'

        logbook = SessionLogbook.objects.get(session=session)
        assert logbook.source_mode == SessionLogbook.SourceMode.ONLINE
