"""
Phase 6 / Wave 3 (06-05): the transcribe_session -> submit_summary_batch ->
poll_summary_batch chain, run eagerly (CELERY_TASK_ALWAYS_EAGER=True in test
settings). No live Redis broker, no real WhisperModel/Anthropic client.
"""
from decimal import Decimal

import pytest
from django.utils import timezone

from apps.bimbingan.models import Session, SessionRecording, SystemLog
from apps.logbook import tasks as tasks_module
from apps.logbook.models import SessionLogbook
from apps.logbook.schemas import AdvicePoint, ImprovementNote, SessionSummary
from apps.submissions.models import Submission


def _make_logbook_with_recording(student, submission_for, logbook_status=SessionLogbook.Status.PENDING, **overrides):
    submission = submission_for(student)
    submission.status = Submission.Status.APPROVED
    submission.save(update_fields=['status'])
    session = Session.objects.create(
        submission=submission,
        status=Session.Status.DONE,
        method=Session.Method.OFFLINE,
        estimated_minutes=45,
        scheduled_at=timezone.now(),
        ts2=timezone.now(),
    )
    SessionRecording.objects.create(
        session=session,
        original_filename='rekaman.webm',
        file_path='/tmp/fake-recording.webm',
        file_size=1024,
        mime_type='audio/webm',
    )
    defaults = dict(session=session, status=logbook_status)
    defaults.update(overrides)
    return SessionLogbook.objects.create(**defaults)


class _FakeBatch:
    def __init__(self, batch_id='batch_xyz'):
        self.id = batch_id


@pytest.mark.django_db
class TestTranscribeSession:
    """06-05-T1 — STT stage: transcribe -> persist -> chain, with distinct failure paths."""

    def test_success_sets_transcript_duration_and_enqueues_summarize(
        self, settings, monkeypatch, advisee_student, submission_for,
    ):
        settings.STT_LLM_ENABLED = True
        logbook = _make_logbook_with_recording(advisee_student, submission_for)

        monkeypatch.setattr(tasks_module, 'transcribe_audio', lambda path: ('teks hasil transkrip', 12.0))
        enqueued = {}
        monkeypatch.setattr(
            tasks_module.submit_summary_batch, 'delay',
            lambda logbook_id: enqueued.setdefault('logbook_id', logbook_id),
        )

        tasks_module.transcribe_session(logbook.id)

        logbook.refresh_from_db()
        recording = logbook.session.recording
        recording.refresh_from_db()
        assert logbook.transcript == 'teks hasil transkrip'
        assert recording.duration_seconds == 12.0
        assert logbook.status == SessionLogbook.Status.SUMMARIZING
        assert enqueued['logbook_id'] == logbook.id

    def test_disabled_flag_fails_without_calling_transcribe(
        self, settings, monkeypatch, advisee_student, submission_for,
    ):
        settings.STT_LLM_ENABLED = False
        logbook = _make_logbook_with_recording(advisee_student, submission_for)

        called = {'yes': False}

        def _should_not_be_called(path):
            called['yes'] = True
            return ('should not happen', 1.0)

        monkeypatch.setattr(tasks_module, 'transcribe_audio', _should_not_be_called)

        tasks_module.transcribe_session(logbook.id)

        logbook.refresh_from_db()
        assert called['yes'] is False
        assert logbook.status == SessionLogbook.Status.FAILED
        assert SystemLog.objects.filter(event_type='STT_DISABLED', context__logbook_id=logbook.id).exists()

    def test_transcribe_exception_sets_stt_failed(self, settings, monkeypatch, advisee_student, submission_for):
        settings.STT_LLM_ENABLED = True
        logbook = _make_logbook_with_recording(advisee_student, submission_for)

        def _boom(path):
            raise RuntimeError('model crashed')

        monkeypatch.setattr(tasks_module, 'transcribe_audio', _boom)

        tasks_module.transcribe_session(logbook.id)

        logbook.refresh_from_db()
        assert logbook.status == SessionLogbook.Status.FAILED
        assert SystemLog.objects.filter(event_type='STT_FAILED', context__logbook_id=logbook.id).exists()

    def test_empty_transcript_sets_stt_empty_and_skips_llm(
        self, settings, monkeypatch, advisee_student, submission_for,
    ):
        settings.STT_LLM_ENABLED = True
        logbook = _make_logbook_with_recording(advisee_student, submission_for)

        monkeypatch.setattr(tasks_module, 'transcribe_audio', lambda path: ('   ', 5.0))
        enqueued = {'called': False}
        monkeypatch.setattr(
            tasks_module.submit_summary_batch, 'delay',
            lambda logbook_id: enqueued.__setitem__('called', True),
        )

        tasks_module.transcribe_session(logbook.id)

        logbook.refresh_from_db()
        assert logbook.status == SessionLogbook.Status.FAILED
        assert SystemLog.objects.filter(event_type='STT_EMPTY', context__logbook_id=logbook.id).exists()
        assert enqueued['called'] is False

    def test_stt_timeout_when_elapsed_exceeds_sla(self, settings, monkeypatch, advisee_student, submission_for):
        settings.STT_LLM_ENABLED = True
        logbook = _make_logbook_with_recording(advisee_student, submission_for)

        monkeypatch.setattr(tasks_module, 'transcribe_audio', lambda path: ('teks', 12.0))
        # max_allowed = max(2*12, 300) = 300s; simulate an elapsed gap far beyond that.
        monkeypatch.setattr(tasks_module.time, 'monotonic', iter([0.0, 9999.0]).__next__)

        tasks_module.transcribe_session(logbook.id)

        logbook.refresh_from_db()
        assert logbook.status == SessionLogbook.Status.FAILED
        assert SystemLog.objects.filter(event_type='STT_TIMEOUT', context__logbook_id=logbook.id).exists()


