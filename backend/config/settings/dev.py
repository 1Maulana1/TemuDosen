"""Development settings — DEBUG=True, SQLite, CORS for localhost:5173."""
from .base import *  # noqa: F401, F403

DEBUG = True

# '*' is dev-only — safe here since DEBUG=True and this settings module is never
# used outside a developer's own machine/LAN (see docker.py/prod.py for real hosts).
ALLOWED_HOSTS = ['*']

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',  # noqa: F405
    }
}

# CORS — allow React dev server (Vite proxy handles same-origin in practice, but CORS
# headers are still needed for direct requests from non-proxy contexts). The regexes
# additionally allow any private-LAN IP on the Vite port, so opening the app from a
# phone/other device on the same WiFi works without hardcoding this machine's IP.
CORS_ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
]
CORS_ALLOWED_ORIGIN_REGEXES = [
    r'^http://192\.168\.\d{1,3}\.\d{1,3}:5173$',
    r'^http://10\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173$',
    r'^http://172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}:5173$',
]
CORS_ALLOW_CREDENTIALS = True

# Django 4+ rejects cross-origin unsafe requests (e.g. approve POST from the
# Vite dev server) unless the frontend origin is explicitly trusted for CSRF.
# CSRF_TRUSTED_ORIGINS doesn't support IP-range wildcards, so LAN origins are
# instead trusted dynamically by LenientLanCsrfMiddleware (swapped in below).
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS

# Swap in the LAN-aware CSRF middleware (dev-only) so requests from a phone/other
# device on the same WiFi don't get rejected without needing to know this
# machine's IP ahead of time. New list — does not mutate base.py's MIDDLEWARE.
MIDDLEWARE = [
    'config.middleware.LenientLanCsrfMiddleware' if m == 'django.middleware.csrf.CsrfViewMiddleware' else m
    for m in MIDDLEWARE  # noqa: F405
]

# Session/CSRF cookies can be sent over HTTP in development
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
