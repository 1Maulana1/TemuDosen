"""
Phase 6 / Wave 6 (06-09-T1) — end-to-end pipeline integration tests.

Drives the real HTTP surface in one pass per test:
  CompleteSessionView -> transcribe_session -> submit_summary_batch ->
  poll_summary_batch -> ApproveLogbookView / ManualNotesView -> StudentLogbookView

CELERY_TASK_ALWAYS_EAGER=True (test settings) means the whole chain runs
synchronously inside the single POST to /complete/ — no manual task-chaining
needed here. STT (faster-whisper) and the Anthropic client are mocked; no
real model load, no network call.
"""
import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.bimbingan.models import Session, SystemLog
from apps.logbook import tasks as tasks_module
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


def _start(lecturer, session):
    resp = client_for(lecturer).post(
        f'/api/queue/{session.id}/start/',
        {'consent_by_dosen': True, 'consent_by_mahasiswa': True},
        format='json',
    )
    assert resp.status_code == 200, resp.data
    session.refresh_from_db()
    return session


def _complete_url(pk):
    return f'/api/queue/{pk}/complete/'


def _webm_upload(webm_audio_file):
    return SimpleUploadedFile(
        'session_recording.webm', webm_audio_file.read(), content_type='audio/webm',
    )


# ── Fake Anthropic Batch API ─────────────────────────────────────────────────
# poll_summary_batch matches results by custom_id == f'logbook-{logbook_id}',
# but the logbook doesn't exist until CompleteSessionView creates it mid-request
# — so the fake captures the *real* custom_id that submit_batch() generates
# (via build_batch_request) at create()-time, rather than pre-computing it.

class _FakeBatch:
    def __init__(self, batch_id):
        self.id = batch_id


class _FakeBatchStatus:
    def __init__(self, processing_status):
        self.processing_status = processing_status


class _ToolUseBlock:
    type = 'tool_use'

    def __init__(self, data):
        self.input = data


class _Usage:
    def __init__(self, input_tokens, output_tokens):
        self.input_tokens = input_tokens
        self.output_tokens = output_tokens


class _Message:
    def __init__(self, content, usage):
        self.content = content
        self.usage = usage


class _Result:
    def __init__(self, content, usage):
        self.type = 'succeeded'
        self.message = _Message(content, usage)


class _ResultWrapper:
    def __init__(self, custom_id, content, usage):
        self.custom_id = custom_id
        self.result = _Result(content, usage)


class _FakeBatchesAPI:
    def __init__(self, tool_input, input_tokens=200, output_tokens=80, batch_id='batch_e2e'):
        self._tool_input = tool_input
        self._input_tokens = input_tokens
        self._output_tokens = output_tokens
        self._batch_id = batch_id
        self.captured_custom_id = None

    def create(self, requests):
        req = requests[0]
        # anthropic's Request is a TypedDict (dict access), not an attribute-bearing object.
        self.captured_custom_id = req['custom_id'] if isinstance(req, dict) else req.custom_id
        return _FakeBatch(self._batch_id)

    def retrieve(self, batch_id):
        return _FakeBatchStatus('ended')

    def results(self, batch_id):
        return [_ResultWrapper(
            self.captured_custom_id,
            [_ToolUseBlock(self._tool_input)],
            _Usage(self._input_tokens, self._output_tokens),
        )]


def _install_fake_anthropic(monkeypatch, tool_input, **kwargs):
    """Patches the shared `anthropic` module object (tasks.py's `anthropic` and
    services/summarizer.py's `anthropic` are the same sys.modules entry), so
    one patch covers both submit_batch (summarizer.py) and poll_summary_batch
    (tasks.py) — letting the real submit/poll code execute, not a stub."""
    fake_batches = _FakeBatchesAPI(tool_input, **kwargs)

    class _FakeMessages:
        batches = fake_batches

    class _FakeClient:
        def __init__(self, api_key):
            self.messages = _FakeMessages()

    monkeypatch.setattr(tasks_module.anthropic, 'Anthropic', _FakeClient)
    return fake_batches


