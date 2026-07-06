"""
Phase 7 SC3/SC5 (LOGBOOK-01/03): campus logbook sync via the decoupled adapter.

Covers build_payload mapping, graceful degradation (disabled / not configured),
success + failure/retry outcomes, and the approve endpoint triggering a sync
without ever letting a campus-API failure block approval.
"""
import pytest
from django.test import override_settings
from rest_framework.test import APIClient

from apps.bimbingan.models import Session, SystemLog
from apps.logbook.models import SessionLogbook
from apps.logbook.services import campus_logbook as cl


def client_for(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _logbook(submission, summary=None, status=None):
    session = Session.objects.create(
        submission=submission,
        status=Session.Status.DONE,
        estimated_minutes=45,
    )
    return SessionLogbook.objects.create(
        session=session,
        status=status or SessionLogbook.Status.APPROVED,
        summary_edited=summary if summary is not None else {
            'advice_points': [{'topic': 'Metodologi', 'detail': 'Perbaiki bab 3'}],
            'improvement_notes': [{'area': 'Penulisan', 'action': 'Rapikan sitasi'}],
        },
    )


CONFIGURED = dict(
    CAMPUS_LOGBOOK_ENABLED=True,
    CAMPUS_LOGBOOK_BASE_URL='https://campus.example/api',
    CAMPUS_LOGBOOK_TOKEN='secret-token',
    CAMPUS_LOGBOOK_PROVIDER='sekawan',
)


@pytest.mark.django_db
class TestBuildPayload:
    def test_maps_structured_summary_to_campus_schema(self, advisee_student, pending_submission):
        lb = _logbook(pending_submission)
        payload = cl.build_payload(lb)

        assert payload['nim'] == advisee_student.nim
        assert payload['nidn'] == advisee_student.adviser.nidn
        assert payload['topik'] == 'Metodologi'
        assert payload['durasi_menit'] == 45
        # advice detail + improvement action both land in saran[]
        assert 'Perbaiki bab 3' in payload['saran']
        assert 'Rapikan sitasi' in payload['saran']

    def test_handles_manual_notes_shape(self, pending_submission):
        lb = _logbook(pending_submission, summary={'manual_notes': 'Sudah bagus, lanjut bab 4.'})
        payload = cl.build_payload(lb)
        assert payload['ringkasan'] == 'Sudah bagus, lanjut bab 4.'
        assert payload['saran'] == []


@pytest.mark.django_db
class TestSyncLogbook:
    def test_noop_when_disabled(self, pending_submission):
        lb = _logbook(pending_submission)
        assert cl.sync_logbook(lb) == 'disabled'
        lb.refresh_from_db()
        assert lb.campus_sync_status == SessionLogbook.CampusSyncStatus.NOT_SYNCED
        assert SystemLog.objects.filter(event_type='CAMPUS_LOGBOOK_ERROR').count() == 0

    @override_settings(CAMPUS_LOGBOOK_ENABLED=True, CAMPUS_LOGBOOK_BASE_URL='', CAMPUS_LOGBOOK_TOKEN='')
    def test_not_configured_logs_and_stays_unsynced(self, pending_submission):
        lb = _logbook(pending_submission)
        assert cl.sync_logbook(lb) == 'not_configured'
        lb.refresh_from_db()
        assert lb.campus_sync_status == SessionLogbook.CampusSyncStatus.NOT_SYNCED
        assert SystemLog.objects.filter(event_type='CAMPUS_LOGBOOK_ERROR').count() == 1

    @override_settings(**CONFIGURED)
    def test_success_stores_entry_id(self, pending_submission, monkeypatch):
        monkeypatch.setattr(cl._HttpLogbookAdapter, 'sync', lambda self, payload: 'CAMPUS-123')
        lb = _logbook(pending_submission)

        assert cl.sync_logbook(lb) == 'synced'
        lb.refresh_from_db()
        assert lb.campus_sync_status == SessionLogbook.CampusSyncStatus.SYNCED
        assert lb.campus_entry_id == 'CAMPUS-123'
        assert lb.campus_synced_at is not None

    @override_settings(**CONFIGURED, CAMPUS_LOGBOOK_MAX_RETRIES=3)
    def test_failure_marks_pending_retry_and_logs(self, pending_submission, monkeypatch):
        def boom(self, payload):
            raise RuntimeError('kampus timeout')
        monkeypatch.setattr(cl._HttpLogbookAdapter, 'sync', boom)
        lb = _logbook(pending_submission)

        assert cl.sync_logbook(lb) == 'pending_retry'
        lb.refresh_from_db()
        assert lb.campus_sync_status == SessionLogbook.CampusSyncStatus.PENDING_RETRY
        assert lb.campus_sync_attempts == 1
        assert SystemLog.objects.filter(event_type='CAMPUS_LOGBOOK_ERROR').count() == 1

    @override_settings(**CONFIGURED, CAMPUS_LOGBOOK_MAX_RETRIES=2)
    def test_exhausting_retries_marks_failed(self, pending_submission, monkeypatch):
        monkeypatch.setattr(cl._HttpLogbookAdapter, 'sync',
                            lambda self, payload: (_ for _ in ()).throw(RuntimeError('x')))
        lb = _logbook(pending_submission)
        lb.campus_sync_attempts = 1  # one prior attempt already made
        lb.save(update_fields=['campus_sync_attempts'])

        assert cl.sync_logbook(lb) == 'failed'
        lb.refresh_from_db()
        assert lb.campus_sync_status == SessionLogbook.CampusSyncStatus.FAILED


@pytest.mark.django_db
class TestApproveTriggersSync:
    """The approve endpoint must fire the sync, but a campus failure must never
    turn a successful approval into an error (graceful degradation)."""

    def _ready(self, lecturer, submission):
        from apps.bimbingan.models import Session as S
        session = S.objects.create(submission=submission, status=S.Status.DONE, estimated_minutes=45)
        SessionLogbook.objects.create(
            session=session,
            status=SessionLogbook.Status.READY_FOR_REVIEW,
            summary_raw={'advice_points': [{'topic': 'Metodologi', 'detail': 'Perbaiki bab 3'}],
                         'improvement_notes': []},
        )
        return session

    def _payload(self):
        return {'summary_edited': {
            'advice_points': [{'topic': 'Metodologi', 'detail': 'Perbaiki bab 3'}],
            'improvement_notes': [],
        }}

    @override_settings(**CONFIGURED)
    def test_approve_syncs_on_success(self, lecturer_user, pending_submission, monkeypatch):
        monkeypatch.setattr(cl._HttpLogbookAdapter, 'sync', lambda self, payload: 'CAMPUS-9')
        session = self._ready(lecturer_user, pending_submission)

        resp = client_for(lecturer_user).post(
            f'/api/logbook/{session.id}/approve/', self._payload(), format='json')
        assert resp.status_code == 200

        lb = SessionLogbook.objects.get(session=session)
        assert lb.campus_sync_status == SessionLogbook.CampusSyncStatus.SYNCED
        assert lb.campus_entry_id == 'CAMPUS-9'

    @override_settings(**CONFIGURED)
    def test_approve_still_succeeds_when_sync_fails(self, lecturer_user, pending_submission, monkeypatch):
        def boom(self, payload):
            raise RuntimeError('kampus down')
        monkeypatch.setattr(cl._HttpLogbookAdapter, 'sync', boom)
        session = self._ready(lecturer_user, pending_submission)

        resp = client_for(lecturer_user).post(
            f'/api/logbook/{session.id}/approve/', self._payload(), format='json')
        assert resp.status_code == 200  # approval NOT blocked by campus failure

        lb = SessionLogbook.objects.get(session=session)
        assert lb.status == SessionLogbook.Status.APPROVED
        assert lb.campus_sync_status == SessionLogbook.CampusSyncStatus.PENDING_RETRY


@pytest.mark.django_db
class TestLogbookExportView:
    """SC4 (LOGBOOK-02): CSV/PDF export of the approved summary for manual upload
    when campus sync is unavailable. Owning lecturer only."""

    def _url(self, session_id, fmt=None):
        base = f'/api/logbook/{session_id}/export/'
        return f'{base}?format={fmt}' if fmt else base

    def test_csv_export_contains_summary_content(self, lecturer_user, advisee_student, pending_submission):
        lb = _logbook(pending_submission)
        resp = client_for(lecturer_user).get(self._url(lb.session_id, 'csv'))
        assert resp.status_code == 200
        assert resp['Content-Type'].startswith('text/csv')
        body = resp.content.decode('utf-8')
        assert advisee_student.nim in body
        assert 'Perbaiki bab 3' in body  # advice detail lands in saran

    def test_pdf_export_returns_pdf_bytes(self, lecturer_user, pending_submission):
        lb = _logbook(pending_submission)
        resp = client_for(lecturer_user).get(self._url(lb.session_id, 'pdf'))
        assert resp.status_code == 200
        assert resp['Content-Type'] == 'application/pdf'
        assert resp.content[:5] == b'%PDF-'

    def test_defaults_to_csv(self, lecturer_user, pending_submission):
        lb = _logbook(pending_submission)
        resp = client_for(lecturer_user).get(self._url(lb.session_id))
        assert resp.status_code == 200
        assert resp['Content-Type'].startswith('text/csv')

    def test_other_lecturer_forbidden(self, approved_lecturer, pending_submission):
        lb = _logbook(pending_submission)
        resp = client_for(approved_lecturer).get(self._url(lb.session_id, 'csv'))
        assert resp.status_code == 403

    def test_unapproved_logbook_rejected(self, lecturer_user, pending_submission):
        lb = _logbook(pending_submission, status=SessionLogbook.Status.READY_FOR_REVIEW)
        resp = client_for(lecturer_user).get(self._url(lb.session_id, 'csv'))
        assert resp.status_code == 400

    def test_missing_session_404(self, lecturer_user):
        resp = client_for(lecturer_user).get(self._url(999999, 'csv'))
        assert resp.status_code == 404
