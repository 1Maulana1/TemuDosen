"""
Core cross-cutting views.

csrf_cookie: GET endpoint that forces Django to set the csrftoken cookie.
React SPA calls this on mount before making any POST requests (Pitfall 3 prevention).
"""
from django.middleware.csrf import get_token
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@api_view(['GET'])
@authentication_classes([])
@permission_classes([AllowAny])
def csrf_cookie(request):
    """
    GET /api/csrf/
    Forces Django to set the csrftoken cookie in the response.
    Called on app mount (main.tsx) before the first POST to prevent CSRF failures.
    """
    # Token juga dikirim di body: saat frontend di domain lain (mis. Vercel),
    # JS tidak bisa membaca cookie milik domain backend, jadi nilai token
    # harus diambil dari respons ini dan disimpan di memori.
    token = get_token(request)  # forces the cookie to be set in the response
    return Response({'detail': 'CSRF cookie set', 'csrfToken': token})
