"""Admin registration for Submission models — Plan 04."""
from django.contrib import admin

from .models import Submission, SubmissionFile


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ['id', 'student', 'status', 'created_at', 'updated_at']
    list_filter = ['status']
    search_fields = ['student__email', 'student__full_name', 'student__nim']
    filter_horizontal = ['symptoms']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(SubmissionFile)
class SubmissionFileAdmin(admin.ModelAdmin):
    list_display = ['id', 'submission', 'original_filename', 'file_size', 'uuid', 'uploaded_at']
    search_fields = ['original_filename', 'submission__student__email']
    readonly_fields = ['uuid', 'uploaded_at']
