"""
Account auth views:
  POST /api/auth/login/           → LoginView (AllowAny, session-based D-21)
  POST /api/auth/logout/          → LogoutView (IsAuthenticated)
  GET  /api/auth/me/              → MeView (IsAuthenticated)
  POST /api/auth/register/        → RegisterView (AllowAny — Plan 02)
  GET  /api/users/lecturers/      → LecturerListView (AllowAny — approved only, Plan 02)
  GET  /api/users/pending/        → PendingUsersView (IsAdmin — Plan 02)
  POST /api/users/<id>/approve/   → ApproveUserView (IsAdmin — Plan 02)
  POST /api/users/<id>/reject/    → RejectUserView (IsAdmin — Plan 02)
"""
from django.contrib.auth import authenticate, login, logout
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CustomUser, UserRole
from .permissions import IsAdmin
from .serializers import (
    LecturerListSerializer,
    LecturerRegisterSerializer,
    PendingUserSerializer,
    StudentRegisterSerializer,
    UserSerializer,
)


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
    throttle_scope = 'login'  # brute-force protection (audit S4)

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
    is_approved is included so the frontend gate can redirect unapproved users (Pitfall 8).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class RegisterView(APIView):
    """
    POST /api/auth/register/
    Body must include `role` field: "student" or "lecturer" (D-18).
    Dispatches to the appropriate serializer based on role.
    Only student and lecturer roles are accepted — admin/ketua_jurusan only via seed_admin (T-1-06).
    New accounts always start with is_approved=False (D-20).
    AllowAny — unauthenticated users need to register.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        role = request.data.get('role', '')

        if role == UserRole.STUDENT:
            serializer = StudentRegisterSerializer(data=request.data)
        elif role == UserRole.LECTURER:
            serializer = LecturerRegisterSerializer(data=request.data)
        else:
            return Response(
                {'role': ['Pilih peran yang valid: mahasiswa (student) atau dosen (lecturer).']},
                status=status.HTTP_400_BAD_REQUEST
            )

        if serializer.is_valid():
            user = serializer.save()
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LecturerListView(APIView):
    """
    GET /api/users/lecturers/
    Returns all approved lecturers for the student registration dropdown (D-24).
    Filters to role=lecturer AND is_approved=True — never exposes pending lecturers (Pitfall 7 / T-1-08).
    AllowAny — needed by unauthenticated students filling out the registration form.
    """
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        lecturers = CustomUser.objects.filter(
            role=UserRole.LECTURER,
            is_approved=True,  # Pitfall 7: only expose approved lecturers
        ).order_by('full_name')
        serializer = LecturerListSerializer(lecturers, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class PendingUsersView(APIView):
    """
    GET /api/users/pending/
    Returns all users with is_approved=False (students + lecturers) ordered by created_at.
    Admin only (T-1-07 / IsAdmin permission).
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        pending = CustomUser.objects.filter(
            is_approved=False,
            role__in=[UserRole.STUDENT, UserRole.LECTURER],
        ).order_by('created_at')
        serializer = PendingUserSerializer(pending, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ApproveUserView(APIView):
    """
    POST /api/users/<id>/approve/
    Sets is_approved=True for the target user.
    Admin only (IsAdmin permission).
    """
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        user = get_object_or_404(CustomUser, pk=pk)
        user.is_approved = True
        user.save(update_fields=['is_approved'])
        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)


class RejectUserView(APIView):
    """
    POST /api/users/<id>/reject/
    Deactivates the pending account (sets is_active=False).
    Deactivation is preferred over deletion to preserve audit trail.
    Admin only (IsAdmin permission).
    """
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        user = get_object_or_404(CustomUser, pk=pk)
        user.is_active = False
        user.save(update_fields=['is_active'])
        serializer = UserSerializer(user)
        return Response(serializer.data, status=status.HTTP_200_OK)
