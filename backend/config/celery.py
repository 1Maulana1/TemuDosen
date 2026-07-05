"""
Celery app untuk TemuDosen — Phase 6 (STT/AI Summarization).

Di-import saat startup Django lewat config/__init__.py agar @shared_task
ditemukan di seluruh proyek.

Guard: jika paket `celery` belum terpasang (mis. environment dev/test tanpa
pipeline), `app = None` dan Django tetap boot normal — task tidak akan
di-autodiscover, dan dispatcher di CompleteSessionView menanganinya secara
defensif. Ini konsisten dengan graceful degradation (STT_LLM_ENABLED default False).
"""
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.dev')

try:
    from celery import Celery
except ImportError:  # celery belum terpasang — pipeline nonaktif
    app = None
else:
    app = Celery('temudosen')
    app.config_from_object('django.conf:settings', namespace='CELERY')
    app.autodiscover_tasks()
