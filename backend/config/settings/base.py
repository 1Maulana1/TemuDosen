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
