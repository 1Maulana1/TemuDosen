"""
Phase 4 — Google Calendar Sync & Graceful Degradation.

Maps to ROADMAP Phase 4 Success Criteria:
  SC1 (QUEUE-05) — On approval, system checks free/busy and creates a calendar event.
  SC2 (QUEUE-05) — On cancel/reschedule, the corresponding calendar event is
                    updated or deleted.
  SC3 (QUEUE-06) — If the Calendar API fails, approval/cancellation still
                    completes locally and the failure is recorded (graceful
                    degradation — never raises into the request/response cycle).
  SC4 (ADMIN-03) — Admin can view a log of Calendar integration errors.

All Google API calls are mocked at the `cal_service` boundary — no real
credentials or network calls are exercised.
"""
from unittest.mock import patch

import pytest
from rest_framework.test import APIClient

from apps.bimbingan.models import DosenCalendarToken, Session, SystemLog


def approve_url(pk):
    return f'/api/submissions/{pk}/approve/'


def cancel_url(pk):
    return f'/api/queue/{pk}/cancel/'


def client_for(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


class _ImmediateThread:
    """Stand-in for threading.Thread that runs the target inline.

    ApproveSubmissionView creates the calendar event in a fire-and-forget
    background thread (NFR-01) using its own DB connection. A real thread
    can't see the test's transactional connection and deadlocks against it
    ("database table is locked"), so tests patch Thread to run synchronously
    instead of spawning a real one.
    """

    def __init__(self, target=None, args=(), kwargs=None, daemon=None):
        self._target = target
        self._args = args
        self._kwargs = kwargs or {}

    def start(self):
        self._target(*self._args, **self._kwargs)

    def join(self, *args, **kwargs):
        pass


@pytest.fixture(autouse=True)
def _run_calendar_thread_synchronously(monkeypatch):
    monkeypatch.setattr('apps.bimbingan.views.threading.Thread', _ImmediateThread)


# ── SC1/SC3 — Approve: create event, graceful degradation ──────────────────────

@pytest.mark.django_db
class TestApproveCalendarSync:
    def test_approve_stores_google_event_id_when_calendar_succeeds(
        self, authenticated_lecturer, pending_submission
    ):
        """SC1 — a successful create_event() persists google_event_id on the
        session row. Creation runs on a fire-and-forget background thread
        (NFR-01), so the approve response itself never carries the id —
        only the DB write (checked by re-querying the session) does."""
        with patch(
            'apps.bimbingan.views.cal_service.check_free_busy',
            return_value={'isFree': True, 'conflicts': []},
        ), patch(
            'apps.bimbingan.views.cal_service.create_event',
            return_value='gcal-evt-123',
        ) as mock_create:
            resp = authenticated_lecturer.post(
                approve_url(pending_submission.id), {'method': 'offline'}, format='json'
            )

        assert resp.status_code == 200
        assert resp.data['session']['google_event_id'] is None
        mock_create.assert_called_once()

        session = Session.objects.get(submission=pending_submission)
        assert session.google_event_id == 'gcal-evt-123'

    def test_approve_succeeds_when_calendar_create_fails(
        self, authenticated_lecturer, pending_submission
    ):
        """SC3/QUEUE-06 — create_event() returning None (disabled/failed) must not
        block the approval; session is still created without a google_event_id."""
        with patch(
            'apps.bimbingan.views.cal_service.check_free_busy',
            return_value={'isFree': True, 'conflicts': []},
        ), patch(
            'apps.bimbingan.views.cal_service.create_event',
            return_value=None,
        ):
            resp = authenticated_lecturer.post(
                approve_url(pending_submission.id), {'method': 'offline'}, format='json'
            )

        assert resp.status_code == 200
        assert resp.data['session']['google_event_id'] is None

        session = Session.objects.get(submission=pending_submission)
        assert session.status == Session.Status.WAITING
        assert session.google_event_id in (None, '')

    def test_approve_logs_error_when_calendar_service_raises(
        self, authenticated_lecturer, pending_submission
    ):
        """SC3/QUEUE-06 — even if the calendar service raises unexpectedly, the
        approve endpoint itself must not 500. _create_calendar_event_async
        (the background-thread entrypoint) catches the exception and records
        a CALENDAR_ERROR SystemLog instead of letting it escape."""
        with patch(
            'apps.bimbingan.views.cal_service.check_free_busy',
            return_value={'isFree': True, 'conflicts': []},
        ), patch(
            'apps.bimbingan.views.cal_service.create_event',
            side_effect=Exception('Google API unreachable'),
        ):
            resp = authenticated_lecturer.post(
                approve_url(pending_submission.id), {'method': 'offline'}, format='json'
            )

        assert resp.status_code == 200
        assert resp.data['session']['google_event_id'] is None
        assert SystemLog.objects.filter(event_type='CALENDAR_ERROR').exists()

    def test_approve_logs_conflict_but_does_not_block(
        self, authenticated_lecturer, pending_submission
    ):
        """QUEUE-06 — a busy calendar slot is logged as WARNING/CALENDAR_CONFLICT
        but approval proceeds anyway."""
        with patch(
            'apps.bimbingan.views.cal_service.check_free_busy',
            return_value={'isFree': False, 'conflicts': [{'start': 'x', 'end': 'y'}]},
        ), patch(
            'apps.bimbingan.views.cal_service.create_event',
            return_value=None,
        ):
            resp = authenticated_lecturer.post(
                approve_url(pending_submission.id), {'method': 'offline'}, format='json'
            )

        assert resp.status_code == 200
        assert SystemLog.objects.filter(
            event_type='CALENDAR_CONFLICT', level=SystemLog.Level.WARNING
        ).exists()


# ── SC2 — Cancel: delete event ──────────────────────────────────────────────────

@pytest.mark.django_db
class TestCancelCalendarSync:
    def test_cancel_deletes_calendar_event_when_present(
        self, authenticated_lecturer, advisee_student, pending_submission
    ):
        """SC2 — cancelling a session with a stored google_event_id calls delete_event."""
        with patch(
            'apps.bimbingan.views.cal_service.check_free_busy',
            return_value={'isFree': True, 'conflicts': []},
        ), patch(
            'apps.bimbingan.views.cal_service.create_event',
            return_value='gcal-evt-456',
        ):
            r = authenticated_lecturer.post(
                approve_url(pending_submission.id), {'method': 'offline'}, format='json'
            )
        session_id = r.data['session']['id']

        with patch('apps.bimbingan.views.cal_service.delete_event', return_value=True) as mock_delete:
            resp = client_for(advisee_student).post(cancel_url(session_id))

        assert resp.status_code == 200
        mock_delete.assert_called_once()
        called_args = mock_delete.call_args[0]
        assert called_args[1] == 'gcal-evt-456'

    def test_cancel_skips_calendar_call_when_no_event_id(
        self, authenticated_lecturer, advisee_student, pending_submission
    ):
        """When google_event_id was never set (e.g. calendar disabled), cancel
        must not attempt a delete call at all."""
        with patch(
            'apps.bimbingan.views.cal_service.check_free_busy',
            return_value={'isFree': True, 'conflicts': []},
        ), patch(
            'apps.bimbingan.views.cal_service.create_event',
            return_value=None,
        ):
            r = authenticated_lecturer.post(
                approve_url(pending_submission.id), {'method': 'offline'}, format='json'
            )
        session_id = r.data['session']['id']

        with patch('apps.bimbingan.views.cal_service.delete_event') as mock_delete:
            resp = client_for(advisee_student).post(cancel_url(session_id))

        assert resp.status_code == 200
        mock_delete.assert_not_called()


# ── SC2 — Reschedule (queue compaction): update event ───────────────────────────

@pytest.mark.django_db
class TestRescheduleCalendarSync:
    def test_recalculate_queue_updates_calendar_when_schedule_shifts(
        self,
        authenticated_lecturer,
        advisee_student,
        pending_submission,
        second_advisee_student,
        submission_for,
        symptom_category,
        lecturer_user,
    ):
        """SC2 — cancelling the first of two queued sessions compacts the queue;
        the second session's scheduled_at changes, so its calendar event must be
        updated via update_event()."""
        with patch(
            'apps.bimbingan.views.cal_service.check_free_busy',
            return_value={'isFree': True, 'conflicts': []},
        ), patch(
            'apps.bimbingan.views.cal_service.create_event',
            side_effect=['gcal-first', 'gcal-second'],
        ):
            r1 = authenticated_lecturer.post(
                approve_url(pending_submission.id), {'method': 'offline'}, format='json'
            )
            sub2 = submission_for(second_advisee_student, [symptom_category])
            r2 = authenticated_lecturer.post(
                approve_url(sub2.id), {'method': 'offline'}, format='json'
            )

        assert r1.status_code == 200 and r2.status_code == 200
        first_session_id = r1.data['session']['id']
        second_session_id = r2.data['session']['id']
        old_second_schedule = Session.objects.get(pk=second_session_id).scheduled_at

        with patch('apps.bimbingan.views.cal_service.delete_event', return_value=True), patch(
            'apps.bimbingan.services.calendar.update_event', return_value=True
        ) as mock_update:
            resp = client_for(advisee_student).post(cancel_url(first_session_id))

        assert resp.status_code == 200

        second_session = Session.objects.get(pk=second_session_id)
        assert second_session.scheduled_at != old_second_schedule
        mock_update.assert_called_once()
        call_args = mock_update.call_args[0]
        assert call_args[0] == lecturer_user
        assert call_args[1] == 'gcal-second'


# ── SC4/ADMIN-03 — Admin can view Calendar error logs ───────────────────────────

@pytest.mark.django_db
class TestAdminCalendarErrorLog:
    def test_admin_sees_calendar_error_in_recent_errors(self, authenticated_admin):
        SystemLog.objects.create(
            level=SystemLog.Level.ERROR,
            event_type='CALENDAR_ERROR',
            message='createEvent gagal untuk lecturer@test.com: token expired',
            context={'dosen_id': 1},
        )

        resp = authenticated_admin.get('/api/stats/admin/')

        assert resp.status_code == 200
        event_types = [e['event_type'] for e in resp.data['recent_errors']]
        assert 'CALENDAR_ERROR' in event_types

    def test_non_admin_cannot_view_admin_stats(self, authenticated_lecturer):
        resp = authenticated_lecturer.get('/api/stats/admin/')
        assert resp.status_code == 403

    def test_admin_stats_reports_calendar_integration_status(self, authenticated_admin):
        resp = authenticated_admin.get('/api/stats/admin/')
        assert resp.status_code == 200
        assert 'google_calendar' in resp.data['integrations']
        assert 'enabled' in resp.data['integrations']['google_calendar']
        assert 'connected_dosens' in resp.data['integrations']['google_calendar']


# ── Calendar OAuth status endpoint ──────────────────────────────────────────────

@pytest.mark.django_db
class TestCalendarStatusView:
    def test_status_disabled_by_default_in_test_settings(self, authenticated_lecturer):
        resp = authenticated_lecturer.get('/api/calendar/status/')
        assert resp.status_code == 200
        assert resp.data['enabled'] is False
        assert resp.data['connected'] is False

    def test_status_reports_connected_when_token_exists(
        self, authenticated_lecturer, lecturer_user
    ):
        from django.utils import timezone
        from datetime import timedelta

        DosenCalendarToken.objects.create(
            dosen=lecturer_user,
            access_token_enc='dummy-enc-access',
            refresh_token_enc='dummy-enc-refresh',
            expires_at=timezone.now() + timedelta(hours=1),
        )

        resp = authenticated_lecturer.get('/api/calendar/status/')
        assert resp.status_code == 200
        assert resp.data['connected'] is True

    def test_auth_view_returns_503_when_calendar_disabled(self, authenticated_lecturer):
        """SC3/QUEUE-06 — with GOOGLE_CALENDAR_ENABLED=False (test default), the
        OAuth entrypoint must fail closed rather than attempting a live flow."""
        resp = authenticated_lecturer.get('/api/calendar/auth/')
        assert resp.status_code == 503
