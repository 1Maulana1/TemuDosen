"""
Phase 6 (06-03/06-05): pipeline STT->LLM.

Karena faster-whisper/anthropic/celery TIDAK terpasang di environment ini (dan
STT_LLM_ENABLED=False di test), yang diuji adalah jalur graceful-degradation:
service kembali kosong tanpa memuat dependency berat, dan dispatcher tidak
melakukan apa-apa (logbook tetap pending untuk jalur manual). Ini justru perilaku
"aman default" yang paling penting untuk dijamin.
"""
import pytest
from django.test import override_settings

from apps.logbook.services.stt import transcribe_audio
from apps.logbook.services.summarizer import summarize_transcript, estimate_cost_idr
from apps.logbook.tasks import dispatch_pipeline


class TestServicesGracefulDegradation:
    def test_stt_disabled_returns_empty_without_loading_model(self):
        # STT_LLM_ENABLED False (default test) → tak menyentuh faster_whisper.
        assert transcribe_audio('/tmp/does-not-matter.webm') == ('', 0.0)

    def test_summarizer_disabled_returns_none(self):
        assert summarize_transcript('transkrip apa pun') == (None, 0, 0)

    @override_settings(STT_LLM_ENABLED=True, ANTHROPIC_API_KEY='')
    def test_summarizer_no_api_key_returns_none(self):
        # Aktif tapi tanpa API key → tetap degradasi, tidak memanggil anthropic.
        assert summarize_transcript('transkrip') == (None, 0, 0)

    @override_settings(STT_LLM_ENABLED=True, ANTHROPIC_API_KEY='sk-test')
    def test_summarizer_empty_transcript_returns_none(self):
        assert summarize_transcript('   ') == (None, 0, 0)

    def test_cost_estimate_scales_with_tokens(self):
        # 1M input @0.50 + 1M output @2.50 = 3.00 USD * 16000 = 48.000 IDR (default rate)
        assert estimate_cost_idr(1_000_000, 1_000_000) == pytest.approx(48000.0)
        assert estimate_cost_idr(0, 0) == 0.0


@pytest.mark.django_db
class TestDispatchPipeline:
    def _logbook(self, lecturer, submission):
        from apps.submissions.models import Submission  # noqa: F401
        from apps.bimbingan.models import Session
        from apps.logbook.models import SessionLogbook

        # buat session + logbook minimal
        resp_session = Session.objects.create(submission=submission, status=Session.Status.DONE)
        return SessionLogbook.objects.create(session=resp_session)

    def test_dispatch_noop_when_disabled(self, lecturer_user, pending_submission):
        lb = self._logbook(lecturer_user, pending_submission)
        # STT_LLM_ENABLED False → dispatcher tidak jalan, logbook tetap pending.
        assert dispatch_pipeline(lb) is False
        lb.refresh_from_db()
        assert lb.status == lb.Status.PENDING

    @override_settings(STT_LLM_ENABLED=True)
    def test_dispatch_noop_when_celery_absent(self, lecturer_user, pending_submission):
        # Aktif tapi celery tak terpasang (celery_app None) → tetap no-op yang aman.
        lb = self._logbook(lecturer_user, pending_submission)
        assert dispatch_pipeline(lb) is False
        lb.refresh_from_db()
        assert lb.status == lb.Status.PENDING
