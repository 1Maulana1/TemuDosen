"""
Google Calendar service — Phase 2 (FR-S06, FR-S07, FR-S08).

Design principles:
- All methods degrade gracefully: API failures are logged to SystemLog
  but NEVER propagate exceptions that would block the approve flow.
- If GOOGLE_CALENDAR_ENABLED=false, all methods return safe defaults immediately.
- Tokens are stored encrypted (Fernet/AES-128-CBC+HMAC) in DosenCalendarToken.
- Token refresh is handled transparently before each API call.
"""
import logging
from datetime import datetime, timezone as dt_timezone
from typing import Optional

from django.conf import settings

logger = logging.getLogger(__name__)

# ── Encryption helpers ─────────────────────────────────────────────────────────

def _get_fernet():
    """Return a Fernet instance keyed from SECRET_KEY (AES-128-CBC + HMAC-SHA256)."""
    import base64
    import hashlib
    from cryptography.fernet import Fernet
    raw = settings.SECRET_KEY.encode()
    key = base64.urlsafe_b64encode(hashlib.sha256(raw).digest())
    return Fernet(key)


def encrypt_token(plaintext: str) -> str:
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    return _get_fernet().decrypt(ciphertext.encode()).decode()


# ── Google OAuth2 helpers ──────────────────────────────────────────────────────

def _build_credentials(dosen):
    """
    Build google.oauth2.credentials.Credentials from stored token.
    Returns None if token not found or decryption fails.
    """
    try:
        from google.oauth2.credentials import Credentials
        from apps.bimbingan.models import DosenCalendarToken

        token_row = DosenCalendarToken.objects.get(dosen=dosen)
        access_token = decrypt_token(token_row.access_token_enc)
        refresh_token = decrypt_token(token_row.refresh_token_enc)

        creds = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri='https://oauth2.googleapis.com/token',
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=['https://www.googleapis.com/auth/calendar'],
        )
        return creds
    except Exception as e:
        _log_error(f'_build_credentials gagal: {e}', {})
        return None


def _refresh_and_save(creds, dosen):
    """Refresh expired credentials and persist new access token."""
    try:
        import google.auth.transport.requests as gr
        from apps.bimbingan.models import DosenCalendarToken
        from django.utils import timezone

        request = gr.Request()
        creds.refresh(request)

        token_row = DosenCalendarToken.objects.get(dosen=dosen)
        token_row.access_token_enc = encrypt_token(creds.token)
        token_row.expires_at = creds.expiry.replace(tzinfo=dt_timezone.utc)
        token_row.save(update_fields=['access_token_enc', 'expires_at', 'updated_at'])
    except Exception as e:
        _log_error(f'Token refresh gagal untuk {dosen.email}: {e}', {'dosen_id': dosen.id})


def _get_calendar_service(dosen):
    """
    Build an authorized Google Calendar API service object.
    Returns None on any failure (graceful degradation).
    """
    try:
        from googleapiclient.discovery import build
        creds = _build_credentials(dosen)
        if creds is None:
            return None
        if creds.expired and creds.refresh_token:
            _refresh_and_save(creds, dosen)
        return build('calendar', 'v3', credentials=creds, cache_discovery=False)
    except Exception as e:
        _log_error(f'_get_calendar_service gagal: {e}', {'dosen_id': dosen.id})
        return None


def _log_error(message: str, context: dict):
    from apps.bimbingan.models import SystemLog
    try:
        SystemLog.objects.create(
            level=SystemLog.Level.ERROR,
            event_type='CALENDAR_ERROR',
            message=message,
            context=context,
        )
    except Exception:
        pass
    logger.error('[CalendarService] %s', message)


def _calendar_enabled() -> bool:
    return getattr(settings, 'GOOGLE_CALENDAR_ENABLED', False)


# ── Public API ─────────────────────────────────────────────────────────────────

