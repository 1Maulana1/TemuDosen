"""
Account serializers for TemuDosen.

UserSerializer: read-only, returned by /api/auth/me/ (Plan 01)
StudentRegisterSerializer: validates + creates student accounts (Plan 02)
LecturerRegisterSerializer: validates + creates lecturer accounts (Plan 02)
PendingUserSerializer: read-only pending user list for admin (Plan 02)
"""
from rest_framework import serializers

from .models import CustomUser, UserRole


class AdviserSerializer(serializers.ModelSerializer):
    """Nested adviser info — returned in the student's /me/ response (D-24)."""

    class Meta:
        model = CustomUser
        fields = ['id', 'full_name', 'nidn', 'email']
        read_only_fields = fields


class UserSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for the current user — returned by /api/auth/me/.
    Includes nested adviser info (D-24: student-lecturer relationship set at registration).
    """
    adviser = AdviserSerializer(read_only=True)

    class Meta:
        model = CustomUser
        fields = [
            'id',
            'email',
            'full_name',
            'role',
            'nim',
            'nidn',
            'is_approved',
            'is_active',
            'created_at',
            'adviser',
        ]
        read_only_fields = fields


class StudentRegisterSerializer(serializers.Serializer):
    """
    Validates and creates a student account.

    - Forces role=student regardless of payload (T-1-06)
    - Sets is_approved=False (D-20)
    - Validates NIM uniqueness with exact UI-SPEC error copy
    - Validates email uniqueness with exact UI-SPEC error copy
    - Validates adviser_id is an approved lecturer (Pitfall 7 / D-24)
    """

    nim = serializers.CharField(max_length=20)
    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    adviser_id = serializers.IntegerField()

    def validate_nim(self, value):
        if CustomUser.objects.filter(nim=value).exists():
            raise serializers.ValidationError(
                'NIM ini sudah terdaftar. Coba masuk atau gunakan NIM lain.'
            )
        return value

    def validate_email(self, value):
        if CustomUser.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                'Email ini sudah terdaftar. Coba masuk atau gunakan email lain.'
            )
        return value

    def validate_adviser_id(self, value):
        """Adviser must be an approved lecturer (Pitfall 7 / D-24)."""
        try:
            adviser = CustomUser.objects.get(pk=value)
        except CustomUser.DoesNotExist:
            raise serializers.ValidationError('Dosen pembimbing tidak ditemukan.')
        if adviser.role != UserRole.LECTURER:
            raise serializers.ValidationError(
                'Pilihan dosen pembimbing tidak valid. Pilih dosen yang terdaftar.'
            )
        if not adviser.is_approved:
            raise serializers.ValidationError(
                'Dosen pembimbing yang dipilih belum disetujui oleh admin.'
            )
        return value

    def create(self, validated_data):
        adviser_id = validated_data.pop('adviser_id')
        adviser = CustomUser.objects.get(pk=adviser_id)
        user = CustomUser.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            full_name=validated_data['full_name'],
            role=UserRole.STUDENT,  # Forced — T-1-06
            nim=validated_data['nim'],
            is_approved=False,       # D-20
            adviser=adviser,
        )
        return user


class LecturerRegisterSerializer(serializers.Serializer):
    """
    Validates and creates a lecturer account.

    - Forces role=lecturer regardless of payload (T-1-06)
    - Sets is_approved=False (D-20)
    - Validates NIDN uniqueness
    - Validates email uniqueness with exact UI-SPEC error copy
    """

    nidn = serializers.CharField(max_length=20)
    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)

    def validate_email(self, value):
        if CustomUser.objects.filter(email=value).exists():
            raise serializers.ValidationError(
                'Email ini sudah terdaftar. Coba masuk atau gunakan email lain.'
            )
        return value

    def validate_nidn(self, value):
        if CustomUser.objects.filter(nidn=value).exists():
            raise serializers.ValidationError(
                'NIDN ini sudah terdaftar. Coba masuk atau gunakan NIDN lain.'
            )
        return value

    def create(self, validated_data):
        user = CustomUser.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            full_name=validated_data['full_name'],
            role=UserRole.LECTURER,  # Forced — T-1-06
            nidn=validated_data['nidn'],
            is_approved=False,        # D-20
        )
        return user


class LecturerListSerializer(serializers.ModelSerializer):
    """Minimal serializer for the approved-lecturer dropdown."""

    class Meta:
        model = CustomUser
        fields = ['id', 'full_name', 'nidn', 'email']
        read_only_fields = fields


class PendingUserSerializer(serializers.ModelSerializer):
    """Serializer for the admin pending-users queue (S-11)."""

    class Meta:
        model = CustomUser
        fields = [
            'id',
            'full_name',
            'email',
            'role',
            'nim',
            'nidn',
            'is_approved',
            'created_at',
        ]
        read_only_fields = fields
