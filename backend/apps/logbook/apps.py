"""Logbook app — Phase 6: STT transcription, AI summarization, and the session logbook."""
from django.apps import AppConfig


class LogbookConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.logbook'
    verbose_name = 'Logbook'
