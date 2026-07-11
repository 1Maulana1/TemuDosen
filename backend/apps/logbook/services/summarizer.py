"""
Phase 6 (06-03): peringkas transkrip via LLM (forced tool call) — Groq atau Anthropic.

Desain:
  - Dua provider, dipilih via LLM_PROVIDER:
      'groq'      → Groq chat completions (llama-3.3-70b, free tier) via httpx —
                    satu GROQ_API_KEY menggerakkan STT + LLM sekaligus.
      'anthropic' → Anthropic Messages API (claude), kualitas tertinggi, berbayar.
    'groq' tanpa GROQ_API_KEY jatuh ke Anthropic (bila key-nya ada), bukan error.
  - Dependency berat (`anthropic`, `httpx`, schema Pydantic) di-import MALAS —
    app boot tanpa paket terpasang.
  - Graceful degradation: bila STT_LLM_ENABLED off / tidak ada API key sama
    sekali / transkrip kosong → kembalikan (None, 0, 0) tanpa memanggil API (D-08).
  - Kedua provider memaksa tool call `record_summary` dengan schema dari
    SessionSummary (schemas.py) sehingga output selalu JSON terstruktur & tervalidasi.
"""
import json
import logging
import re

from django.conf import settings

logger = logging.getLogger(__name__)

_TOOL_NAME = 'record_summary'
_TOOL_DESCRIPTION = 'Catat ringkasan terstruktur hasil sesi bimbingan.'
_SYSTEM_PROMPT = (
    'Anda meringkas transkrip sesi bimbingan skripsi dalam Bahasa Indonesia. '
    'Ekstrak HANYA saran konkret dari dosen dan area perbaikan untuk mahasiswa. '
    'Jangan mengarang; jika suatu daftar tidak ada isinya, kembalikan daftar kosong '
    '(jangan menulis "Tidak ada saran").'
)

_GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions'


def _summarize_groq(transcript):
    """Ringkas via Groq (API kompatibel-OpenAI, forced function call)."""
    import httpx  # import malas
    from ..schemas import SessionSummary

    response = httpx.post(
        _GROQ_CHAT_URL,
        headers={'Authorization': f'Bearer {settings.GROQ_API_KEY}'},
        json={
            'model': settings.GROQ_LLM_MODEL,
            'max_tokens': 2000,
            'messages': [
                {'role': 'system', 'content': _SYSTEM_PROMPT},
                {'role': 'user', 'content': transcript},
            ],
            'tools': [{
                'type': 'function',
                'function': {
                    'name': _TOOL_NAME,
                    'description': _TOOL_DESCRIPTION,
                    'parameters': SessionSummary.model_json_schema(),
                },
            }],
            'tool_choice': {'type': 'function', 'function': {'name': _TOOL_NAME}},
        },
        timeout=settings.GROQ_LLM_TIMEOUT,
    )
    response.raise_for_status()
    data = response.json()

    tool_calls = (data['choices'][0]['message'].get('tool_calls') or [])
    if not tool_calls:
        raise ValueError('LLM (groq) tidak mengembalikan tool call record_summary')
    tool_input = json.loads(tool_calls[0]['function']['arguments'])

    # Validasi via Pydantic (menegakkan aturan anti-placeholder di schemas.py).
    validated = SessionSummary.model_validate(tool_input)
    usage = data.get('usage', {})
    return (
        validated.model_dump(),
        int(usage.get('prompt_tokens', 0)),
        int(usage.get('completion_tokens', 0)),
    )


def _summarize_anthropic(transcript):
    """Ringkas via Anthropic Messages API (forced tool call)."""
    from anthropic import Anthropic  # import malas
    from ..schemas import SessionSummary

    client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    tool = {
        'name': _TOOL_NAME,
        'description': _TOOL_DESCRIPTION,
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


def summarize_transcript(transcript):
    """Ringkas transkrip → (summary_dict, input_tokens, output_tokens).

    Mengembalikan (None, 0, 0) bila pipeline nonaktif, tidak ada API key yang
    bisa dipakai, atau transkrip kosong.
    """
    if not settings.STT_LLM_ENABLED:
        return None, 0, 0
    if not transcript or not transcript.strip():
        return None, 0, 0

    if settings.LLM_PROVIDER == 'groq':
        if settings.GROQ_API_KEY:
            return _summarize_groq(transcript)
        logger.warning('LLM_PROVIDER=groq tapi GROQ_API_KEY kosong — mencoba Anthropic')

    if not settings.ANTHROPIC_API_KEY:
        return None, 0, 0
    return _summarize_anthropic(transcript)


def flag_ungrounded(summary, transcript):
    """Tandai `grounded: False` pada item yang kata kuncinya tak muncul di transkrip.

    Cek deterministik & murah (bukan panggilan LLM lagi) sebagai guardrail anti-
    halusinasi (AI-SPEC.md): item dianggap "grounded" bila minimal satu kata
    (>=4 huruf/angka) dari topic/detail (atau area/action) muncul verbatim di
    transkrip. Tidak pernah memblokir penyimpanan — sekadar flag untuk UI review
    dosen menampilkan chip "Perlu Verifikasi".
    """
    transcript_lower = transcript.lower()

    def _is_grounded(*texts):
        words = set()
        for text in texts:
            words.update(re.findall(r'[a-zA-Z0-9]{4,}', text.lower()))
        if not words:
            return True
        return any(word in transcript_lower for word in words)

    for item in summary.get('advice_points', []):
        item['grounded'] = _is_grounded(item.get('topic', ''), item.get('detail', ''))
    for item in summary.get('improvement_notes', []):
        item['grounded'] = _is_grounded(item.get('area', ''), item.get('action', ''))
    return summary


def estimate_cost_idr(input_tokens, output_tokens):
    """Estimasi biaya (IDR) dari jumlah token (D-11)."""
    usd = (
        (input_tokens / 1_000_000) * settings.LLM_INPUT_RATE_USD_PER_MTOK
        + (output_tokens / 1_000_000) * settings.LLM_OUTPUT_RATE_USD_PER_MTOK
    )
    return round(usd * settings.USD_TO_IDR_RATE, 2)
