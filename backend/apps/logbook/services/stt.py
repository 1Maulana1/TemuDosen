"""
Phase 6 (06-03): pembungkus Speech-to-Text — Groq Whisper API atau faster-whisper lokal.

Desain:
  - Dua provider, dipilih via STT_PROVIDER:
      'groq'  → Groq Audio Transcriptions API (whisper-large-v3-turbo, free tier).
                Ringan di server (hanya HTTP call) — satu-satunya opsi realistis
                di hosting free-tier (RAM < 1GB).
      'local' → faster-whisper, model dimuat sekali per proses worker (cache
                `_MODEL`). Gratis penuh tapi butuh RAM ~1-2GB.
  - 'groq' tanpa GROQ_API_KEY → jatuh ke provider lokal (log warning), bukan error.
  - Dependency berat (`faster_whisper`, `httpx`) di-import MALAS (di dalam fungsi),
    tidak pernah saat import modul — sehingga app tetap boot tanpa paket terpasang.
  - Graceful degradation: bila STT_LLM_ENABLED off → langsung kembalikan
    ('', 0.0) tanpa menyentuh provider apa pun (D-08 fallback).
"""
import logging
from pathlib import Path

from django.conf import settings

logger = logging.getLogger(__name__)

_MODEL = None  # WhisperModel, dimuat sekali per worker

_GROQ_TRANSCRIPTIONS_URL = 'https://api.groq.com/openai/v1/audio/transcriptions'


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


def _transcribe_local(file_path):
    """Transkripsi via faster-whisper lokal → (teks, durasi_detik)."""
    model = _get_model()
    segments, info = model.transcribe(file_path, language=settings.STT_LANGUAGE)
    text = ' '.join(seg.text.strip() for seg in segments).strip()
    duration = float(getattr(info, 'duration', 0.0) or 0.0)
    return text, duration


def _transcribe_groq(file_path):
    """Transkripsi via Groq Whisper API → (teks, durasi_detik).

    Endpoint kompatibel-OpenAI; response_format=verbose_json menyertakan durasi.
    httpx sudah tersedia sebagai dependency transitif `anthropic`.
    """
    import httpx  # import malas

    path = Path(file_path)
    with path.open('rb') as f:
        response = httpx.post(
            _GROQ_TRANSCRIPTIONS_URL,
            headers={'Authorization': f'Bearer {settings.GROQ_API_KEY}'},
            files={'file': (path.name, f)},
            data={
                'model': settings.GROQ_STT_MODEL,
                'language': settings.STT_LANGUAGE,
                'response_format': 'verbose_json',
            },
            timeout=settings.GROQ_STT_TIMEOUT,
        )
    response.raise_for_status()
    payload = response.json()
    text = (payload.get('text') or '').strip()
    duration = float(payload.get('duration') or 0.0)
    return text, duration


def transcribe_audio(file_path):
    """Transkripsi satu file audio → (teks, durasi_detik).

    Aman dipanggil kapan pun: bila pipeline nonaktif, kembalikan hasil kosong
    tanpa memuat model atau dependency apa pun.
    """
    if not settings.STT_LLM_ENABLED:
        return '', 0.0

    if settings.STT_PROVIDER == 'groq':
        if settings.GROQ_API_KEY:
            return _transcribe_groq(file_path)
        logger.warning('STT_PROVIDER=groq tapi GROQ_API_KEY kosong — jatuh ke faster-whisper lokal')

    return _transcribe_local(file_path)
