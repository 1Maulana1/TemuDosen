"""
Phase 6 (06-AI-SPEC.md Section 3/4b): Anthropic Batch API summarizer wrapper.

Non-agentic, single bounded call: one transcript in, one validated
SessionSummary out. submit_batch() SUBMITS a batch of exactly one request
and returns immediately — it does NOT return a completed summary (Wave 3's
poll_summary_batch task handles retrieval).
"""
import logging
from decimal import Decimal

import anthropic
from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
from anthropic.types.messages.batch_create_params import Request
from django.conf import settings

from ..schemas import SessionSummary

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """Anda merangkum transkrip sesi bimbingan akademik berbahasa Indonesia
antara dosen dan mahasiswa. Ekstrak HANYA saran konkret yang benar-benar diucapkan dosen
(advice_points) dan area perbaikan yang disebutkan untuk mahasiswa (improvement_notes).
Jangan menambahkan saran yang tidak ada di transkrip. Jika transkrip tidak memuat saran
apa pun, kembalikan advice_points sebagai array kosong — jangan mengarang isi."""

TOOL_SCHEMA = {
    "name": "catat_ringkasan_sesi",
    "description": (
        "Catat saran dosen (advice_points) dan catatan perbaikan mahasiswa "
        "(improvement_notes) yang diekstrak dari transkrip sesi bimbingan."
    ),
    "input_schema": SessionSummary.model_json_schema(),
    "strict": True,
}


def _llm_enabled() -> bool:
    return bool(getattr(settings, 'STT_LLM_ENABLED', False)) and bool(settings.ANTHROPIC_API_KEY)


def _log_error(message: str, context: dict, event_type: str = 'LLM_FAILED'):
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
    logger.error('[SummarizerService] %s', message)


def build_batch_request(logbook_id: int, transcript: str) -> Request:
    return Request(
        custom_id=f"logbook-{logbook_id}",
        params=MessageCreateParamsNonStreaming(
            model=settings.LLM_MODEL,
            max_tokens=1024,
            temperature=0,
            system=[
                {
                    "type": "text",
                    "text": SYSTEM_PROMPT,
                    "cache_control": {"type": "ephemeral"},
                }
            ],
            tools=[TOOL_SCHEMA],
            tool_choice={"type": "tool", "name": "catat_ringkasan_sesi"},
            messages=[{"role": "user", "content": transcript}],
        ),
    )


def submit_batch(logbook_id: int, transcript: str) -> str:
    """Returns the batch_id immediately — processing is asynchronous."""
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    batch = client.messages.batches.create(requests=[build_batch_request(logbook_id, transcript)])
    return batch.id


def parse_result(result) -> SessionSummary | None:
    """Validates a single Batch result item into a SessionSummary. Returns
    None (rather than raising) on a non-succeeded result — the caller is
    responsible for the failure-path status transition (D-08)."""
    if result.result.type != "succeeded":
        return None
    tool_block = next(b for b in result.result.message.content if b.type == "tool_use")
    return SessionSummary.model_validate(tool_block.input)


def compute_cost_idr(input_tokens: int, output_tokens: int) -> Decimal:
    """D-11 cost formula: actual tokens x configurable per-MTok rate -> IDR."""
    input_cost_usd = (Decimal(input_tokens) / Decimal(1_000_000)) * Decimal(str(settings.LLM_INPUT_RATE_USD_PER_MTOK))
    output_cost_usd = (Decimal(output_tokens) / Decimal(1_000_000)) * Decimal(str(settings.LLM_OUTPUT_RATE_USD_PER_MTOK))
    return (input_cost_usd + output_cost_usd) * Decimal(str(settings.USD_TO_IDR))
