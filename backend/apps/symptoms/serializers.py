"""
Serializers for the SymptomCategory model.

SymptomCategorySerializer: full model fields (id, name, duration_minutes, is_active).
BulkUpdateItemSerializer: validates a single item in a bulk-update payload.
"""
from rest_framework import serializers

from .models import SymptomCategory


class SymptomCategorySerializer(serializers.ModelSerializer):
    """Full serializer for SymptomCategory — used for list, create, retrieve, update."""

    # FR-AD01: kategori wajib diisi, tidak boleh kosong (model has a default, which
    # would otherwise make DRF treat this field as optional).
    category = serializers.CharField(max_length=100, required=True, allow_blank=False)

    class Meta:
        model = SymptomCategory
        fields = ['id', 'name', 'category', 'duration_minutes', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_name(self, value):
        """FR-AD01: nama wajib, unik (via model constraint), minimal 3 karakter."""
        if len(value.strip()) < 3:
            raise serializers.ValidationError('Nama gejala minimal 3 karakter.')
        return value.strip()

    def validate_duration_minutes(self, value):
        """FR-AD01: estimasi durasi wajib, integer, 15–180 menit."""
        if value < 15 or value > 180:
            raise serializers.ValidationError(
                'Estimasi durasi harus antara 15 dan 180 menit.'
            )
        return value


class BulkUpdateItemSerializer(serializers.Serializer):
    """Serializer for a single item in a bulk-update request."""

    id = serializers.IntegerField()
    name = serializers.CharField(max_length=255, required=False)
    category = serializers.CharField(max_length=100, required=False, allow_blank=False)
    duration_minutes = serializers.IntegerField(required=False)
    is_active = serializers.BooleanField(required=False)

    def validate_name(self, value):
        if value is not None and len(value.strip()) < 3:
            raise serializers.ValidationError('Nama gejala minimal 3 karakter.')
        return value.strip() if value is not None else value

    def validate_duration_minutes(self, value):
        """duration_minutes must be within 15–180 if provided (FR-AD01)."""
        if value is not None and (value < 15 or value > 180):
            raise serializers.ValidationError(
                'Estimasi durasi harus antara 15 dan 180 menit.'
            )
        return value
