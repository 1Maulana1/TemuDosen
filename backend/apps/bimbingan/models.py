"""
Phase 2 models: Session, DosenCalendarToken, SystemLog.

Session:
  - Created when a dosen approves a BimbinganRequest (Submission).
  - Tracks queue position, estimated duration, scheduled time, and meeting info.

DosenCalendarToken:
  - Stores encrypted Google Calendar OAuth2 tokens per dosen.
  - Tokens are AES-Fernet encrypted before write and decrypted on read.

SystemLog:
  - Immutable audit log for all system events (notifications, errors, auto-cancels).
"""
import uuid

from django.db import models
from django.conf import settings


class Session(models.Model):
    class Status(models.TextChoices):
        WAITING = 'waiting', 'Menunggu'
        IN_PROGRESS = 'in_progress', 'Berlangsung'
        DONE = 'done', 'Selesai'
        CANCELLED = 'cancelled', 'Dibatalkan'

    class Method(models.TextChoices):
        OFFLINE = 'offline', 'Offline'
        ONLINE = 'online', 'Online'

    submission = models.OneToOneField(
        'submissions.Submission',
        on_delete=models.CASCADE,
        related_name='session',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.WAITING,
    )
    method = models.CharField(
        max_length=10,
        choices=Method.choices,
        null=True,
        blank=True,
    )
    meeting_link = models.URLField(null=True, blank=True)
    estimated_minutes = models.PositiveIntegerField(default=0)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    notification_sent = models.BooleanField(default=False)
    google_event_id = models.CharField(max_length=255, null=True, blank=True)
    ts1 = models.DateTimeField(null=True, blank=True)  # "Mulai & Rekam" timestamp
    ts2 = models.DateTimeField(null=True, blank=True)  # "Selesai" timestamp
    # SESSION-04: catatan hasil manual opsional, diisi dosen saat menekan "Selesai"
    result_notes = models.TextField(blank=True, default='')
    # FR-M04: consent perekaman sesi — kedua pihak harus setuju sebelum ts1 dianggap "direkam"
    consent_given_at = models.DateTimeField(null=True, blank=True)
    consent_by_dosen = models.BooleanField(default=False)
    consent_by_mahasiswa = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['scheduled_at']

    def __str__(self):
        return f'Session #{self.pk} [{self.status}] – {self.submission}'


class SessionRecording(models.Model):
    """
    SESSION-03/04: file audio hasil rekaman sesi (WebM/Ogg/MP4), diupload dosen
    saat menekan "Selesai". Disimpan di MEDIA_ROOT/recordings/ dengan nama UUID —
    tidak pernah diekspos lewat MEDIA_URL (pola yang sama dengan SubmissionFile).
    Hanya boleh ada jika consent_given_at terisi (kedua pihak setuju direkam).
    """
    session = models.OneToOneField(
        Session,
        on_delete=models.CASCADE,
        related_name='recording',
    )
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    original_filename = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    file_size = models.PositiveIntegerField()
    mime_type = models.CharField(max_length=50, default='audio/webm')
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Recording sesi #{self.session_id} ({self.file_size} bytes)'


class DosenCalendarToken(models.Model):
    dosen = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='calendar_token',
        limit_choices_to={'role': 'lecturer'},
    )
    # Stored as base64(Fernet(token_json))
    access_token_enc = models.TextField()
    refresh_token_enc = models.TextField()
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'CalendarToken({self.dosen.email})'


class ActionItem(models.Model):
    """
    FR-KP04: "saran" (recommendation) a dosen gives during/after a session, and
    whether the mahasiswa has followed up ("tindak lanjut"). Backs the ketua
    jurusan compliance report.
    """
    session = models.ForeignKey(
        Session,
        on_delete=models.CASCADE,
        related_name='action_items',
    )
    description = models.TextField()
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'ActionItem #{self.pk} [{"selesai" if self.is_completed else "belum"}] – {self.description[:40]}'


class SystemLog(models.Model):
    class Level(models.TextChoices):
        INFO = 'INFO', 'Info'
        WARNING = 'WARNING', 'Peringatan'
        ERROR = 'ERROR', 'Error'

    level = models.CharField(
        max_length=10,
        choices=Level.choices,
        default=Level.INFO,
    )
    event_type = models.CharField(max_length=50, blank=True, default='')
    message = models.TextField()
    context = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'[{self.level}] {self.event_type}: {self.message[:60]}'
