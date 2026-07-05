"""
Import Celery app saat Django startup agar @shared_task ter-autodiscover.
Guard: jika celery tidak terpasang, celery_app = None (lihat config/celery.py).
"""
from .celery import app as celery_app

__all__ = ('celery_app',)
