"""Submission models — Phase 1 foundation, extended in Phase 2."""
import uuid
from django.db import models
from django.conf import settings


class Submission(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Menunggu'
        APPROVED = 'approved', 'Disetujui'
        REJECTED = 'rejected', 'Ditolak'
        REVISION = 'revision', 'Revisi'
        CANCELLED = 'cancelled', 'Dibatalkan'

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='submissions',
        limit_choices_to={'role': 'student'}
    )
    symptoms = models.ManyToManyField('symptoms.SymptomCategory', blank=True)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    rejection_reason = models.TextField(blank=True, default='')
    # FR-D01: submission REVISION bisa diajukan ulang — tautkan ke submission sebelumnya
    previous_submission = models.ForeignKey(
        'self',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='resubmissions',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']


class SubmissionFile(models.Model):
    submission = models.OneToOneField(
        Submission, on_delete=models.CASCADE, related_name='file'
    )
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    original_filename = models.CharField(max_length=255)
    file_path = models.CharField(max_length=500)
    file_size = models.PositiveIntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)


class ThesisChapter(models.Model):
    """A student's skripsi (thesis) chapter-progress checklist.

    Seeded with the standard Bab I–V on first access; the student toggles each
    chapter's completion themselves. Replaces the previously-static "Progres
    Skripsi" mock on the student dashboard (audit finding T2).
    """
    DEFAULT_TITLES = [
        'Bab I — Pendahuluan',
        'Bab II — Tinjauan Pustaka',
        'Bab III — Metodologi Penelitian',
        'Bab IV — Hasil & Pembahasan',
        'Bab V — Kesimpulan & Saran',
    ]

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='thesis_chapters',
        limit_choices_to={'role': 'student'},
    )
    order = models.PositiveSmallIntegerField()
    title = models.CharField(max_length=120)
    is_completed = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['order']
        unique_together = [('student', 'order')]

    def __str__(self):
        return f'{self.student_id} · {self.title} [{"✓" if self.is_completed else "…"}]'

    @classmethod
    def ensure_for(cls, student):
        """Return the student's chapters, creating the default Bab I–V set the
        first time (idempotent)."""
        if not cls.objects.filter(student=student).exists():
            cls.objects.bulk_create([
                cls(student=student, order=i + 1, title=title)
                for i, title in enumerate(cls.DEFAULT_TITLES)
            ])
        return cls.objects.filter(student=student)