@pytest.mark.django_db
class TestCompleteSessionViewTrigger:
    """CompleteSessionView creates exactly one SessionLogbook and fires the
    pipeline non-blocking when a recording exists; skips entirely otherwise."""

    def test_complete_with_recording_creates_logbook_and_returns_200(
        self, authenticated_lecturer, lecturer_user, advisee_student, submission_for, webm_audio_file, settings,
    ):
        settings.STT_LLM_ENABLED = False  # keep the eager-mode pipeline cheap/disabled for this HTTP-level test
        submission = submission_for(advisee_student)
        submission.status = Submission.Status.APPROVED
        submission.save(update_fields=['status'])
        session = Session.objects.create(
            submission=submission, status=Session.Status.IN_PROGRESS,
            method=Session.Method.OFFLINE, estimated_minutes=45, scheduled_at=timezone.now(),
            consent_given_at=timezone.now(), consent_by_dosen=True, consent_by_mahasiswa=True,
        )

        response = authenticated_lecturer.post(
            f'/api/queue/{session.pk}/complete/', {'audio': webm_audio_file}, format='multipart',
        )

        assert response.status_code == 200
        assert SessionLogbook.objects.filter(session=session).count() == 1
        logbook = SessionLogbook.objects.get(session=session)
        assert logbook.source_mode == session.method

    def test_complete_without_recording_creates_no_logbook(
        self, authenticated_lecturer, lecturer_user, advisee_student, submission_for,
    ):
        submission = submission_for(advisee_student)
        submission.status = Submission.Status.APPROVED
        submission.save(update_fields=['status'])
        session = Session.objects.create(
            submission=submission, status=Session.Status.IN_PROGRESS,
            method=Session.Method.OFFLINE, estimated_minutes=45, scheduled_at=timezone.now(),
        )

        response = authenticated_lecturer.post(f'/api/queue/{session.pk}/complete/', {}, format='multipart')

        assert response.status_code == 200
        assert SessionLogbook.objects.filter(session=session).count() == 0


