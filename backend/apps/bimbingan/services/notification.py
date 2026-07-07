"""
Notification service.

Writes two things per notification:
  1. A per-user `Notification` row — this is what the recipient's own in-app feed
     reads (audit G2; previously only SystemLog was written, which is admin-only so
     the user never saw anything).
  2. A `SystemLog` row — kept for the admin audit trail.

Real email/push delivery is a separate future enhancement (NOTIF-01).
"""
import logging

logger = logging.getLogger(__name__)


def _deliver(recipient, role_tag, message, session, event_type):
    from apps.bimbingan.models import Notification, SystemLog
    # Per-user feed row (what the recipient actually sees).
    try:
        Notification.objects.create(
            recipient=recipient,
            event_type=event_type,
            message=message,
            session=session,
        )
    except Exception:
        logger.exception('Gagal membuat Notification untuk %s', getattr(recipient, 'email', '?'))
    # Admin audit trail.
    SystemLog.objects.create(
        level=SystemLog.Level.INFO,
        event_type=event_type,
        message=f'[{role_tag}] {recipient.email}: {message}',
        context={
            'user_id': recipient.id,
            'user_email': recipient.email,
            'session_id': session.id if session else None,
        },
    )
    logger.info("Notifikasi %s [%s]: %s", role_tag, recipient.email, message)


def notify_student(student, message: str, session=None, event_type: str = 'NOTIFICATION'):
    """Send an in-app notification to a student (feed row + SystemLog)."""
    _deliver(student, 'MAHASISWA', message, session, event_type)


def notify_lecturer(lecturer, message: str, session=None, event_type: str = 'NOTIFICATION'):
    """Send an in-app notification to a lecturer (feed row + SystemLog)."""
    _deliver(lecturer, 'DOSEN', message, session, event_type)
