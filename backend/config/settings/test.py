"""Test settings — in-memory SQLite, fast hasher, no CORS."""
from .base import *  # noqa: F401, F403

DEBUG = False

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

# Fast password hasher for tests (PBKDF2 is intentionally slow — use MD5 in tests)
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.MD5PasswordHasher',
]

# CORS — irrelevant in tests, allow all
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True

SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False

# Phase 6: jalankan task Celery sinkron di test (tanpa broker Redis). Hanya
# berpengaruh jika `celery` terpasang; jalur graceful-degradation diuji tanpa
# dependency berat karena STT_LLM_ENABLED tetap False.
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
STT_LLM_ENABLED = False

# Test mengasumsikan integrasi eksternal nonaktif — jangan biarkan nilai dari
# backend/.env developer (mis. GOOGLE_CALENDAR_ENABLED=true) bocor ke test run.
GOOGLE_CALENDAR_ENABLED = False
GOOGLE_CLIENT_ID = ''
GOOGLE_CLIENT_SECRET = ''
