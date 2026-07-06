"""
Campus logbook integration — Phase 7 (LOGBOOK-01/02/03, SC3-5).

Decoupled adapter pattern (see .planning/deferred/TECH-SPEC.md §2):

    sync_logbook(logbook)
        │
        ▼
    LogbookAdapter (abstract)
        ├── SekawanAdapter   POST {base}/api/v1/logbook/entries  (Bearer)
        ├── KPTIAdapter      idem, different campus backend
        └── (no adapter)  →  CSV/PDF export fallback (handled by the export view)

Design principles (mirrors services/calendar.py):
- Degrades gracefully: a campus-API failure is logged to SystemLog and marks the
  logbook for retry, but NEVER propagates an exception that would block approve.
- If CAMPUS_LOGBOOK_ENABLED is false or credentials are missing, sync is a no-op;
  the logbook stays NOT_SYNCED and the lecturer is offered the CSV/PDF export.
"""
import logging
from typing import Optional

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

ENDPOINT_PATH = '/api/v1/logbook/entries'


# ── Config helpers ─────────────────────────────────────────────────────────────

def _enabled() -> bool:
    return getattr(settings, 'CAMPUS_LOGBOOK_ENABLED', False)


def _configured() -> bool:
    return bool(
        getattr(settings, 'CAMPUS_LOGBOOK_BASE_URL', '')
        and getattr(settings, 'CAMPUS_LOGBOOK_TOKEN', '')
    )


def _log_error(message: str, context: dict):
    from apps.bimbingan.models import SystemLog
    try:
        SystemLog.objects.create(
            level=SystemLog.Level.ERROR,
            event_type='CAMPUS_LOGBOOK_ERROR',
            message=message,
            context=context,
        )
    except Exception:
        pass
    logger.error('[CampusLogbook] %s', message)


# ── Payload construction ───────────────────────────────────────────────────────

def _summary_to_fields(summary: dict):
    """Derive (topik, ringkasan, saran[]) from a stored summary_edited JSON.

    Handles both the structured AI shape ({advice_points, improvement_notes}) and
    the manual-notes fallback shape ({manual_notes: str}).
    """
    summary = summary or {}

    if 'manual_notes' in summary:
        text = (summary.get('manual_notes') or '').strip()
        return 'Bimbingan', text, []

    advice = summary.get('advice_points') or []
    improvements = summary.get('improvement_notes') or []

    saran = []
    ringkasan_lines = []
    for a in advice:
        topic = (a.get('topic') or '').strip()
        detail = (a.get('detail') or '').strip()
        if detail:
            saran.append(detail)
            ringkasan_lines.append(f'{topic}: {detail}' if topic else detail)
    for i in improvements:
        action = (i.get('action') or '').strip()
        area = (i.get('area') or '').strip()
        if action:
            saran.append(action)
            ringkasan_lines.append(f'{area}: {action}' if area else action)

    topik = (advice[0].get('topic') or '').strip() if advice else ''
    topik = topik or 'Bimbingan'
    ringkasan = ' '.join(ringkasan_lines)
    return topik, ringkasan, saran


def build_payload(logbook) -> dict:
    """Map an approved SessionLogbook to the campus API request schema (TECH-SPEC §2.2)."""
    session = logbook.session
    submission = session.submission
    student = submission.student
    adviser = getattr(student, 'adviser', None)

    topik, ringkasan, saran = _summary_to_fields(logbook.summary_edited)

    tanggal = getattr(session, 'ts2', None) or getattr(session, 'scheduled_at', None)
    durasi = getattr(session, 'estimated_minutes', None) or 0

    return {
        'nim': student.nim or '',
        'nidn': (adviser.nidn if adviser else '') or '',
        'tanggal': tanggal.isoformat() if tanggal else None,
        'topik': topik,
        'ringkasan': ringkasan,
        'saran': saran,
        'durasi_menit': durasi,
    }


