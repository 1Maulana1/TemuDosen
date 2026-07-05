"""
Serializers for Phase 6 (06-04) — lecturer/student logbook read views.
"""
from rest_framework import serializers

from .models import SessionLogbook


class LogbookListSerializer(serializers.ModelSerializer):
    """S-12 — lecturer's logbook list: session id, student, date, status."""
    session_id = serializers.IntegerField(source='session.id', read_only=True)
    student_nim = serializers.CharField(source='session.submission.student.nim', read_only=True)
    student_name = serializers.CharField(source='session.submission.student.full_name', read_only=True)
    session_date = serializers.DateTimeField(source='session.ts2', read_only=True)

    class Meta:
        model = SessionLogbook
        fields = [
            'id', 'session_id', 'student_nim', 'student_name',
            'session_date', 'status', 'is_manual',
        ]


class LogbookDetailSerializer(serializers.ModelSerializer):
    """S-13/S-15 — full detail: transcript + both summary variants + source mode."""
    session_id = serializers.IntegerField(source='session.id', read_only=True)
    student_nim = serializers.CharField(source='session.submission.student.nim', read_only=True)
    student_name = serializers.CharField(source='session.submission.student.full_name', read_only=True)
    session_date = serializers.DateTimeField(source='session.ts2', read_only=True)

    class Meta:
        model = SessionLogbook
        fields = [
            'id', 'session_id', 'student_nim', 'student_name', 'session_date',
            'status', 'is_manual', 'source_mode', 'transcript',
            'summary_raw', 'summary_edited', 'approved_at',
        ]
