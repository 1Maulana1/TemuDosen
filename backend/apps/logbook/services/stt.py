"""
Phase 6 (06-03): pembungkus Speech-to-Text faster-whisper.

Desain:
  - `faster_whisper` di-import MALAS (di dalam fungsi), tidak pernah saat import
    modul — sehingga app tetap boot tanpa paket berat terpasang.
  - Model dimuat sekali per proses worker (cache `_MODEL`), tidak per-task.
  - Graceful degradation: bila STT_LLM_ENABLED off → langsung kembalikan
    ('', 0.0) tanpa menyentuh faster_whisper (D-08 fallback).
"""
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

_MODEL = None  # WhisperModel, dimuat sekali per worker


def _get_model():
    global _MODEL
    if _MODEL is None:
        from faster_whisper import WhisperModel  # import malas
        logger.info('Memuat model faster-whisper (%s, %s)…',
                    settings.STT_MODEL_SIZE, settings.STT_COMPUTE_TYPE)
        _MODEL = WhisperModel(
            settings.STT_MODEL_SIZE,
            compute_type=settings.STT_COMPUTE_TYPE,
            download_root=settings.STT_MODEL_DOWNLOAD_ROOT,
        )
    return _MODEL


def transcribe_audio(file_path):
    """Transkripsi satu file audio → (teks, durasi_detik).

    Aman dipanggil kapan pun: bila pipeline nonaktif, kembalikan hasil kosong
    tanpa memuat model atau dependency apa pun.
    """
    if not settings.STT_LLM_ENABLED:
        return '', 0.0

    model = _get_model()
    segments, info = model.transcribe(file_path, language=settings.STT_LANGUAGE)
    text = ' '.join(seg.text.strip() for seg in segments).strip()
    duration = float(getattr(info, 'duration', 0.0) or 0.0)
    return text, duration