@pytest.mark.django_db
class TestSubmitSummaryBatch:
    """06-05-T2 — LLM stage part 1: submit batch-of-one, persist batch_id BEFORE polling."""

    def test_submit_persists_batch_id_and_schedules_poll(
        self, settings, monkeypatch, advisee_student, submission_for,
    ):
        settings.STT_LLM_ENABLED = True
        settings.ANTHROPIC_API_KEY = 'sk-test'
        logbook = _make_logbook_with_recording(
            advisee_student, submission_for, logbook_status=SessionLogbook.Status.SUMMARIZING,
            transcript='transkrip contoh',
        )

        monkeypatch.setattr(tasks_module.summarizer_service, 'submit_batch', lambda lid, t: 'batch_xyz')
        scheduled = {}

        def _fake_apply_async(args, countdown):
            scheduled['args'] = args
            scheduled['countdown'] = countdown

        monkeypatch.setattr(tasks_module.poll_summary_batch, 'apply_async', _fake_apply_async)

        tasks_module.submit_summary_batch(logbook.id)

        logbook.refresh_from_db()
        assert logbook.batch_id == 'batch_xyz'
        assert logbook.status == SessionLogbook.Status.SUMMARIZING
        assert scheduled['args'] == [logbook.id]
        assert scheduled['countdown'] == 60

    def test_submit_skipped_when_stt_llm_disabled(self, settings, monkeypatch, advisee_student, submission_for):
        """Closes the 06-03-T2 verification debt: submit_batch must NOT be
        called when the caller's _llm_enabled() guard is False."""
        settings.STT_LLM_ENABLED = False
        settings.ANTHROPIC_API_KEY = 'sk-test'
        logbook = _make_logbook_with_recording(
            advisee_student, submission_for, logbook_status=SessionLogbook.Status.SUMMARIZING,
            transcript='transkrip contoh',
        )

        called = {'yes': False}
        monkeypatch.setattr(
            tasks_module.summarizer_service, 'submit_batch',
            lambda lid, t: called.__setitem__('yes', True) or 'unexpected',
        )

        tasks_module.submit_summary_batch(logbook.id)

        logbook.refresh_from_db()
        assert called['yes'] is False
        assert logbook.status == SessionLogbook.Status.FAILED
        assert SystemLog.objects.filter(event_type='LLM_DISABLED', context__logbook_id=logbook.id).exists()

    def test_submit_skipped_when_api_key_absent(self, settings, monkeypatch, advisee_student, submission_for):
        settings.STT_LLM_ENABLED = True
        settings.ANTHROPIC_API_KEY = ''
        logbook = _make_logbook_with_recording(
            advisee_student, submission_for, logbook_status=SessionLogbook.Status.SUMMARIZING,
            transcript='transkrip contoh',
        )

        called = {'yes': False}
        monkeypatch.setattr(
            tasks_module.summarizer_service, 'submit_batch',
            lambda lid, t: called.__setitem__('yes', True) or 'unexpected',
        )

        tasks_module.submit_summary_batch(logbook.id)

        assert called['yes'] is False
        logbook.refresh_from_db()
        assert logbook.status == SessionLogbook.Status.FAILED
        assert SystemLog.objects.filter(event_type='LLM_DISABLED', context__logbook_id=logbook.id).exists()


def _fake_batch_result(logbook_id, result_type='succeeded', tool_input=None, input_tokens=100, output_tokens=50):
    class _ToolUseBlock:
        type = 'tool_use'

        def __init__(self, data):
            self.input = data

    class _Usage:
        def __init__(self, i, o):
            self.input_tokens = i
            self.output_tokens = o

    class _Message:
        def __init__(self, content, usage):
            self.content = content
            self.usage = usage

    class _Result:
        def __init__(self, rtype, content, usage):
            self.type = rtype
            self.message = _Message(content, usage)

    class _ResultWrapper:
        def __init__(self, custom_id, rtype, content, usage):
            self.custom_id = custom_id
            self.result = _Result(rtype, content, usage)

    content = [_ToolUseBlock(tool_input)] if tool_input is not None else []
    return _ResultWrapper(f'logbook-{logbook_id}', result_type, content, _Usage(input_tokens, output_tokens))


