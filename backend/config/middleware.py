import re

from django.middleware.csrf import CsrfViewMiddleware

_LAN_ORIGIN_RE = re.compile(
    r"^http://(192\.168\.\d{1,3}\.\d{1,3}"
    r"|10\.\d{1,3}\.\d{1,3}\.\d{1,3}"
    r"|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):5173$"
)


class LenientLanCsrfMiddleware(CsrfViewMiddleware):
    """Dev-only: percayai Origin dari IP LAN privat manapun di port Vite (5173),
    supaya testing dari HP/device lain tidak perlu hardcode IP laptop di
    CSRF_TRUSTED_ORIGINS (yang berubah tiap ganti jaringan)."""

    def _origin_verified(self, request):
        if _LAN_ORIGIN_RE.match(request.META.get("HTTP_ORIGIN", "")):
            return True
        return super()._origin_verified(request)
