"""
Serializers for Phase 2 — approve/reject, queue display.
"""
from rest_framework import serializers

from apps.submissions.models import Submission
from .models import Session


# ── Approve ────────────────────────────────────────────────────────────────────

class ApproveSubmissionSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=[('offline', 'Offline'), ('online', 'Online')])
    meeting_link = serializers.URLField(required=False, allow_null=True, allow_blank=True)

    def validate(self, attrs):
        if attrs['method'] == 'online' and not attrs.get('meeting_link'):
            raise serializers.ValidationError(
                {'meeting_link': 'Link meeting wajib diisi jika metode Online.'}
            )
        return attrs


# ── Reject / Revisi ────────────────────────────────────────────────────────────

class RejectSubmissionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=[('REJECTED', 'Tolak'), ('REVISION', 'Revisi')])
    reason = serializers.CharField(min_length=10)

    def validate_reason(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError('Alasan minimal 10 karakter.')
        return value.strip()


# ── Session detail for approve response ───────────────────────────────────────

class SessionDetailSerializer(serializers.ModelSerializer):
    queue_position = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = [
            'id', 'status', 'method', 'meeting_link',
            'estimated_minutes', 'scheduled_at', 'queue_position',
            'google_event_id', 'notification_sent',
        ]

    def get_queue_position(self, obj):
        if not obj.scheduled_at:
            return None
        dosen = obj.submission.student.adviser
        if not dosen:
            return 1
        count = Session.objects.filter(
            submission__student__adviser=dosen,
            status=Session.Status.WAITING,
            scheduled_at__lt=obj.scheduled_at,
        ).count()
        return count + 1


# ── Queue display serializers ──────────────────────────────────────────────────

class StudentQueueSerializer(serializers.ModelSerializer):
    queue_position = serializers.SerializerMethodField()
    estimated_wait_minutes = serializers.SerializerMethodField()
    dosen_name = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = [
            'id', 'status', 'queue_position', 'estimated_wait_minutes',
            'scheduled_at', 'dosen_name', 'method', 'meeting_link',
            'notification_sent',
        ]

    def get_queue_position(self, obj):
        dosen = obj.submission.student.adviser
        if not dosen or not obj.scheduled_at:
            return 1
        count = Session.objects.filter(
            submission__student__adviser=dosen,
            status=Session.Status.WAITING,
            scheduled_at__lt=obj.scheduled_at,
        ).count()
        return count + 1

    def get_estimated_wait_minutes(self, obj):
        from django.utils import timezone
        if not obj.scheduled_at:
            return 0
        diff = obj.scheduled_at - timezone.now()
        minutes = int(diff.total_seconds() / 60)
        return max(0, minutes)

    def get_dosen_name(self, obj):
        dosen = obj.submission.student.adviser
        return dosen.full_name if dosen else ''


class LecturerQueueItemSerializer(serializers.ModelSerializer):
    position = serializers.SerializerMethodField()
    mahasiswa_name = serializers.CharField(source='submission.student.full_name', read_only=True)
    nim = serializers.CharField(source='submission.student.nim', read_only=True)
    symptom_name = serializers.SerializerMethodField()

    class Meta:
        model = Session
        fields = [
            'position', 'id', 'mahasiswa_name', 'nim',
            'symptom_name', 'estimated_minutes', 'scheduled_at',
            'status', 'method', 'meeting_link',
        ]

    def get_position(self, obj):
        # Position relative to other WAITING sessions for this dosen
        dosen = obj.submission.student.adviser
        if not dosen or not obj.scheduled_at:
            return 1
        count = Session.objects.filter(
            submission__student__adviser=dosen,
            status=Session.Status.WAITING,
            scheduled_at__lt=obj.scheduled_at,
        ).count()
        return count + 1

    def get_symptom_name(self, obj):
        symptoms = obj.submission.symptoms.all()
        return ', '.join(s.name for s in symptoms) if symptoms else ''
