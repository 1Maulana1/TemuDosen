"""
Phase 6 (AI-SPEC.md Section 4b.1): SessionSummary Pydantic schema.

Models ONLY the extracted advice/improvement content returned by the LLM
summarization call. Deliberately carries NO usage-count/cost/API metadata —
those fields live on the `SessionLogbook` Django model (D-11 storage note),
never here.

`SessionSummary.model_json_schema()` backs the Anthropic tool `input_schema`
(with `strict: true`) used by `apps/logbook/services/summarizer.py`.
"""
from typing import List

from pydantic import BaseModel, Field, field_validator

# Banned filler/placeholder strings a lecturer-summarization LLM might emit
# instead of an honest empty list (D5 / AI-SPEC.md Section 4b). Matched against
# a stripped, lowercased comparison of the item's `detail`/`action` text.
BANNED_PLACEHOLDER_TEXT = {"tidak ada", "-", "n/a", "tidak ada saran"}


class AdvicePoint(BaseModel):
    topic: str = Field(
        ..., description="Ringkasan singkat topik saran, mis. 'Metodologi Penelitian'"
    )
    detail: str = Field(
        ..., description="Isi saran dosen secara lengkap, dalam Bahasa Indonesia"
    )


class ImprovementNote(BaseModel):
    area: str = Field(..., description="Area yang perlu diperbaiki mahasiswa")
    action: str = Field(
        ..., description="Tindakan konkret yang harus dilakukan mahasiswa"
    )


class SessionSummary(BaseModel):
    advice_points: List[AdvicePoint] = Field(
        default_factory=list,
        description="Daftar saran/masukan dari dosen selama sesi bimbingan",
    )
    improvement_notes: List[ImprovementNote] = Field(
        default_factory=list,
        description="Daftar catatan area perbaikan untuk mahasiswa",
    )

    @field_validator("advice_points", "improvement_notes")
    @classmethod
    def no_placeholder_text(cls, v):
        # Guards against a known LLM failure mode: filler entries like
        # "Tidak ada saran" instead of a genuinely empty list — a business
        # rule JSON Schema alone can't express (AI-SPEC.md Section 4b).
        for item in v:
            text = getattr(item, "detail", None) or getattr(item, "action", None) or ""
            if text.strip().lower() in BANNED_PLACEHOLDER_TEXT:
                raise ValueError(
                    f"placeholder text detected: {text!r} — omit the item instead"
                )
        return v
