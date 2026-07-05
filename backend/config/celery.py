"""
Celery app definition for TemuDosen — Phase 6 (STT/AI Summarization).
Imported at Django startup via config/__init__.py so @shared_task is discoverable project-wide.

Source: docs.celeryq.dev/en/stable/django/first-steps-with-django.html
"""
import os

from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.docker')

app = Celery('temudosen')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
