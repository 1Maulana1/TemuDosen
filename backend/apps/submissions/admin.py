"""Admin registration for Submission models — implemented in Plan 04."""
from django.contrib import admin

from .models import Submission, SubmissionFile


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ['id', 'student', 'status', 'created_at']
    list_filter = ['status']


@admin.register(SubmissionFile)
class SubmissionFileAdmin(admin.ModelAdmin):
    list_display = ['id', 'submission', 'original_filename', 'file_size', 'uploaded_at']