_TRANSCRIPT = 'Dosen menyarankan perbaikan metodologi penelitian, khususnya pada bagian sampling.'
_TOOL_INPUT = {
    'advice_points': [
        {'topic': 'Metodologi', 'detail': 'Perbaikan metodologi penelitian pada bagian sampling'},
    ],
    'improvement_notes': [],
}


@pytest.mark.django_db
class TestOfflineSessionFullPipeline:
    """06-09-T1 — offline: complete -> ready_for_review -> approve -> student-visible."""

    def test_offline_session_full_pipeline(
        self, monkeypatch, lecturer_user, advisee_student, second_advisee_student,
        pending_submission, webm_audio_file, tmp_path, settings,
    ):
        settings.MEDIA_ROOT = str(tmp_path)
        settings.STT_LLM_ENABLED = True
        settings.ANTHROPIC_API_KEY = 'sk-test'

        monkeypatch.setattr(tasks_module, 'transcribe_audio', lambda path: (_TRANSCRIPT, 12.0))
        _install_fake_anthropic(monkeypatch, _TOOL_INPUT)

        session = _start(lecturer_user, _approve(lecturer_user, pending_submission, method='offline'))

        resp = client_for(lecturer_user).post(
            _complete_url(session.id), {'audio': _webm_upload(webm_audio_file)}, format='multipart',
        )
        assert resp.status_code == 200, resp.data
        assert resp.data['has_recording'] is True

        logbook = SessionLogbook.objects.get(session=session)
        assert logbook.status == SessionLogbook.Status.READY_FOR_REVIEW
        assert logbook.source_mode == SessionLogbook.SourceMode.OFFLINE
        assert logbook.summary_raw['advice_points'][0]['topic'] == 'Metodologi'

        edited = logbook.summary_raw
        approve_resp = client_for(lecturer_user).post(
            f'/api/logbook/{session.id}/approve/', {'summary_edited': edited}, format='json',
        )
        assert approve_resp.status_code == 200, approve_resp.data
        logbook.refresh_from_db()
        assert logbook.status == SessionLogbook.Status.APPROVED
        assert logbook.approved_by == lecturer_user

        student_resp = client_for(advisee_student).get(f'/api/logbook/student/{session.id}/')
        assert student_resp.status_code == 200
        assert student_resp.data['status'] == 'approved'
        assert student_resp.data['summary_edited'] == edited

        non_owner_resp = client_for(second_advisee_student).get(f'/api/logbook/student/{session.id}/')
        assert non_owner_resp.status_code == 404


@pytest.mark.django_db
class TestOnlineSessionFullPipeline:
    """06-09-T1 — online (VIDEO-02/D-17): identical pipeline, source_mode=online."""

    def test_online_session_full_pipeline(
        self, monkeypatch, lecturer_user, advisee_student, second_advisee_student,
        pending_submission, webm_audio_file, tmp_path, settings,
    ):
        settings.MEDIA_ROOT = str(tmp_path)
        settings.STT_LLM_ENABLED = True
        settings.ANTHROPIC_API_KEY = 'sk-test'

        monkeypatch.setattr(tasks_module, 'transcribe_audio', lambda path: (_TRANSCRIPT, 15.0))
        _install_fake_anthropic(monkeypatch, _TOOL_INPUT)

        session = _start(lecturer_user, _approve(lecturer_user, pending_submission, method='online'))

        resp = client_for(lecturer_user).post(
            _complete_url(session.id), {'audio': _webm_upload(webm_audio_file)}, format='multipart',
        )
        assert resp.status_code == 200, resp.data

        logbook = SessionLogbook.objects.get(session=session)
        assert logbook.status == SessionLogbook.Status.READY_FOR_REVIEW
        assert logbook.source_mode == 'online'

        edited = logbook.summary_raw
        approve_resp = client_for(lecturer_user).post(
            f'/api/logbook/{session.id}/approve/', {'summary_edited': edited}, format='json',
        )
        assert approve_resp.status_code == 200, approve_resp.data

        student_resp = client_for(advisee_student).get(f'/api/logbook/student/{session.id}/')
        assert student_resp.status_code == 200
        assert student_resp.data['status'] == 'approved'
        assert student_resp.data['source_mode'] == 'online'

        non_owner_resp = client_for(second_advisee_student).get(f'/api/logbook/student/{session.id}/')
        assert non_owner_resp.status_code == 404


