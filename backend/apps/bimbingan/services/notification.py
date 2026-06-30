"""
Notification service — Phase 2 stub.
Phase 3 will replace these with real push/email delivery.
"""
import logging

logger = logging.getLogger(__name__)


def notify_student(student, message: str, session=None, event_type: str = 'NOTIFICATION'):
    """Send an in-app notification to a student. Logs to SystemLog."""
    from apps.bimbingan.models import SystemLog
    SystemLog.objects.create(
        level=SystemLog.Level.INFO,
        event_type=event_type,
        message=f'[MAHASISWA] {student.email}: {message}',
        context={
            'user_id': student.id,
            'user_email': student.email,
            'session_id': session.id if session else None,
        },
    )
    logger.info("Notifikasi mahasiswa [%s]: %s", student.email, message)


def notify_lecturer(lecturer, message: str, session=None, event_type: str = 'NOTIFICATION'):
    """Send an in-app notification to a lecturer. Logs to SystemLog."""
    from apps.bimbingan.models import SystemLog
    SystemLog.objects.create(
        level=SystemLog.Level.INFO,
        event_type=event_type,
        message=f'[DOSEN] {lecturer.email}: {message}',
        context={
            'user_id': lecturer.id,
            'user_email': lecturer.email,
            'session_id': session.id if session else None,
        },
    )
    logger.info("Notifikasi dosen [%s]: %s", lecturer.email, message)
