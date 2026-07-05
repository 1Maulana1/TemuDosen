"""
Phase 6 / Wave 3 (06-05): the async pipeline spine.

transcribe_session -> submit_summary_batch -> poll_summary_batch. Triggered
from apps.bimbingan.views.CompleteSessionView via .delay() — fire-and-return,
never awaited (STT-02 non-blocking requirement).
"""
import re
import time

import anthropic
from celery import shared_task
from celery.exceptions import MaxRetriesExceededError, Retry
from django.conf import settings
from pydantic import ValidationError

from apps.bimbingan.models import SystemLog

from .models import SessionLogbook
from .services import summarizer as summarizer_service
from .services.stt import transcribe_audio


def _fail(logbook: SessionLogbook, event_type: str):
    logbook.status = SessionLogbook.Status.FAILED
    logbook.save(update_fields=['status', 'updated_at'])
    SystemLog.objects.create(
        level=SystemLog.Level.ERROR,
        event_type=event_type,
        context={'logbook_id': logbook.id},
    )


def _flag_ungrounded(summary_dict: dict, transcript: str) -> dict:
    """AI-SPEC.md Section 6 — cheap, deterministic transcript-token cross-check.
    Flags an item `grounded: False` when none of its key words appear verbatim
    in the transcript. Deterministic, no extra LLM call. Never blocks
    persistence — flag only, for the review UI's "Perlu Verifikasi" chip."""
    transcript_lower = transcript.lower()

    def _is_grounded(*texts):
        words = set()
        for text in texts:
            words.update(re.findall(r'[a-zA-Z0-9]{4,}', text.lower()))
        if not words:
            return True
        return any(word in transcript_lower for word in words)

    for item in summary_dict.get('advice_points', []):
        item['grounded'] = _is_grounded(item.get('topic', ''), item.get('detail', ''))
    for item in summary_dict.get('improvement_notes', []):
        item['grounded'] = _is_grounded(item.get('area', ''), item.get('action', ''))
    return summary_dict


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=2, ignore_result=True)
def transcribe_session(self, logbook_id: int):
    """STT stage (D-06): transcribe -> persist transcript/duration -> chain to
    summarization. STT-stage SLA (D-08): 2x audio duration, floor 5 minutes —
    measured post-hoc against actual wall-clock elapsed time, since the audio
    duration itself is only known once transcribe_audio returns."""
    logbook = SessionLogbook.objects.select_related('session__recording').get(id=logbook_id)

    if not settings.STT_LLM_ENABLED:
        _fail(logbook, 'STT_DISABLED')
        return

    recording = logbook.session.recording
    start = time.monotonic()
    try:
        transcript, duration = transcribe_audio(recording.file_path)
    except Exception as e:
        SystemLog.objects.create(
            level=SystemLog.Level.ERROR, event_type='STT_FAILED',
            message=str(e), context={'logbook_id': logbook_id},
        )
        _fail(logbook, 'STT_FAILED')
        return
    elapsed = time.monotonic() - start

    max_allowed = max(2 * duration, 300)
    if elapsed > max_allowed:
        SystemLog.objects.create(
            level=SystemLog.Level.ERROR, event_type='STT_TIMEOUT',
            context={'logbook_id': logbook_id, 'elapsed': elapsed, 'max_allowed': max_allowed},
        )
        _fail(logbook, 'STT_TIMEOUT')
        return

    recording.duration_seconds = duration
    recording.save(update_fields=['duration_seconds'])

    if not transcript.strip():
        _fail(logbook, 'STT_EMPTY')
        return

    logbook.transcript = transcript
    logbook.status = SessionLogbook.Status.SUMMARIZING
    logbook.save(update_fields=['transcript', 'status', 'updated_at'])

    submit_summary_batch.delay(logbook.id)


@shared_task(bind=True, autoretry_for=(anthropic.APIConnectionError,), retry_backoff=True, max_retries=3, ignore_result=True)
def submit_summary_batch(self, logbook_id: int):
    """LLM stage, part 1 (D-06): submit a batch-of-one, persist batch_id BEFORE
    any poll (State Management — a worker restart must resume via batch_id,
    never lose track of an in-flight batch)."""
    logbook = SessionLogbook.objects.get(id=logbook_id)

    if not summarizer_service._llm_enabled():
        _fail(logbook, 'LLM_DISABLED')
        return

    batch_id = summarizer_service.submit_batch(logbook_id, logbook.transcript)
    logbook.batch_id = batch_id
    logbook.status = SessionLogbook.Status.SUMMARIZING
    logbook.save(update_fields=['batch_id', 'status', 'updated_at'])

    poll_summary_batch.apply_async(args=[logbook.id], countdown=60)


@shared_task(bind=True, max_retries=int(settings.LLM_BATCH_TIMEOUT_MINUTES), ignore_result=True)
def poll_summary_batch(self, logbook_id: int):
    """LLM stage, part 2 (D-06/D-08): re-queues itself via self.retry(countdown=60)
    instead of blocking a worker with an in-process sleep loop. The retry
    ceiling is derived from LLM_BATCH_TIMEOUT_MINUTES (D-08) — exhausting it is
    a distinct LLM_TIMEOUT, never conflated with a genuine LLM_FAILED."""
    logbook = SessionLogbook.objects.get(id=logbook_id)
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    batch = client.messages.batches.retrieve(logbook.batch_id)

    if batch.processing_status != 'ended':
        try:
            raise self.retry(countdown=60)
        except MaxRetriesExceededError:
            SystemLog.objects.create(
                level=SystemLog.Level.ERROR, event_type='LLM_TIMEOUT',
                context={'logbook_id': logbook_id},
            )
            _fail(logbook, 'LLM_TIMEOUT')
        except Retry:
            pass
        return

    for result in client.messages.batches.results(logbook.batch_id):
        if result.custom_id != f'logbook-{logbook_id}':
            continue  # batch-of-one today; custom_id matching is a hard requirement regardless

        try:
            summary = summarizer_service.parse_result(result)
        except ValidationError as e:
            prior_failures = SystemLog.objects.filter(
                event_type='LLM_VALIDATION_FAILED', context__logbook_id=logbook_id,
            ).count()
            SystemLog.objects.create(
                level=SystemLog.Level.ERROR, event_type='LLM_VALIDATION_FAILED',
                message=str(e), context={'logbook_id': logbook_id},
            )
            if prior_failures >= 1:
                _fail(logbook, 'LLM_VALIDATION_FAILED')
            else:
                submit_summary_batch.delay(logbook_id)  # one re-submit before giving up
            return

        if summary is None:
            SystemLog.objects.create(
                level=SystemLog.Level.ERROR, event_type='LLM_FAILED',
                context={'logbook_id': logbook_id},
            )
            _fail(logbook, 'LLM_FAILED')
            return

        usage = result.result.message.usage
        input_tokens = usage.input_tokens
        output_tokens = usage.output_tokens
        cost_idr = summarizer_service.compute_cost_idr(input_tokens, output_tokens)

        summary_dict = _flag_ungrounded(summary.model_dump(mode='json'), logbook.transcript)

        logbook.summary_raw = summary_dict
        logbook.llm_input_tokens = input_tokens
        logbook.llm_output_tokens = output_tokens
        logbook.llm_cost_estimate_idr = cost_idr
        logbook.status = SessionLogbook.Status.READY_FOR_REVIEW
        logbook.save(update_fields=[
            'summary_raw', 'llm_input_tokens', 'llm_output_tokens',
            'llm_cost_estimate_idr', 'status', 'updated_at',
        ])
        return
