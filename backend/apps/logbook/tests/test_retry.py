"""
Audit G6 — a lecturer can re-run the STT/AI pipeline for a FAILED logbook that
still has a recording.
"""
import pytest
from rest_framework.test import APIClient

from apps.bimbingan.models import Session, SessionRecording
from apps.logbook.models import SessionLogbook


def client_for(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _failed_logbook(submission, with_recording=True):
    session = Session.objects.create(submission=submission, status=Session.Status.DONE)
    if with_recording:
        SessionRecording.objects.create(
            session=session, original_filename='r.webm', file_path='/tmp/r.webm',
            file_size=10, mime_type='audio/webm')
    return SessionLogbook.objects.create(session=session, status=SessionLogbook.Status.FAILED)


def url(session_id):
    return f'/api/logbook/{session_id}/retry/'


@pytest.mark.django_db
class TestRetryPipelineView:
    def test_lecturer_can_retry_failed_logbook_with_recording(self, lecturer_user, pending_submission):
        lb = _failed_logbook(pending_submission)
        resp = client_for(lecturer_user).post(url(lb.session_id))
        assert resp.status_code == 200
        lb.refresh_from_db()
        # STT_LLM disabled in tests → dispatch is a safe no-op, but status is reset
        assert lb.status == SessionLogbook.Status.PENDING

    def test_retry_without_recording_rejected(self, lecturer_user, pending_submission):
        lb = _failed_logbook(pending_submission, with_recording=False)
        resp = client_for(lecturer_user).post(url(lb.session_id))
        assert resp.status_code == 400

    def test_retry_non_failed_rejected(self, lecturer_user, pending_submission):
        lb = _failed_logbook(pending_submission)
        lb.status = SessionLogbook.Status.APPROVED
        lb.save(update_fields=['status'])
        resp = client_for(lecturer_user).post(url(lb.session_id))
        assert resp.status_code == 400

    def test_retry_with_transcript_resummarizes_only(self, lecturer_user, pending_submission):
        # Transkrip sudah ada → tahap LLM saja yang diulang, status → SUMMARIZING.
        lb = _failed_logbook(pending_submission)
        lb.transcript = 'halo, bimbingan bab dua'
        lb.save(update_fields=['transcript'])
        resp = client_for(lecturer_user).post(url(lb.session_id))
        assert resp.status_code == 200
        lb.refresh_from_db()
        assert lb.status == SessionLogbook.Status.SUMMARIZING

    def test_retry_ready_for_review_with_transcript(self, lecturer_user, pending_submission):
        # Dosen minta "ringkas ulang dari transkrip" pada draf yang siap tinjau.
        lb = _failed_logbook(pending_submission)
        lb.status = SessionLogbook.Status.READY_FOR_REVIEW
        lb.transcript = 'halo, bimbingan bab dua'
        lb.save(update_fields=['status', 'transcript'])
        resp = client_for(lecturer_user).post(url(lb.session_id))
        assert resp.status_code == 200
        lb.refresh_from_db()
        assert lb.status == SessionLogbook.Status.SUMMARIZING

    def test_retry_ready_for_review_without_transcript_rejected(self, lecturer_user, pending_submission):
        # READY_FOR_REVIEW tanpa transkrip & tanpa rekaman → tidak ada yang bisa diulang.
        lb = _failed_logbook(pending_submission, with_recording=False)
        lb.status = SessionLogbook.Status.READY_FOR_REVIEW
        lb.save(update_fields=['status'])
        resp = client_for(lecturer_user).post(url(lb.session_id))
        assert resp.status_code == 400

    def test_other_lecturer_forbidden(self, lecturer_user, approved_lecturer, pending_submission):
        lb = _failed_logbook(pending_submission)
        resp = client_for(approved_lecturer).post(url(lb.session_id))
        assert resp.status_code == 403

    def test_missing_logbook_404(self, lecturer_user):
        resp = client_for(lecturer_user).post(url(999999))
        assert resp.status_code == 404
