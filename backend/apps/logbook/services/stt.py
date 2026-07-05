"""
Phase 6 (06-RESEARCH.md Pattern 2): faster-whisper STT service wrapper.

The model is loaded exactly once per forked Celery worker process via the
worker_process_init signal — never inside a task body, never before the fork.
Loading it eagerly at import time (or re-instantiating per task) is the exact
pattern reported to hang the process under prefork (faster-whisper#907).
"""
import logging

from celery.signals import worker_process_init
from django.conf import settings

logger = logging.getLogger(__name__)

_model = None  # module-level global, one per forked worker process


@worker_process_init.connect
def load_whisper_model(**kwargs):
    """Load the model ONCE when each worker child process starts."""
    global _model
    from faster_whisper import WhisperModel
    _model = WhisperModel(
        settings.STT_MODEL_SIZE,
        device="cpu",
        compute_type=settings.STT_COMPUTE_TYPE,
        download_root=settings.STT_MODEL_DOWNLOAD_ROOT,
    )


def get_model():
    if _model is None:
        # Fallback for contexts without the signal (e.g. eager/test mode) — not the hot path.
        load_whisper_model()
    return _model


def _stt_enabled() -> bool:
    return getattr(settings, 'STT_LLM_ENABLED', False)


def _log_error(message: str, context: dict, event_type: str = 'STT_FAILED'):
    from apps.bimbingan.models import SystemLog
    try:
        SystemLog.objects.create(
            level=SystemLog.Level.ERROR,
            event_type=event_type,
            message=message,
            context=context,
        )
    except Exception:
        pass
    logger.error('[STTService] %s', message)


def transcribe_audio(file_path: str) -> tuple[str, float]:
    """Returns (full_transcript_text, audio_duration_seconds) from a single
    faster-whisper call. info.duration is the authoritative D-02 duration —
    no separate ffprobe call is made."""
    model = get_model()
    segments, info = model.transcribe(
        file_path,
        language=settings.STT_LANGUAGE,
    )
    transcript = " ".join(segment.text.strip() for segment in segments)
    return transcript, info.duration
