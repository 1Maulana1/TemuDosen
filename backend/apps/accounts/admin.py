"""Django admin registration for CustomUser."""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import CustomUser


@admin.register(CustomUser)
class CustomUserAdmin(BaseUserAdmin):
    ordering = ['email']
    list_display = ['email', 'full_name', 'role', 'is_approved', 'is_staff', 'created_at']
    list_filter = ['role', 'is_approved', 'is_staff', 'is_active']
    search_fields = ['email', 'full_name', 'nim', 'nidn']

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('full_name', 'role', 'nim', 'nidn', 'adviser')}),
        ('Status', {'fields': ('is_approved', 'is_active', 'is_staff', 'is_superuser')}),
        ('Phase 4 (Google Calendar)', {'fields': ('google_oauth_token',), 'classes': ('collapse',)}),
        ('Permissions', {'fields': ('groups', 'user_permissions'), 'classes': ('collapse',)}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'full_name', 'role', 'password1', 'password2'),
        }),
    )