class _FakeBatchStatus:
    def __init__(self, status):
        self.processing_status = status


@pytest.mark.django_db
class TestPollSummaryBatch:
    """06-05-T2 — LLM stage part 2: retrieve/parse, persist token/cost once, groundedness flags."""

    def _base_logbook(self, advisee_student, submission_for):
        return _make_logbook_with_recording(
            advisee_student, submission_for, logbook_status=SessionLogbook.Status.SUMMARIZING,
            transcript='Dosen menyarankan perbaikan metodologi penelitian.',
            batch_id='batch_xyz',
        )

    def test_still_in_progress_retries_without_failing(
        self, settings, monkeypatch, advisee_student, submission_for,
    ):
        settings.ANTHROPIC_API_KEY = 'sk-test'
        logbook = self._base_logbook(advisee_student, submission_for)

        class _FakeBatches:
            def retrieve(self, batch_id):
                return _FakeBatchStatus('in_progress')

        class _FakeMessages:
            batches = _FakeBatches()

        class _FakeClient:
            def __init__(self, api_key):
                self.messages = _FakeMessages()

        monkeypatch.setattr(tasks_module.anthropic, 'Anthropic', _FakeClient)
        monkeypatch.setattr(tasks_module.poll_summary_batch, 'retry', lambda countdown: (_ for _ in ()).throw(tasks_module.Retry()))

        tasks_module.poll_summary_batch(logbook.id)

        logbook.refresh_from_db()
        assert logbook.status == SessionLogbook.Status.SUMMARIZING  # unchanged — still waiting

    def test_retry_exhaustion_sets_llm_timeout(self, settings, monkeypatch, advisee_student, submission_for):
        settings.ANTHROPIC_API_KEY = 'sk-test'
        logbook = self._base_logbook(advisee_student, submission_for)

        class _FakeBatches:
            def retrieve(self, batch_id):
                return _FakeBatchStatus('in_progress')

        class _FakeMessages:
            batches = _FakeBatches()

        class _FakeClient:
            def __init__(self, api_key):
                self.messages = _FakeMessages()

        monkeypatch.setattr(tasks_module.anthropic, 'Anthropic', _FakeClient)
        monkeypatch.setattr(
            tasks_module.poll_summary_batch, 'retry',
            lambda countdown: (_ for _ in ()).throw(tasks_module.MaxRetriesExceededError()),
        )

        tasks_module.poll_summary_batch(logbook.id)

        logbook.refresh_from_db()
        assert logbook.status == SessionLogbook.Status.FAILED
        assert SystemLog.objects.filter(event_type='LLM_TIMEOUT', context__logbook_id=logbook.id).exists()

    def test_success_persists_summary_tokens_cost_and_groundedness(
        self, settings, monkeypatch, advisee_student, submission_for,
    ):
        settings.ANTHROPIC_API_KEY = 'sk-test'
        settings.LLM_INPUT_RATE_USD_PER_MTOK = 0.50
        settings.LLM_OUTPUT_RATE_USD_PER_MTOK = 2.50
        settings.USD_TO_IDR = 16500
        logbook = self._base_logbook(advisee_student, submission_for)

        tool_input = {
            'advice_points': [
                {'topic': 'Metodologi', 'detail': 'Perbaikan metodologi penelitian'},  # grounded
                {'topic': 'Statistik', 'detail': 'Gunakan uji regresi logistik ganda'},  # ungrounded
            ],
            'improvement_notes': [],
        }
        result = _fake_batch_result(logbook.id, 'succeeded', tool_input, input_tokens=1000, output_tokens=500)

        class _FakeBatches:
            def retrieve(self, batch_id):
                return _FakeBatchStatus('ended')

            def results(self, batch_id):
                return [result]

        class _FakeMessages:
            batches = _FakeBatches()

        class _FakeClient:
            def __init__(self, api_key):
                self.messages = _FakeMessages()

        monkeypatch.setattr(tasks_module.anthropic, 'Anthropic', _FakeClient)

        tasks_module.poll_summary_batch(logbook.id)

        logbook.refresh_from_db()
        assert logbook.status == SessionLogbook.Status.READY_FOR_REVIEW
        assert logbook.llm_input_tokens == 1000
        assert logbook.llm_output_tokens == 500
        expected_cost = (Decimal('1000') / Decimal(1_000_000) * Decimal('0.50')
                          + Decimal('500') / Decimal(1_000_000) * Decimal('2.50')) * Decimal('16500')
        # DecimalField(decimal_places=2) rounds on save — compare at the same precision.
        assert logbook.llm_cost_estimate_idr == expected_cost.quantize(Decimal('0.01'))
        points = logbook.summary_raw['advice_points']
        assert points[0]['grounded'] is True
        assert points[1]['grounded'] is False

    def test_non_succeeded_result_sets_llm_failed(self, settings, monkeypatch, advisee_student, submission_for):
        settings.ANTHROPIC_API_KEY = 'sk-test'
        logbook = self._base_logbook(advisee_student, submission_for)
        result = _fake_batch_result(logbook.id, 'errored')

        class _FakeBatches:
            def retrieve(self, batch_id):
                return _FakeBatchStatus('ended')

            def results(self, batch_id):
                return [result]

        class _FakeMessages:
            batches = _FakeBatches()

        class _FakeClient:
            def __init__(self, api_key):
                self.messages = _FakeMessages()

        monkeypatch.setattr(tasks_module.anthropic, 'Anthropic', _FakeClient)

        tasks_module.poll_summary_batch(logbook.id)

        logbook.refresh_from_db()
        assert logbook.status == SessionLogbook.Status.FAILED
        assert SystemLog.objects.filter(event_type='LLM_FAILED', context__logbook_id=logbook.id).exists()

    def test_validation_failure_retries_once_then_fails(
        self, settings, monkeypatch, advisee_student, submission_for,
    ):
        settings.ANTHROPIC_API_KEY = 'sk-test'
        logbook = self._base_logbook(advisee_student, submission_for)
        # Missing required 'detail' field on the advice_point -> Pydantic ValidationError.
        bad_input = {'advice_points': [{'topic': 'X'}], 'improvement_notes': []}
        result = _fake_batch_result(logbook.id, 'succeeded', bad_input)

        class _FakeBatches:
            def retrieve(self, batch_id):
                return _FakeBatchStatus('ended')

            def results(self, batch_id):
                return [result]

        class _FakeMessages:
            batches = _FakeBatches()

        class _FakeClient:
            def __init__(self, api_key):
                self.messages = _FakeMessages()

        monkeypatch.setattr(tasks_module.anthropic, 'Anthropic', _FakeClient)
        resubmitted = {'called': False}
        monkeypatch.setattr(
            tasks_module.submit_summary_batch, 'delay',
            lambda logbook_id: resubmitted.__setitem__('called', True),
        )

        # First validation failure -> one re-submit, not yet failed.
        tasks_module.poll_summary_batch(logbook.id)
        logbook.refresh_from_db()
        assert resubmitted['called'] is True
        assert logbook.status == SessionLogbook.Status.SUMMARIZING
        assert SystemLog.objects.filter(event_type='LLM_VALIDATION_FAILED', context__logbook_id=logbook.id).count() == 1

        # Second validation failure -> exhausted, now fails. _fail() logs its own
        # SystemLog row in addition to the detailed one just above (matching the
        # same double-log shape as _fail's other callers, e.g. STT_FAILED) — 2
        # explicit rows (one per call) + 1 from _fail() on the second call = 3.
        tasks_module.poll_summary_batch(logbook.id)
        logbook.refresh_from_db()
        assert logbook.status == SessionLogbook.Status.FAILED
        assert SystemLog.objects.filter(event_type='LLM_VALIDATION_FAILED', context__logbook_id=logbook.id).count() == 3