@pytest.mark.django_db
class TestDisabledPipelineFallsBackToManual:
    """06-09-T1 — STT-07: STT_LLM_ENABLED=False degrades cleanly to manual notes."""

    def test_disabled_pipeline_falls_back_to_manual(
        self, lecturer_user, advisee_student, pending_submission, webm_audio_file, tmp_path, settings,
    ):
        settings.MEDIA_ROOT = str(tmp_path)
        settings.STT_LLM_ENABLED = False

        session = _start(lecturer_user, _approve(lecturer_user, pending_submission))

        resp = client_for(lecturer_user).post(
            _complete_url(session.id), {'audio': _webm_upload(webm_audio_file)}, format='multipart',
        )
        assert resp.status_code == 200, resp.data

        logbook = SessionLogbook.objects.get(session=session)
        assert logbook.status == SessionLogbook.Status.FAILED
        assert SystemLog.objects.filter(
            event_type='STT_DISABLED', context__logbook_id=logbook.id,
        ).exists()

        manual_resp = client_for(lecturer_user).post(
            f'/api/logbook/{session.id}/manual-notes/',
            {'notes': 'Catatan manual (STT nonaktif).'}, format='json',
        )
        assert manual_resp.status_code == 200, manual_resp.data
        logbook.refresh_from_db()
        assert logbook.status == SessionLogbook.Status.APPROVED
        assert logbook.is_manual is True

        student_resp = client_for(advisee_student).get(f'/api/logbook/student/{session.id}/')
        assert student_resp.status_code == 200
        assert student_resp.data['summary_edited'] == {'manual_notes': 'Catatan manual (STT nonaktif).'}


@pytest.mark.django_db
class TestSttFailureLogsAndFallsBack:
    """06-09-T1 — STT-07: a real STT exception also degrades to manual notes."""

    def test_stt_failure_logs_and_falls_back(
        self, monkeypatch, lecturer_user, advisee_student, pending_submission,
        webm_audio_file, tmp_path, settings,
    ):
        settings.MEDIA_ROOT = str(tmp_path)
        settings.STT_LLM_ENABLED = True

        def _boom(path):
            raise RuntimeError('model crashed mid-transcription')

        monkeypatch.setattr(tasks_module, 'transcribe_audio', _boom)

        session = _start(lecturer_user, _approve(lecturer_user, pending_submission))

        resp = client_for(lecturer_user).post(
            _complete_url(session.id), {'audio': _webm_upload(webm_audio_file)}, format='multipart',
        )
        assert resp.status_code == 200, resp.data

        logbook = SessionLogbook.objects.get(session=session)
        assert logbook.status == SessionLogbook.Status.FAILED
        assert SystemLog.objects.filter(
            event_type='STT_FAILED', context__logbook_id=logbook.id,
        ).exists()

        manual_resp = client_for(lecturer_user).post(
            f'/api/logbook/{session.id}/manual-notes/',
            {'notes': 'STT gagal, catatan manual dosen.'}, format='json',
        )
        assert manual_resp.status_code == 200, manual_resp.data
        logbook.refresh_from_db()
        assert logbook.status == SessionLogbook.Status.APPROVED
        assert logbook.is_manual is True
