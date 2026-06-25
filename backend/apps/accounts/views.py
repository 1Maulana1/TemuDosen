"""
Account auth views:
  POST /api/auth/login/   → LoginView (AllowAny, session-based D-21)
  POST /api/auth/logout/  → LogoutView (IsAuthenticated)
  GET  /api/auth/me/      → MeView (IsAuthenticated)
"""
from django.contrib.auth import authenticate, login, logout
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import UserSerializer


class LoginView(APIView):
    """
    POST /api/auth/login/
    Body: {"email": "...", "password": "..."}
    On success: creates a server-side session (D-21) and returns the user object.
    On failure: returns 400 with an error message.
    AllowAny — no authentication required to call this endpoint.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip()
        password = request.data.get('password', '')

        if not email or not password:
            return Response(
                {'detail': 'Email dan password wajib diisi.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = authenticate(request, username=email, password=password)
        if user is None:
            return Response(
                {'detail': 'Email atau password salah.'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        login(request, user)
        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    POST /api/auth/logout/
    Ends the current session. Requires authentication.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response({'detail': 'Berhasil keluar.'}, status=status.HTTP_200_OK)


class MeView(APIView):
    """
    GET /api/auth/me/
    Returns the serialized current user with role, is_approved, etc.
    Returns 403 if the user is not authenticated.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)
