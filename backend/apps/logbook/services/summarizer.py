"""
Phase 6 (06-03): peringkas transkrip via Anthropic (forced tool call).

Desain:
  - `anthropic` dan schema Pydantic di-import MALAS — app boot tanpa paket berat.
  - Graceful degradation: bila STT_LLM_ENABLED off / ANTHROPIC_API_KEY kosong /
    transkrip kosong → kembalikan (None, 0, 0) tanpa memanggil API (D-08).
  - Memaksa tool call `record_summary` dengan input_schema dari
    SessionSummary (schemas.py) sehingga output selalu JSON terstruktur & tervalidasi.
"""
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

_TOOL_NAME = 'record_summary'
_SYSTEM_PROMPT = (
    'Anda meringkas transkrip sesi bimbingan skripsi dalam Bahasa Indonesia. '
    'Ekstrak HANYA saran konkret dari dosen dan area perbaikan untuk mahasiswa. '
    'Jangan mengarang; jika suatu daftar tidak ada isinya, kembalikan daftar kosong '
    '(jangan menulis "Tidak ada saran").'
)


def summarize_transcript(transcript):
    """Ringkas transkrip → (summary_dict, input_tokens, output_tokens).

    Mengembalikan (None, 0, 0) bila pipeline nonaktif atau transkrip kosong.
    """
    if not settings.STT_LLM_ENABLED or not settings.ANTHROPIC_API_KEY:
        return None, 0, 0
    if not transcript or not transcript.strip():
        return None, 0, 0

    from anthropic import Anthropic  # import malas
    from ..schemas import SessionSummary

    client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    tool = {
        'name': _TOOL_NAME,
        'description': 'Catat ringkasan terstruktur hasil sesi bimbingan.',
        'input_schema': SessionSummary.model_json_schema(),
    }
    message = client.messages.create(
        model=settings.LLM_MODEL,
        max_tokens=2000,
        system=[{'type': 'text', 'text': _SYSTEM_PROMPT,
                 'cache_control': {'type': 'ephemeral'}}],
        tools=[tool],
        tool_choice={'type': 'tool', 'name': _TOOL_NAME},
        messages=[{'role': 'user', 'content': transcript}],
    )

    tool_input = next(
        (block.input for block in message.content if getattr(block, 'type', None) == 'tool_use'),
        None,
    )
    if tool_input is None:
        raise ValueError('LLM tidak mengembalikan tool_use record_summary')

    # Validasi via Pydantic (menegakkan aturan anti-placeholder di schemas.py).
    validated = SessionSummary.model_validate(tool_input)
    return (
        validated.model_dump(),
        message.usage.input_tokens,
        message.usage.output_tokens,
    )


def estimate_cost_idr(input_tokens, output_tokens):
    """Estimasi biaya (IDR) dari jumlah token (D-11)."""
    usd = (
        (input_tokens / 1_000_000) * settings.LLM_INPUT_RATE_USD_PER_MTOK
        + (output_tokens / 1_000_000) * settings.LLM_OUTPUT_RATE_USD_PER_MTOK
    )
    return round(usd * settings.USD_TO_IDR_RATE, 2)
