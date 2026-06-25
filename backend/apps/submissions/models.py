"""Submission models — stub for Plan 01 (implemented fully in Plans 04/05)."""
import uuid
from django.db import models
from django.conf import settings


class Submission(models.Model):
    class Status(models.TextChoices):
        PENDING = 'pending', 'Menunggu'
        APPROVED = 'approved', 'Disetujui'
        REJECTED = 'rejected', 'Ditolak'
        REVISION = 'revision', 'Revisi'

    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='submissions',
        limit_choices_to={'role': 'student'}
    )
    symptoms = models.ManyToManyField('symptoms.SymptomCategory', blank=True)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
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
