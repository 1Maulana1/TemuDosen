"""
Phase 6 models: SessionLogbook.

SessionLogbook:
  - Dedicated storage for the STT -> LLM summarization pipeline (D-05).
  - OneToOne with bimbingan.Session — deliberately NOT fields on Session itself,
    which is already overloaded as the queue/scheduling record.
  - Carries the D-06 status lifecycle (pending -> transcribing -> summarizing ->
    ready_for_review -> approved / failed) and the D-11 token/cost tracking
    fields populated once the LLM pipeline stage completes.
"""
from django.db import models
from django.conf import settings


class SessionLogbook(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Menunggu'
        TRANSCRIBING = 'transcribing', 'Transkripsi'
        SUMMARIZING = 'summarizing', 'Merangkum'
        READY_FOR_REVIEW = 'ready_for_review', 'Menunggu Tinjauan'
        APPROVED = 'approved', 'Disetujui'
        FAILED = 'failed', 'Gagal'

    class SourceMode(models.TextChoices):
        OFFLINE = 'offline', 'Offline'
        ONLINE = 'online', 'Online'

    session = models.OneToOneField(
        'bimbingan.Session',
        on_delete=models.CASCADE,
        related_name='logbook',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
    )
    transcript = models.TextField(blank=True, default='')
    summary_raw = models.JSONField(default=dict, blank=True)
    summary_edited = models.JSONField(null=True, blank=True)
    batch_id = models.CharField(max_length=128, blank=True, default='')
    source_mode = models.CharField(
        max_length=10,
        choices=SourceMode.choices,
        default=SourceMode.OFFLINE,
    )
    is_manual = models.BooleanField(default=False)
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_logbooks',
    )
    # D-11: token/cost tracking, populated when poll_summary_batch parses the
    # successful batch result. Nullable/unpopulated until the LLM stage completes.
    llm_input_tokens = models.PositiveIntegerField(null=True, blank=True)
    llm_output_tokens = models.PositiveIntegerField(null=True, blank=True)
    llm_cost_estimate_idr = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
    )
    # Phase 7 SC3-5 (LOGBOOK-01/03): sync ke logbook kampus (Sekawan/KPTI).
    # Diisi saat dosen menyetujui ringkasan; degradasi anggun bila API mati.
    class CampusSyncStatus(models.TextChoices):
        NOT_SYNCED = 'not_synced', 'Belum Disinkron'
        SYNCED = 'synced', 'Tersinkron'
        FAILED = 'failed', 'Gagal'
        PENDING_RETRY = 'pending_retry', 'Menunggu Coba Ulang'

    campus_sync_status = models.CharField(
        max_length=20,
        choices=CampusSyncStatus.choices,
        default=CampusSyncStatus.NOT_SYNCED,
    )
    campus_entry_id = models.CharField(max_length=128, blank=True, default='')
    campus_synced_at = models.DateTimeField(null=True, blank=True)
    campus_sync_attempts = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Logbook sesi #{self.session_id} [{self.status}]'


class CampusLogbookConfig(models.Model):
    """Phase 7 SC6 (ADMIN-04): runtime config for campus logbook sync.

    Singleton (pk=1). When a row exists it overrides the CAMPUS_LOGBOOK_* settings,
    so an admin can configure credentials without a redeploy. The bearer token is
    stored encrypted (reusing the calendar service's Fernet helper); it is never
    returned by the API — callers see only `has_token`.
    """
    enabled = models.BooleanField(default=False)
    provider = models.CharField(max_length=20, default='sekawan')
    base_url = models.CharField(max_length=300, blank=True, default='')
    token_enc = models.CharField(max_length=500, blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Konfigurasi Logbook Kampus'

    def __str__(self):
        return f'CampusLogbookConfig(enabled={self.enabled}, provider={self.provider})'

    def save(self, *args, **kwargs):
        self.pk = 1  # enforce singleton
        super().save(*args, **kwargs)

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def set_token(self, plaintext: str):
        from apps.bimbingan.services.calendar import encrypt_token
        self.token_enc = encrypt_token(plaintext) if plaintext else ''

    def get_token(self) -> str:
        if not self.token_enc:
            return ''
        try:
            from apps.bimbingan.services.calendar import decrypt_token
            return decrypt_token(self.token_enc)
        except Exception:
            return ''
