"""Production settings — HTTPS required, strict cookies, no debug."""
from .base import *  # noqa: F401, F403
import environ

env = environ.Env()

DEBUG = False

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=[])

DATABASES = {
    'default': env.db('DATABASE_URL')
}

# HTTPS-only cookies in production
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Cookie SameSite policy.
#   - 'Lax' (default): frontend and backend share a registrable domain, e.g.
#     app.temudosen.com  ↔  api.temudosen.com  (same-site → cookies flow).
#   - 'None': frontend is on a DIFFERENT site, e.g. temudosen.pages.dev  ↔
#     api.temudosen.com. Cross-site auth cookies require SameSite=None; Secure.
# Set COOKIE_SAMESITE=None in the environment for a *.pages.dev frontend.
COOKIE_SAMESITE = env.str('COOKIE_SAMESITE', default='Lax')
SESSION_COOKIE_SAMESITE = COOKIE_SAMESITE
CSRF_COOKIE_SAMESITE = COOKIE_SAMESITE

# Security headers
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_SSL_REDIRECT = True
# Di belakang reverse proxy (Railway/Render), TLS diterminasi di proxy dan
# request sampai ke gunicorn sebagai HTTP. Tanpa ini SECURE_SSL_REDIRECT
# menghasilkan redirect loop 301.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# CORS — production origins only
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[])
CORS_ALLOW_CREDENTIALS = True
CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS
