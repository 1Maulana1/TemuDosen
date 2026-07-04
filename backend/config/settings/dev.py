"""Development settings — DEBUG=True, SQLite, CORS for localhost:5173."""
from .base import *  # noqa: F401, F403

DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0']

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',  # noqa: F405
    }
}

# CORS — allow React dev server (Vite proxy handles same-origin in practice, but CORS
# headers are still needed for direct requests from non-proxy contexts)
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]
CORS_ALLOW_CREDENTIALS = True

# Django 4+ rejects cross-origin unsafe requests (e.g. approve POST from the
# Vite dev server) unless the frontend origin is explicitly trusted for CSRF
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

# Session/CSRF cookies can be sent over HTTP in development
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