def check_free_busy(dosen, start_time: datetime, end_time: datetime) -> dict:
    """
    FR-S06: Check if dosen's Google Calendar is free in the given slot.
    Returns {'isFree': True, 'conflicts': []} on any failure (graceful degradation).
    """
    if not _calendar_enabled():
        logger.debug('Google Calendar dinonaktifkan — skip checkFreeBusy')
        return {'isFree': True, 'conflicts': []}

    try:
        service = _get_calendar_service(dosen)
        if service is None:
            return {'isFree': True, 'conflicts': []}

        body = {
            'timeMin': start_time.isoformat(),
            'timeMax': end_time.isoformat(),
            'items': [{'id': 'primary'}],
        }
        result = service.freebusy().query(body=body).execute()
        busy_periods = result.get('calendars', {}).get('primary', {}).get('busy', [])
        return {
            'isFree': len(busy_periods) == 0,
            'conflicts': busy_periods,
        }
    except Exception as e:
        _log_error(
            f'checkFreeBusy gagal untuk {dosen.email}: {e}',
            {'dosen_id': dosen.id},
        )
        return {'isFree': True, 'conflicts': []}


def create_event(dosen, event_data: dict) -> Optional[str]:
    """
    FR-S07: Create a Google Calendar event.
    event_data keys: title, description, start_time (datetime), end_time (datetime),
                     attendee_email (optional).
    Returns googleEventId string or None on failure.
    """
    if not _calendar_enabled():
        logger.debug('Google Calendar dinonaktifkan — skip createEvent')
        return None

    try:
        service = _get_calendar_service(dosen)
        if service is None:
            return None

        event_body = {
            'summary': event_data.get('title', 'Bimbingan'),
            'description': event_data.get('description', ''),
            'start': {
                'dateTime': event_data['start_time'].isoformat(),
                'timeZone': settings.TIME_ZONE,
            },
            'end': {
                'dateTime': event_data['end_time'].isoformat(),
                'timeZone': settings.TIME_ZONE,
            },
        }

        attendee_email = event_data.get('attendee_email')
        if attendee_email:
            event_body['attendees'] = [{'email': attendee_email}]

        created = service.events().insert(calendarId='primary', body=event_body).execute()
        event_id = created.get('id')
        logger.info('Google Calendar event dibuat: %s', event_id)
        return event_id
    except Exception as e:
        _log_error(
            f'createEvent gagal untuk {dosen.email}: {e}',
            {'dosen_id': dosen.id},
        )
        return None


def delete_event(dosen, google_event_id: str) -> bool:
    """
    FR-S08: Delete a Google Calendar event. Returns True on success, False on failure.
    """
    if not _calendar_enabled() or not google_event_id:
        return True

    try:
        service = _get_calendar_service(dosen)
        if service is None:
            return False
        service.events().delete(calendarId='primary', eventId=google_event_id).execute()
        logger.info('Google Calendar event dihapus: %s', google_event_id)
        return True
    except Exception as e:
        _log_error(
            f'deleteEvent gagal untuk {dosen.email} event {google_event_id}: {e}',
            {'dosen_id': dosen.id, 'event_id': google_event_id},
        )
        return False


def update_event(dosen, google_event_id: str, event_data: dict) -> bool:
    """
    FR-S08: Update an existing Google Calendar event. Returns True on success.
    """
    if not _calendar_enabled() or not google_event_id:
        return True

    try:
        service = _get_calendar_service(dosen)
        if service is None:
            return False

        patch_body = {}
        if 'title' in event_data:
            patch_body['summary'] = event_data['title']
        if 'start_time' in event_data:
            patch_body['start'] = {
                'dateTime': event_data['start_time'].isoformat(),
                'timeZone': settings.TIME_ZONE,
            }
        if 'end_time' in event_data:
            patch_body['end'] = {
                'dateTime': event_data['end_time'].isoformat(),
                'timeZone': settings.TIME_ZONE,
            }

        service.events().patch(
            calendarId='primary',
            eventId=google_event_id,
            body=patch_body,
        ).execute()
        logger.info('Google Calendar event diupdate: %s', google_event_id)
        return True
    except Exception as e:
        _log_error(
            f'updateEvent gagal untuk {dosen.email} event {google_event_id}: {e}',
            {'dosen_id': dosen.id, 'event_id': google_event_id},
        )
        return False
