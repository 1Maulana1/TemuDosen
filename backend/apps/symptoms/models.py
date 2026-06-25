"""SymptomCategory model — stub for Plan 01 (implemented fully in Plan 03)."""
from django.db import models


class SymptomCategory(models.Model):
    name = models.CharField(max_length=255, unique=True)
    duration_minutes = models.PositiveIntegerField(
        help_text='Estimated guidance duration in minutes (absolute, D-04)'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'Symptom Categories'

    def __str__(self):
        return f'{self.name} ({self.duration_minutes} min)'
