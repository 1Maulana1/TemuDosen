"""
Phase 5 (partial) — background scheduler jobs (FR-S03, FR-S05).

check_h15_notifications() and check_auto_cancel() are plain functions run by
APScheduler on an interval (scheduler.py); they are called directly here
rather than through an endpoint, since they have no HTTP surface.
"""
from datetime import timedelta

import pytest
from django.utils import timezone

from apps.bimbingan.models import Session, SessionRecording, SystemLog
from apps.bimbingan.scheduler import (
    check_auto_cancel, check_h15_notifications,
    cleanup_old_recordings, cleanup_old_system_logs,
)
from apps.submissions.models import Submission


def _approve_session(lecturer, submission, **overrides):
    """Directly create a WAITING Session for a submission (bypasses the approve
    endpoint so scheduled_at can be backdated/forwarded for scheduler tests)."""
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
class TestH15Notifications:
    """FR-S03 — students get notified ~15 minutes before their turn."""

    def test_sends_notification_when_session_is_15_minutes_out(
        self, lecturer_user, pending_submission
    ):
        session = _approve_session(
            lecturer_user, pending_submission,
            scheduled_at=timezone.now() + timedelta(minutes=15),
        )

        check_h15_notifications()

        session.refresh_from_db()
        assert session.notification_sent is True
        assert SystemLog.objects.filter(event_type='H15_NOTIFICATION').exists()

    def test_does_not_notify_outside_the_14_to_16_minute_window(
        self, lecturer_user, pending_submission
    ):
        session = _approve_session(
            lecturer_user, pending_submission,
            scheduled_at=timezone.now() + timedelta(minutes=45),
        )

        check_h15_notifications()

        session.refresh_from_db()
        assert session.notification_sent is False

    def test_does_not_double_notify(self, lecturer_user, pending_submission):
        """A session already flagged notification_sent=True is skipped."""
        session = _approve_session(
            lecturer_user, pending_submission,
            scheduled_at=timezone.now() + timedelta(minutes=15),
            notification_sent=True,
        )

        check_h15_notifications()

        assert SystemLog.objects.filter(event_type='H15_NOTIFICATION').count() == 0
        session.refresh_from_db()
        assert session.notification_sent is True


@pytest.mark.django_db
class TestAutoCancel:
    """FR-S05 — a called student who never presses "Mulai & Rekam" is auto-cancelled after 30 min."""

    def test_cancels_session_with_no_show_after_30_minutes(
        self, lecturer_user, pending_submission
    ):
        session = _approve_session(
            lecturer_user, pending_submission,
            scheduled_at=timezone.now() - timedelta(minutes=31),
        )

        check_auto_cancel()

        session.refresh_from_db()
        assert session.status == Session.Status.CANCELLED
        session.submission.refresh_from_db()
        assert session.submission.status == Submission.Status.CANCELLED

    def test_leaves_session_alone_before_30_minute_cutoff(
        self, lecturer_user, pending_submission
    ):
        session = _approve_session(
            lecturer_user, pending_submission,
            scheduled_at=timezone.now() - timedelta(minutes=10),
        )

        check_auto_cancel()

        session.refresh_from_db()
        assert session.status == Session.Status.WAITING

    def test_does_not_cancel_a_session_that_already_started(
        self, lecturer_user, pending_submission
    ):
        """ts1 set means the student showed up — must not be auto-cancelled."""
        session = _approve_session(
            lecturer_user, pending_submission,
            scheduled_at=timezone.now() - timedelta(minutes=45),
            ts1=timezone.now() - timedelta(minutes=44),
            status=Session.Status.IN_PROGRESS,
        )

        check_auto_cancel()

        session.refresh_from_db()
        assert session.status == Session.Status.IN_PROGRESS

    def test_logs_event_type_auto_cancel_not_emergency_cancel(
        self, lecturer_user, pending_submission
    ):
        """Regression guard: the audit-trail SystemLog must be tagged AUTO_CANCEL,
        distinct from the admin-triggered EMERGENCY_CANCEL, so Admin Dashboard logs
        don't misattribute a student no-show as an admin action."""
        _approve_session(
            lecturer_user, pending_submission,
            scheduled_at=timezone.now() - timedelta(minutes=31),
        )

        check_auto_cancel()

        assert SystemLog.objects.filter(event_type='AUTO_CANCEL').exists()
        assert not SystemLog.objects.filter(
            event_type='EMERGENCY_CANCEL', message__icontains='tidak hadir'
        ).exists()


@pytest.mark.django_db
class TestCleanupOldRecordings:
    """Audit G5 — old recording audio is pruned; the file itself is removed."""

    def _rec(self, session, path, days_old):
        rec = SessionRecording.objects.create(
            session=session, original_filename='r.webm', file_path=str(path),
            file_size=10, mime_type='audio/webm')
        SessionRecording.objects.filter(pk=rec.pk).update(
            uploaded_at=timezone.now() - timedelta(days=days_old))
        return rec

    def test_deletes_old_recording_and_file(self, lecturer_user, pending_submission, tmp_path, settings):
        settings.RECORDING_RETENTION_DAYS = 90
        session = _approve_session(lecturer_user, pending_submission)
        f = tmp_path / 'old.webm'; f.write_bytes(b'x')
        rec = self._rec(session, f, days_old=120)

        cleanup_old_recordings()
        assert not SessionRecording.objects.filter(pk=rec.pk).exists()
        assert not f.exists()
        assert SystemLog.objects.filter(event_type='RECORDING_CLEANUP').exists()

    def test_keeps_recent_recording(self, lecturer_user, pending_submission, tmp_path, settings):
        settings.RECORDING_RETENTION_DAYS = 90
        session = _approve_session(lecturer_user, pending_submission)
        f = tmp_path / 'new.webm'; f.write_bytes(b'x')
        rec = self._rec(session, f, days_old=10)

        cleanup_old_recordings()
        assert SessionRecording.objects.filter(pk=rec.pk).exists()
        assert f.exists()


@pytest.mark.django_db
class TestCleanupOldSystemLogs:
    """Audit G7 — SystemLog rows older than the retention window are auto-pruned."""

    def test_prunes_old_keeps_recent(self, settings):
        settings.SYSTEMLOG_RETENTION_DAYS = 30
        old = SystemLog.objects.create(event_type='X', message='old')
        SystemLog.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=40))
        recent = SystemLog.objects.create(event_type='Y', message='recent')

        cleanup_old_system_logs()
        assert not SystemLog.objects.filter(pk=old.pk).exists()
        assert SystemLog.objects.filter(pk=recent.pk).exists()
