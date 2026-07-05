"""
Phase 6 / Wave 2 (06-03): stt.py + summarizer.py service wrapper tests.

Tests never load faster-whisper's real model or call the real Anthropic API —
both external clients are mocked/patched throughout.
"""
from decimal import Decimal

import pytest

from apps.logbook.services import stt as stt_service
from apps.logbook.services import summarizer as summarizer_service
from apps.logbook.schemas import SessionSummary


class _FakeSegment:
    def __init__(self, text):
        self.text = text


class _FakeInfo:
    def __init__(self, duration):
        self.duration = duration


class _FakeWhisperModel:
    """Stand-in for faster_whisper.WhisperModel — records how many times it
    was constructed so tests can assert single-load-per-process discipline."""
    instances_created = 0

    def __init__(self, *args, **kwargs):
        _FakeWhisperModel.instances_created += 1
        self.init_args = args
        self.init_kwargs = kwargs

    def transcribe(self, file_path, language=None):
        segments = [_FakeSegment('Halo,'), _FakeSegment('ini transkrip tes.')]
        return segments, _FakeInfo(duration=12.5)


@pytest.fixture(autouse=True)
def _reset_stt_module_state(monkeypatch):
    """Ensure each test starts with a clean module-global _model and a fresh
    fake-model instance counter, regardless of test execution order."""
    monkeypatch.setattr(stt_service, '_model', None)
    _FakeWhisperModel.instances_created = 0
    yield
    monkeypatch.setattr(stt_service, '_model', None)


class TestSttService:
    """06-03-T1 — faster-whisper wrapper: worker_process_init loader, get_model, transcribe_audio."""

    def test_transcribe_audio_returns_text_and_duration_tuple(self, monkeypatch):
        import faster_whisper
        monkeypatch.setattr(faster_whisper, 'WhisperModel', _FakeWhisperModel, raising=False)

        transcript, duration = stt_service.transcribe_audio('/tmp/fake.webm')

        assert transcript == 'Halo, ini transkrip tes.'
        assert isinstance(duration, float)
        assert duration == 12.5

    def test_load_whisper_model_sets_module_global_once(self, monkeypatch):
        import faster_whisper
        monkeypatch.setattr(faster_whisper, 'WhisperModel', _FakeWhisperModel, raising=False)

        assert stt_service._model is None
        stt_service.load_whisper_model()
        assert stt_service._model is not None
        assert _FakeWhisperModel.instances_created == 1

    def test_get_model_lazily_loads_when_model_is_none(self, monkeypatch):
        import faster_whisper
        monkeypatch.setattr(faster_whisper, 'WhisperModel', _FakeWhisperModel, raising=False)

        assert stt_service._model is None
        model = stt_service.get_model()
        assert model is not None
        assert _FakeWhisperModel.instances_created == 1

    def test_model_not_reinstantiated_across_multiple_calls(self, monkeypatch):
        import faster_whisper
        monkeypatch.setattr(faster_whisper, 'WhisperModel', _FakeWhisperModel, raising=False)

        stt_service.transcribe_audio('/tmp/one.webm')
        stt_service.transcribe_audio('/tmp/two.webm')

        assert _FakeWhisperModel.instances_created == 1


class _FakeToolUseBlock:
    type = 'tool_use'

    def __init__(self, input_data):
        self.input = input_data


class _FakeMessage:
    def __init__(self, content):
        self.content = content


class _FakeBatchResult:
    def __init__(self, result_type, content=None):
        self.type = result_type
        self.message = _FakeMessage(content or [])


class _FakeResultWrapper:
    def __init__(self, result):
        self.result = result


class TestSummarizerService:
    """06-03-T2 — Anthropic Batch summarizer wrapper + cost formula."""

    def test_tool_schema_input_schema_matches_session_summary(self):
        assert summarizer_service.TOOL_SCHEMA['input_schema'] == SessionSummary.model_json_schema()
        assert summarizer_service.TOOL_SCHEMA['strict'] is True

    def test_build_batch_request_fields(self, settings):
        request = summarizer_service.build_batch_request(42, 'transkrip contoh')

        assert request['custom_id'] == 'logbook-42'
        params = request['params']
        assert params['model'] == settings.LLM_MODEL
        assert params['temperature'] == 0
        assert params['max_tokens'] == 1024
        assert params['tool_choice'] == {'type': 'tool', 'name': 'catat_ringkasan_sesi'}
        assert params['system'][0]['cache_control'] == {'type': 'ephemeral'}
        assert params['messages'][0]['content'] == 'transkrip contoh'

    def test_submit_batch_returns_id_from_mocked_client(self, monkeypatch):
        class _FakeBatch:
            id = 'batch_abc123'

        class _FakeBatches:
            def create(self, requests):
                return _FakeBatch()

        class _FakeMessages:
            batches = _FakeBatches()

        class _FakeAnthropicClient:
            def __init__(self, api_key):
                self.messages = _FakeMessages()

        monkeypatch.setattr(summarizer_service.anthropic, 'Anthropic', _FakeAnthropicClient)

        batch_id = summarizer_service.submit_batch(1, 'transkrip')
        assert batch_id == 'batch_abc123'

    def test_llm_enabled_false_when_flag_off(self, settings):
        settings.STT_LLM_ENABLED = False
        settings.ANTHROPIC_API_KEY = 'sk-test-key'
        assert summarizer_service._llm_enabled() is False

    def test_llm_enabled_false_when_key_absent(self, settings):
        settings.STT_LLM_ENABLED = True
        settings.ANTHROPIC_API_KEY = ''
        assert summarizer_service._llm_enabled() is False

    def test_llm_enabled_true_when_flag_on_and_key_present(self, settings):
        settings.STT_LLM_ENABLED = True
        settings.ANTHROPIC_API_KEY = 'sk-test-key'
        assert summarizer_service._llm_enabled() is True

    def test_parse_result_success_returns_session_summary(self):
        tool_input = {
            'advice_points': [{'topic': 'Topik', 'detail': 'Detail saran'}],
            'improvement_notes': [],
        }
        result = _FakeResultWrapper(_FakeBatchResult('succeeded', [_FakeToolUseBlock(tool_input)]))

        summary = summarizer_service.parse_result(result)

        assert isinstance(summary, SessionSummary)
        assert summary.advice_points[0].topic == 'Topik'

    def test_parse_result_failure_returns_none(self):
        result = _FakeResultWrapper(_FakeBatchResult('errored'))
        assert summarizer_service.parse_result(result) is None

    def test_compute_cost_idr_uses_settings_rates_not_hardcoded(self, settings):
        settings.LLM_INPUT_RATE_USD_PER_MTOK = 0.50
        settings.LLM_OUTPUT_RATE_USD_PER_MTOK = 2.50
        settings.USD_TO_IDR = 16500

        cost = summarizer_service.compute_cost_idr(1_000_000, 1_000_000)

        expected = (Decimal('0.50') + Decimal('2.50')) * Decimal('16500')
        assert cost == expected
        assert isinstance(cost, Decimal)

    def test_compute_cost_idr_changes_with_different_settings_rates(self, settings):
        settings.LLM_INPUT_RATE_USD_PER_MTOK = 1.0
        settings.LLM_OUTPUT_RATE_USD_PER_MTOK = 5.0
        settings.USD_TO_IDR = 16500

        cost = summarizer_service.compute_cost_idr(1_000_000, 1_000_000)

        expected = (Decimal('1.0') + Decimal('5.0')) * Decimal('16500')
        assert cost == expected
