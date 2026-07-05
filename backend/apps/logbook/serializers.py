"""
Phase 6 (06-04): DRF serializers over SessionLogbook.

Menggantikan SessionHistorySerializer / SessionSummaryDetailSerializer lama yang
membaca Session.summary (teks polos). Sumber kebenaran ringkasan kini SessionLogbook.
"""
from rest_framework import serializers

from .models import SessionLogbook


class LogbookListSerializer(serializers.ModelSerializer):
    """Baris ringkas daftar logbook (dosen & mahasiswa) — menggantikan has_summary."""
    session_id = serializers.IntegerField(source='session.id', read_only=True)
    mahasiswa_name = serializers.CharField(
        source='session.submission.student.full_name', read_only=True)
    nim = serializers.CharField(source='session.submission.student.nim', read_only=True)
    dosen_name = serializers.SerializerMethodField()
    symptom_name = serializers.SerializerMethodField()
    scheduled_at = serializers.DateTimeField(source='session.scheduled_at', read_only=True)
    ts2 = serializers.DateTimeField(source='session.ts2', read_only=True)
    has_recording = serializers.SerializerMethodField()

    class Meta:
        model = SessionLogbook
        fields = [
            'session_id', 'scheduled_at', 'ts2', 'mahasiswa_name', 'nim', 'dosen_name',
            'symptom_name', 'status', 'is_manual', 'has_recording', 'approved_at',
        ]

    def get_dosen_name(self, obj):
        dosen = obj.session.submission.student.adviser
        return dosen.full_name if dosen else ''

    def get_symptom_name(self, obj):
        symptoms = obj.session.submission.symptoms.all()
        return ', '.join(s.name for s in symptoms) if symptoms else ''

    def get_has_recording(self, obj):
        return hasattr(obj.session, 'recording')


class LogbookDetailSerializer(serializers.ModelSerializer):
    """Detail 1 logbook: transkrip + ringkasan (raw & editan) + status."""
    session_id = serializers.IntegerField(source='session.id', read_only=True)
    mahasiswa_name = serializers.CharField(
        source='session.submission.student.full_name', read_only=True)
    nim = serializers.CharField(source='session.submission.student.nim', read_only=True)
    dosen_name = serializers.SerializerMethodField()
    scheduled_at = serializers.DateTimeField(source='session.scheduled_at', read_only=True)
    ts1 = serializers.DateTimeField(source='session.ts1', read_only=True)
    ts2 = serializers.DateTimeField(source='session.ts2', read_only=True)
    has_recording = serializers.SerializerMethodField()

    class Meta:
        model = SessionLogbook
        fields = [
            'session_id', 'mahasiswa_name', 'nim', 'dosen_name', 'scheduled_at', 'ts1',
            'ts2', 'has_recording', 'status', 'is_manual', 'transcript',
            'summary_raw', 'summary_edited', 'approved_at',
        ]

    def get_dosen_name(self, obj):
        dosen = obj.session.submission.student.adviser
        return dosen.full_name if dosen else ''

    def get_has_recording(self, obj):
        return hasattr(obj.session, 'recording')


class ApproveLogbookSerializer(serializers.Serializer):
    """Payload approve: JSON ringkasan hasil editan dosen (D-06 ready_for_review→approved)."""
    summary_edited = serializers.JSONField()


class ManualNotesSerializer(serializers.Serializer):
    """Payload fallback manual (STT-07): catatan bebas dosen saat pipeline gagal/mati."""
    notes = serializers.CharField(allow_blank=False, trim_whitespace=True)
