"""
Base settings for TemuDosen — shared across all environments.
AUTH_USER_MODEL is set here BEFORE any app migration runs (Pitfall 1 prevention).
"""
import environ
from pathlib import Path

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent.parent

env = environ.Env()
# Read .env from the backend directory (parent of config/)
environ.Env.read_env(BASE_DIR / '.env')

# Security
SECRET_KEY = env('SECRET_KEY', default='django-insecure-change-me-in-production')

# CRITICAL: Set AUTH_USER_MODEL BEFORE any migration runs.
# This must appear in base.py so it is active on the very first `makemigrations`.
AUTH_USER_MODEL = 'accounts.CustomUser'

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third-party
    'rest_framework',
    'corsheaders',
    'django_filters',
    # Internal apps
    'apps.accounts',
    'apps.submissions',
    'apps.symptoms',
    'apps.bimbingan',
    'apps.logbook',
    'core',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',          # MUST be before CommonMiddleware
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# Internationalization
LANGUAGE_CODE = 'id-id'
TIME_ZONE = 'Asia/Jakarta'
USE_I18N = True
USE_TZ = True

# Static files
STATIC_URL = '/static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# DRF — session auth + IsAuthenticated as default
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_FILTER_BACKENDS': [
        'django_filters.rest_framework.DjangoFilterBackend',
    ],
}

# Session settings (server-side, D-21)
SESSION_ENGINE = 'django.contrib.sessions.backends.db'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'

# CSRF — intentionally NOT HttpOnly so React can read the token from JS
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = 'Lax'

# File storage — NOT served via MEDIA_URL directly (D-29: auth-gated serving)
MEDIA_ROOT = env('MEDIA_ROOT', default=str(BASE_DIR / 'storage'))
MEDIA_URL = None  # Intentionally None — files served via /api/files/<uuid>/ auth view only

# Upload size limits: 6MB so Django accepts the upload before serializer validates at 5MB (Pitfall 6)
DATA_UPLOAD_MAX_MEMORY_SIZE = 6 * 1024 * 1024
FILE_UPLOAD_MAX_MEMORY_SIZE = 6 * 1024 * 1024

# Phase 2: Google Calendar Integration
GOOGLE_CALENDAR_ENABLED = env.bool('GOOGLE_CALENDAR_ENABLED', default=False)
GOOGLE_CLIENT_ID = env('GOOGLE_CLIENT_ID', default='')
GOOGLE_CLIENT_SECRET = env('GOOGLE_CLIENT_SECRET', default='')
GOOGLE_REDIRECT_URI = env('GOOGLE_REDIRECT_URI', default='http://localhost:8000/api/calendar/callback/')
FRONTEND_URL = env('FRONTEND_URL', default='http://localhost:5173')

# Phase 2: Dosen daily guidance quota (minutes); default 480 min = 8 hours
DOSEN_DAILY_QUOTA_MINUTES = env.int('DOSEN_DAILY_QUOTA_MINUTES', default=480)

# Phase 5 (SESSION-03/04): batas ukuran upload rekaman audio sesi; default 100MB
# (~2 jam Opus 64kbps masih jauh di bawah ini)
RECORDING_MAX_UPLOAD_SIZE = env.int('RECORDING_MAX_UPLOAD_SIZE', default=100 * 1024 * 1024)

# ── Phase 6: STT + AI Summarization + Logbook (Celery/Redis/faster-whisper/Anthropic) ──
# Celery broker (Redis). CELERY_RESULT_BACKEND sengaja TIDAK diset — semua task
# ignore_result=True (lihat apps/logbook/tasks.py), status dilacak di SessionLogbook.
CELERY_BROKER_URL = env('CELERY_BROKER_URL', default='redis://redis:6379/0')
CELERY_TASK_TRACK_STARTED = True
CELERY_TIMEZONE = TIME_ZONE  # 'Asia/Jakarta'
CELERY_TASK_TIME_LIMIT = 60 * 60 * 4  # ceiling di atas LLM_BATCH_TIMEOUT_MINUTES (D-08)

# Feature flag: mematikan (default) seluruh pipeline STT->LLM → setiap sesi jatuh ke
# editor catatan manual (graceful degradation, STT-07). "Belum ada API key" = aman.
STT_LLM_ENABLED = env.bool('STT_LLM_ENABLED', default=False)  # D-04

# faster-whisper (D-01)
STT_MODEL_SIZE = env('STT_MODEL_SIZE', default='small')
STT_COMPUTE_TYPE = env('STT_COMPUTE_TYPE', default='int8')
STT_LANGUAGE = env('STT_LANGUAGE', default='id')
STT_MODEL_DOWNLOAD_ROOT = env('STT_MODEL_DOWNLOAD_ROOT', default=str(BASE_DIR / 'storage' / 'whisper_models'))

# ── Campus logbook integration (Phase 7 SC3-6: Sekawan/KPTI) ────────────────────
# Feature flag off by default → sync is a no-op and the CSV/PDF export fallback is
# offered instead (graceful degradation, LOGBOOK-03). "Belum ada API kampus" = aman.
CAMPUS_LOGBOOK_ENABLED = env.bool('CAMPUS_LOGBOOK_ENABLED', default=False)
CAMPUS_LOGBOOK_PROVIDER = env('CAMPUS_LOGBOOK_PROVIDER', default='sekawan')  # 'sekawan' | 'kpti'
CAMPUS_LOGBOOK_BASE_URL = env('CAMPUS_LOGBOOK_BASE_URL', default='')
CAMPUS_LOGBOOK_TOKEN = env('CAMPUS_LOGBOOK_TOKEN', default='')
CAMPUS_LOGBOOK_TIMEOUT = env.int('CAMPUS_LOGBOOK_TIMEOUT', default=5)
CAMPUS_LOGBOOK_MAX_RETRIES = env.int('CAMPUS_LOGBOOK_MAX_RETRIES', default=3)

# Anthropic LLM summarization (D-04). Model id harus valid — jangan disubstitusi.
LLM_MODEL = env('LLM_MODEL', default='claude-haiku-4-5')
ANTHROPIC_API_KEY = env('ANTHROPIC_API_KEY', default='')
LLM_BATCH_TIMEOUT_MINUTES = env.int('LLM_BATCH_TIMEOUT_MINUTES', default=180)  # D-08
MAX_TRANSCRIPT_TOKENS = env.int('MAX_TRANSCRIPT_TOKENS', default=48000)
# Tarif untuk estimasi biaya (D-11), disimpan ke SessionLogbook.llm_cost_estimate_idr.
LLM_INPUT_RATE_USD_PER_MTOK = env.float('LLM_INPUT_RATE_USD_PER_MTOK', default=0.50)
LLM_OUTPUT_RATE_USD_PER_MTOK = env.float('LLM_OUTPUT_RATE_USD_PER_MTOK', default=2.50)
USD_TO_IDR_RATE = env.float('USD_TO_IDR_RATE', default=16000.0)
