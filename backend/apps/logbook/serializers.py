"""
Serializers for Phase 6 (06-04) — lecturer/student logbook read views + the
approve/manual-notes write endpoints.
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


class ApproveLogbookSerializer(serializers.Serializer):
    """STT-04 — lecturer's edited summary, committed on approve."""
    summary_edited = serializers.JSONField()


class ManualNotesSerializer(serializers.Serializer):
    """STT-07 — manual-notes fallback when STT/LLM failed."""
    notes = serializers.CharField(allow_blank=False)
