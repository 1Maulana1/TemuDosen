"""Admin registration for SymptomCategory — implemented in Plan 03."""
from django.contrib import admin

from .models import SymptomCategory


@admin.register(SymptomCategory)
class SymptomCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'duration_minutes', 'is_active', 'created_at']
    list_filter = ['is_active']
    search_fields = ['name']
