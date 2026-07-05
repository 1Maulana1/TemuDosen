"""
Phase 6 (06-05): task Celery pipeline STT -> LLM untuk SessionLogbook.

Alur status (D-06):
  pending -> transcribing -> summarizing -> ready_for_review   (sukses)
                                         -> failed              (galat / degradasi)

Guard: bila `celery` tidak terpasang, `shared_task` digantikan decorator no-op
sehingga modul tetap importable dan fungsi bisa dipanggil sinkron (mis. saat
dispatcher memanggil langsung tanpa broker). Semua task ignore_result=True —
status dilacak di SessionLogbook, bukan result backend (hindari regresi #10294).
"""
import logging

from django.utils import timezone

logger = logging.getLogger(__name__)

try:
    from celery import shared_task
except ImportError:  # celery belum terpasang → decorator no-op
    def shared_task(*dargs, **dkwargs):
        def _wrap(func):
            func.delay = func  # panggil sinkron bila tak ada broker
            return func
        return _wrap(dargs[0]) if dargs and callable(dargs[0]) else _wrap


def _enqueue(task, *args):
    """Jalankan lewat broker bila tersedia, selain itu sinkron."""
    from config import celery_app
    if celery_app is not None:
        task.delay(*args)
    else:
        task(*args)


@shared_task(ignore_result=True, queue='stt')
def transcribe_session(logbook_id):
    from .models import SessionLogbook
    from .services.stt import transcribe_audio

    lb = SessionLogbook.objects.select_related('session__recording').get(id=logbook_id)
    recording = getattr(lb.session, 'recording', None)
    if recording is None:
        lb.status = SessionLogbook.Status.FAILED
        lb.save(update_fields=['status', 'updated_at'])
        logger.warning('Logbook #%s: tidak ada rekaman untuk ditranskripsi', logbook_id)
        return

    lb.status = SessionLogbook.Status.TRANSCRIBING
    lb.save(update_fields=['status', 'updated_at'])
    try:
        transcript, duration = transcribe_audio(recording.file_path)
    except Exception:
        logger.exception('Logbook #%s: STT gagal', logbook_id)
        lb.status = SessionLogbook.Status.FAILED
        lb.save(update_fields=['status', 'updated_at'])
        return

    lb.transcript = transcript
    lb.status = SessionLogbook.Status.SUMMARIZING
    lb.save(update_fields=['transcript', 'status', 'updated_at'])
    if duration:
        recording.duration_seconds = duration
        recording.save(update_fields=['duration_seconds'])

    _enqueue(summarize_session, logbook_id)


@shared_task(ignore_result=True, queue='llm')
def summarize_session(logbook_id):
    from .models import SessionLogbook
    from .services.summarizer import summarize_transcript, estimate_cost_idr

    lb = SessionLogbook.objects.get(id=logbook_id)
    try:
        summary, in_tok, out_tok = summarize_transcript(lb.transcript)
    except Exception:
        logger.exception('Logbook #%s: ringkasan LLM gagal', logbook_id)
        lb.status = SessionLogbook.Status.FAILED
        lb.save(update_fields=['status', 'updated_at'])
        return

    if summary is None:
        # Pipeline nonaktif / transkrip kosong → serahkan ke jalur manual (STT-07).
        lb.status = SessionLogbook.Status.FAILED
        lb.save(update_fields=['status', 'updated_at'])
        return

    lb.summary_raw = summary
    lb.llm_input_tokens = in_tok
    lb.llm_output_tokens = out_tok
    lb.llm_cost_estimate_idr = estimate_cost_idr(in_tok, out_tok)
    lb.status = SessionLogbook.Status.READY_FOR_REVIEW
    lb.save(update_fields=[
        'summary_raw', 'llm_input_tokens', 'llm_output_tokens',
        'llm_cost_estimate_idr', 'status', 'updated_at',
    ])
    logger.info('Logbook #%s: ringkasan siap ditinjau (%s+%s token)', logbook_id, in_tok, out_tok)


def dispatch_pipeline(logbook):
    """Mulai pipeline STT->LLM untuk sebuah logbook, bila fitur aktif & broker ada.

    Aman dipanggil selalu: bila STT_LLM_ENABLED off atau celery tak terpasang,
    tidak melakukan apa-apa (logbook tetap pending untuk jalur manual).
    """
    from django.conf import settings
    from config import celery_app

    if not settings.STT_LLM_ENABLED or celery_app is None:
        return False
    _enqueue(transcribe_session, logbook.id)
    return True
