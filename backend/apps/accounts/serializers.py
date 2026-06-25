"""
Account serializers.
"""
from rest_framework import serializers

from .models import CustomUser


class UserSerializer(serializers.ModelSerializer):
    """Read-only serializer for the current user — returned by /api/auth/me/."""

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
        ]
        read_only_fields = fields
