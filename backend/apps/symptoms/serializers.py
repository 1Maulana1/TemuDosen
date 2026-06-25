"""
Serializers for the SymptomCategory model.

SymptomCategorySerializer: full model fields (id, name, duration_minutes, is_active).
BulkUpdateItemSerializer: validates a single item in a bulk-update payload.
"""
from rest_framework import serializers

from .models import SymptomCategory


class SymptomCategorySerializer(serializers.ModelSerializer):
    """Full serializer for SymptomCategory — used for list, create, retrieve, update."""

    class Meta:
        model = SymptomCategory
        fields = ['id', 'name', 'duration_minutes', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_duration_minutes(self, value):
        """Ensure duration is a positive integer (D-04, T-1-12)."""
        if value <= 0:
            raise serializers.ValidationError(
                'Durasi harus berupa bilangan bulat positif (dalam menit).'
            )
        return value


class BulkUpdateItemSerializer(serializers.Serializer):
    """Serializer for a single item in a bulk-update request."""

    id = serializers.IntegerField()
    name = serializers.CharField(max_length=255, required=False)
    duration_minutes = serializers.IntegerField(required=False)
    is_active = serializers.BooleanField(required=False)

    def validate_duration_minutes(self, value):
        """duration_minutes must be positive if provided (D-04, T-1-12)."""
        if value is not None and value <= 0:
            raise serializers.ValidationError(
                'Durasi harus berupa bilangan bulat positif (dalam menit).'
            )
        return value
