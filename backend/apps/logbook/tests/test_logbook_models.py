"""
Phase 6 / Wave 1 (06-02): SessionLogbook model + SessionSummary Pydantic schema.
"""
import pytest
from django.utils import timezone

from apps.bimbingan.models import Session
from apps.logbook.models import SessionLogbook
from apps.logbook.schemas import SessionSummary
from apps.submissions.models import Submission


def _approve_session(submission, **overrides):
    """Directly create a WAITING Session for a submission (mirrors
    apps/bimbingan/tests/test_scheduler.py's _approve_session helper)."""
    submission.status = Submission.Status.APPROVED
    submission.save(update_fields=['status'])
    defaults = dict(
        submission=submission,
        status=Session.Status.WAITING,
        method=Session.Method.OFFLINE,
        estimated_minutes=45,
        scheduled_at=timezone.now(),
    )
    defaults.update(overrides)
    return Session.objects.create(**defaults)


@pytest.mark.django_db
class TestSessionLogbookModel:
    """D-05/D-06/D-11 — durable storage layer for the STT/LLM pipeline."""

    def test_defaults_to_pending_and_reverse_resolves(self, pending_submission):
        session = _approve_session(pending_submission)
        logbook = SessionLogbook.objects.create(session=session)

        assert logbook.status == SessionLogbook.Status.PENDING
        assert session.logbook == logbook

    def test_status_lifecycle_has_exactly_six_states(self):
        assert set(SessionLogbook.Status.values) == {
            'pending', 'transcribing', 'summarizing',
            'ready_for_review', 'approved', 'failed',
        }

    def test_source_mode_accepts_offline_and_online(self, pending_submission):
        session = _approve_session(pending_submission)
        logbook = SessionLogbook.objects.create(
            session=session, source_mode=SessionLogbook.SourceMode.ONLINE,
        )
        assert logbook.source_mode == 'online'

    def test_token_cost_fields_default_null(self, pending_submission):
        session = _approve_session(pending_submission)
        logbook = SessionLogbook.objects.create(session=session)

        assert logbook.llm_input_tokens is None
        assert logbook.llm_output_tokens is None
        assert logbook.llm_cost_estimate_idr is None

    def test_recording_duration_seconds_field_is_nullable(self):
        from apps.bimbingan.models import SessionRecording
        field = SessionRecording._meta.get_field('duration_seconds')
        assert field.null is True


@pytest.mark.django_db
class TestSessionSummarySchema:
    """AI-SPEC.md Section 4b — structured LLM output validation."""

    def test_empty_arrays_are_valid(self):
        summary = SessionSummary.model_validate({
            'advice_points': [], 'improvement_notes': [],
        })
        assert summary.advice_points == []
        assert summary.improvement_notes == []

    def test_well_formed_items_validate(self):
        summary = SessionSummary.model_validate({
            'advice_points': [{'topic': 'Metodologi', 'detail': 'Gunakan metode kualitatif'}],
            'improvement_notes': [{'area': 'Bab 3', 'action': 'Perjelas rumusan masalah'}],
        })
        assert summary.advice_points[0].topic == 'Metodologi'
        assert summary.improvement_notes[0].area == 'Bab 3'

    @pytest.mark.parametrize('placeholder', ['tidak ada', '-', 'n/a', 'Tidak Ada Saran'])
    def test_banned_placeholder_text_raises(self, placeholder):
        with pytest.raises(Exception):
            SessionSummary.model_validate({
                'advice_points': [{'topic': 'Topik', 'detail': placeholder}],
                'improvement_notes': [],
            })

    def test_model_json_schema_exposes_content_fields_only(self):
        schema = SessionSummary.model_json_schema()
        assert 'advice_points' in schema['properties']
        assert 'improvement_notes' in schema['properties']
        assert 'llm_input_tokens' not in schema['properties']
