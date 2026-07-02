"""
Background scheduler — Phase 2 (FR-S03, FR-S05).

Jobs:
1. check_h15_notifications()  — every 1 minute
   Sends "giliran segera tiba" notification to students whose session is
   scheduled 14–16 minutes from now and notification has not been sent yet.

2. check_auto_cancel()        — every 5 minutes
   Cancels sessions where scheduledAt has passed > 30 minutes and ts1 is null
   (student never showed up / "Mulai & Rekam" was never pressed).
"""
import logging

logger = logging.getLogger(__name__)

_scheduler = None


def check_h15_notifications():
    """FR-S03: Send H-15 min notifications to students."""
    try:
        from django.utils import timezone
        from datetime import timedelta
        from apps.bimbingan.models import Session, SystemLog
        from apps.bimbingan.services.notification import notify_student

        now = timezone.now()
        window_start = now + timedelta(minutes=14)
        window_end = now + timedelta(minutes=16)

        sessions = Session.objects.filter(
            status=Session.Status.WAITING,
            scheduled_at__gte=window_start,
            scheduled_at__lte=window_end,
            notification_sent=False,
        ).select_related('submission__student', 'submission__student__adviser')

        for session in sessions:
            student = session.submission.student
            dosen = session.submission.student.adviser
            dosen_name = dosen.full_name if dosen else 'Dosen'
            message = (
                f'Giliran Anda segera tiba! Bimbingan dengan {dosen_name} '
                f'dimulai dalam 15 menit.'
            )
            notify_student(student, message, session=session, event_type='H15_NOTIFICATION')
            session.notification_sent = True
            session.save(update_fields=['notification_sent'])

            SystemLog.objects.create(
                level=SystemLog.Level.INFO,
                event_type='H15_NOTIFICATION',
                message=f'Notifikasi H-15 dikirim ke {student.email}',
                context={'session_id': session.id, 'student_id': student.id},
            )
    except Exception as e:
        logger.exception('check_h15_notifications error: %s', e)


def check_auto_cancel():
    """FR-S05: Auto-cancel sessions where student did not show up > 30 min."""
    try:
        from django.utils import timezone
        from datetime import timedelta
        from apps.bimbingan.models import Session, SystemLog
        from apps.bimbingan.services.notification import notify_student, notify_lecturer
        from apps.bimbingan.services.calendar import delete_event
        from apps.submissions.models import Submission

        cutoff = timezone.now() - timedelta(minutes=30)

        sessions = Session.objects.filter(
            status__in=[Session.Status.WAITING],
            scheduled_at__lte=cutoff,
            ts1__isnull=True,
        ).select_related('submission__student', 'submission__student__adviser')

        for session in sessions:
            student = session.submission.student
            dosen = student.adviser

            # Cancel session
            session.status = Session.Status.CANCELLED
            session.save(update_fields=['status', 'updated_at'])

            # Cancel submission
            submission = session.submission
            submission.status = Submission.Status.CANCELLED
            submission.save(update_fields=['status', 'updated_at'])

            # Delete Google Calendar event
            if session.google_event_id and dosen:
                delete_event(dosen, session.google_event_id)

            # Notify parties
            notify_student(
                student,
                'Sesi bimbingan Anda telah dibatalkan otomatis karena tidak hadir lebih dari 30 menit.',
                session=session,
                event_type='AUTO_CANCEL',
            )
            if dosen:
                notify_lecturer(
                    dosen,
                    f'Sesi bimbingan dengan {student.full_name} dibatalkan otomatis (tidak hadir >30 menit).',
                    session=session,
                    event_type='AUTO_CANCEL',
                )

            # Recalculate remaining queue for this dosen
            if dosen:
                _recalculate_queue(dosen)

            SystemLog.objects.create(
                level=SystemLog.Level.WARNING,
                event_type='EMERGENCY_CANCEL',
                message=f'Auto-cancel sesi #{session.id} — mahasiswa tidak hadir >30 menit',
                context={
                    'session_id': session.id,
                    'student_id': student.id,
                    'dosen_id': dosen.id if dosen else None,
                },
            )
            logger.warning('Auto-cancel sesi #%s untuk mahasiswa %s', session.id, student.email)
    except Exception as e:
        logger.exception('check_auto_cancel error: %s', e)


def _recalculate_queue(dosen):
    """
    Recalculate scheduledAt for all WAITING sessions of a given dosen today.
    Called after a cancellation to compact the queue.
    """
    try:
        from django.utils import timezone
        from datetime import timedelta
        from apps.bimbingan.models import Session
        from apps.bimbingan.services.calendar import update_event

        now = timezone.now()
        waiting = Session.objects.filter(
            submission__student__adviser=dosen,
            status=Session.Status.WAITING,
        ).order_by('scheduled_at')

        cursor = now
        for session in waiting:
            old_scheduled = session.scheduled_at
            session.scheduled_at = cursor
            session.save(update_fields=['scheduled_at', 'updated_at'])
            cursor += timedelta(minutes=session.estimated_minutes)

            # Update Google Calendar event if time changed
            if session.google_event_id and old_scheduled != session.scheduled_at:
                update_event(dosen, session.google_event_id, {
                    'start_time': session.scheduled_at,
                    'end_time': cursor,
                })
    except Exception as e:
        logger.exception('_recalculate_queue error: %s', e)


def start_scheduler():
    """Start APScheduler background scheduler."""
    global _scheduler
    try:
        from apscheduler.schedulers.background import BackgroundScheduler
        from apscheduler.triggers.interval import IntervalTrigger
        import atexit

        _scheduler = BackgroundScheduler(timezone='Asia/Jakarta')
        _scheduler.add_job(
            check_h15_notifications,
            IntervalTrigger(minutes=1),
            id='h15_notification',
            replace_existing=True,
            misfire_grace_time=30,
        )
        _scheduler.add_job(
            check_auto_cancel,
            IntervalTrigger(minutes=5),
            id='auto_cancel',
            replace_existing=True,
            misfire_grace_time=60,
        )
        _scheduler.start()
        atexit.register(lambda: _scheduler.shutdown(wait=False))
        logger.info('Background scheduler dimulai (H-15 & auto-cancel aktif)')
    except Exception as e:
        logger.exception('Gagal memulai APScheduler: %s', e)