# ── Adapters ───────────────────────────────────────────────────────────────────

class LogbookAdapter:
    """Abstract campus-logbook adapter. `sync` returns the campus entry id or raises."""
    provider_name = 'base'

    def sync(self, payload: dict) -> str:  # pragma: no cover - abstract
        raise NotImplementedError


class _HttpLogbookAdapter(LogbookAdapter):
    """Shared HTTP POST against a campus logbook backend that speaks TECH-SPEC §2.2."""

    def sync(self, payload: dict) -> str:
        import requests  # lazy: only needed when a real sync actually fires

        base = getattr(settings, 'CAMPUS_LOGBOOK_BASE_URL', '').rstrip('/')
        token = getattr(settings, 'CAMPUS_LOGBOOK_TOKEN', '')
        timeout = getattr(settings, 'CAMPUS_LOGBOOK_TIMEOUT', 5)

        resp = requests.post(
            f'{base}{ENDPOINT_PATH}',
            json=payload,
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
            timeout=timeout,
        )
        resp.raise_for_status()
        data = resp.json()
        entry_id = str(data.get('id') or data.get('entry_id') or '')
        if not entry_id:
            raise ValueError('Respons API kampus tidak memuat id entry.')
        return entry_id


class SekawanAdapter(_HttpLogbookAdapter):
    provider_name = 'sekawan'


class KPTIAdapter(_HttpLogbookAdapter):
    provider_name = 'kpti'


_ADAPTERS = {'sekawan': SekawanAdapter, 'kpti': KPTIAdapter}


def get_adapter() -> Optional[LogbookAdapter]:
    """Return the configured adapter, or None if the provider is unknown."""
    provider = getattr(settings, 'CAMPUS_LOGBOOK_PROVIDER', 'sekawan')
    cls = _ADAPTERS.get(provider)
    return cls() if cls else None


# ── Public entry point ─────────────────────────────────────────────────────────

def sync_logbook(logbook) -> str:
    """Attempt to sync an approved logbook to the campus system. Never raises.

    Returns a short status string: 'disabled', 'not_configured', 'synced',
    'pending_retry', or 'failed'. Persists the outcome on the logbook.
    """
    if not _enabled():
        return 'disabled'
    if not _configured():
        _log_error('Sync dilewati: CAMPUS_LOGBOOK belum dikonfigurasi (base_url/token kosong).',
                   {'logbook_id': logbook.id})
        return 'not_configured'

    adapter = get_adapter()
    if adapter is None:
        _log_error(
            f'Provider tidak dikenal: {getattr(settings, "CAMPUS_LOGBOOK_PROVIDER", None)!r}',
            {'logbook_id': logbook.id},
        )
        return 'not_configured'

    Status = logbook.CampusSyncStatus
    logbook.campus_sync_attempts = (logbook.campus_sync_attempts or 0) + 1

    try:
        entry_id = adapter.sync(build_payload(logbook))
    except Exception as e:
        max_retries = getattr(settings, 'CAMPUS_LOGBOOK_MAX_RETRIES', 3)
        exhausted = logbook.campus_sync_attempts >= max_retries
        logbook.campus_sync_status = Status.FAILED if exhausted else Status.PENDING_RETRY
        logbook.save(update_fields=['campus_sync_status', 'campus_sync_attempts', 'updated_at'])
        _log_error(
            f'Sync ke logbook kampus gagal ({adapter.provider_name}): {e}',
            {'logbook_id': logbook.id, 'attempts': logbook.campus_sync_attempts,
             'status': logbook.campus_sync_status},
        )
        return logbook.campus_sync_status

    logbook.campus_entry_id = entry_id
    logbook.campus_sync_status = Status.SYNCED
    logbook.campus_synced_at = timezone.now()
    logbook.save(update_fields=[
        'campus_entry_id', 'campus_sync_status', 'campus_synced_at',
        'campus_sync_attempts', 'updated_at'])
    return 'synced'
