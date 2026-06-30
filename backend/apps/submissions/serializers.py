"""
Submission serializers — Plan 04 (student) + Plan 05 (lecturer).

SubmissionCreateSerializer:
  - symptom_ids: ListField (min_length=1) — required, >=1 symptom
  - description: CharField optional, max 500 chars
  - draft_file: FileField — validated for 5MB limit and PDF magic bytes
  - Validates BEFORE writing any file to disk (RESEARCH Pitfall 6 / D-29)
  - Uses python-magic for magic-bytes check (RESEARCH Pattern 4 / Pitfall 5)
  - Exact Bahasa Indonesia error copy from UI-SPEC Copywriting Contract

SubmissionListSerializer:
  - For student dashboard (S-06): exposes id, status, symptom names, created_at, file_uuid

LecturerSubmissionSerializer (Plan 05):
  - For lecturer dashboard (S-08): exposes D-10 columns
  - student_nim, student_name, symptom_names, status, created_at,
    original_filename, file_url pointing at /api/files/<uuid>/ (NOT a media path)
"""
import os
import uuid as _uuid

try:
    import magic as libmagic  # python-magic (python-magic-bin on Windows dev)
    _MAGIC_AVAILABLE = True
except (ImportError, OSError):
    # Fallback: skip magic-bytes check in dev if libmagic DLL not available.
    # PRODUCTION must have libmagic installed — document in README.
    _MAGIC_AVAILABLE = False

from django.conf import settings
from django.core.validators import FileExtensionValidator
from rest_framework import serializers

from .models import Submission, SubmissionFile
from apps.symptoms.models import SymptomCategory


# ── Create Serializer ──────────────────────────────────────────────────────────

class SubmissionCreateSerializer(serializers.Serializer):
    """
    Validates and creates a Submission + SubmissionFile.

    Validation order (all server-authoritative per Architectural Responsibility Map):
      1. symptom_ids: min_length=1 (TRIAGE-02 / UI-SPEC error copy)
      2. draft_file: required (TRIAGE-02)
      3. draft_file: <=5MB (D-13 / RESEARCH Pitfall 6)
      4. draft_file: magic-bytes must be application/pdf (D-13 / RESEARCH Pitfall 5)

    CRITICAL: file is NOT written to disk until ALL validations pass.
    """

    symptom_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        error_messages={
            'min_length': 'Pilih minimal satu gejala akademik.',
            'required': 'Pilih minimal satu gejala akademik.',
        },
    )
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
    )
    draft_file = serializers.FileField(
        required=True,
        error_messages={
            'required': 'Unggah file PDF draft sebelum melanjutkan.',
            # When the field is sent as null (not just absent), DRF uses the 'null'
            # code — keep the same student-facing copy instead of the generic message.
            'null': 'Unggah file PDF draft sebelum melanjutkan.',
        },
        validators=[FileExtensionValidator(allowed_extensions=['pdf'])],
    )

    def validate_symptom_ids(self, value):
        """Validate that at least one symptom_id is provided and all IDs exist."""
        if not value:
            raise serializers.ValidationError('Pilih minimal satu gejala akademik.')
        # Verify all symptom IDs exist in DB
        existing_ids = set(
            SymptomCategory.objects.filter(id__in=value).values_list('id', flat=True)
        )
        missing = set(value) - existing_ids
        if missing:
            raise serializers.ValidationError(
                f'Gejala tidak ditemukan: {sorted(missing)}'
            )
        return value

    def validate_draft_file(self, file):
        """
        Validate file size (<=5MB) and MIME type (application/pdf via magic bytes).
        MUST validate BEFORE any write to disk.
        """
        # Size check: 5MB limit (D-13)
        max_size = 5 * 1024 * 1024
        if file.size > max_size:
            raise serializers.ValidationError(
                'Ukuran file melebihi batas 5MB. Pilih file yang lebih kecil.'
            )

        # Magic-bytes MIME check (RESEARCH Pattern 4 / Pitfall 5)
        # Read first 1024 bytes for magic detection; then seek back to 0
        file_head = file.read(1024)
        file.seek(0)

        if _MAGIC_AVAILABLE:
            mime = libmagic.from_buffer(file_head, mime=True)
            if mime != 'application/pdf':
                raise serializers.ValidationError('Hanya file PDF yang diizinkan.')
        else:
            # Fallback: check PDF magic bytes manually (%PDF-)
            if not file_head.startswith(b'%PDF-'):
                raise serializers.ValidationError('Hanya file PDF yang diizinkan.')

        return file

    def save_file(self, file) -> tuple:
        """
        Write file to disk with UUID name under MEDIA_ROOT.
        Returns (file_uuid_str, original_filename, absolute_file_path).

        Called ONLY after all validation passes.
        """
        file_uuid = _uuid.uuid4()
        media_root = settings.MEDIA_ROOT
        os.makedirs(media_root, exist_ok=True)
        file_path = os.path.join(media_root, f'{file_uuid}.pdf')

        file.seek(0)
        with open(file_path, 'wb+') as destination:
            for chunk in file.chunks():
                destination.write(chunk)

        return str(file_uuid), file.name, file_path

    def create(self, validated_data):
        """Create Submission + SubmissionFile after validation passes."""
        student = self.context['request'].user
        symptom_ids = validated_data['symptom_ids']
        description = validated_data.get('description', '')
        file = validated_data['draft_file']

        # Save file to disk AFTER validation
        file_uuid_str, original_filename, file_path = self.save_file(file)

        # Create Submission
        submission = Submission.objects.create(
            student=student,
            description=description,
            status=Submission.Status.PENDING,
        )
        submission.symptoms.set(symptom_ids)

        # Create SubmissionFile
        SubmissionFile.objects.create(
            submission=submission,
            uuid=_uuid.UUID(file_uuid_str),
            original_filename=original_filename,
            file_path=file_path,
            file_size=file.size,
        )

        return submission


# ── List Serializer ────────────────────────────────────────────────────────────

class SubmissionFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubmissionFile
        fields = ['uuid', 'original_filename', 'file_size', 'uploaded_at']


class SubmissionListSerializer(serializers.ModelSerializer):
    """
    Serializer for the student's own submission list (dashboard S-06).
    Exposes id, status, symptom names, created_at, and the file UUID for preview.
    """
    symptoms = serializers.SerializerMethodField()
    file_uuid = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = [
            'id', 'status', 'description',
            'symptoms', 'file_uuid', 'file_name',
            'rejection_reason',  # Phase 2 SC1: student must see lecturer's reject/revision note
            'created_at', 'updated_at',
        ]

    def get_symptoms(self, obj):
        return [
            {'id': s.id, 'name': s.name, 'duration_minutes': s.duration_minutes}
            for s in obj.symptoms.all()
        ]

    def get_file_uuid(self, obj):
        if hasattr(obj, 'file') and obj.file:
            return str(obj.file.uuid)
        return None

    def get_file_name(self, obj):
        if hasattr(obj, 'file') and obj.file:
            return obj.file.original_filename
        return None


# ── Lecturer Serializer (Plan 05 — REVIEW-01, D-10) ───────────────────────────

class LecturerSubmissionSerializer(serializers.ModelSerializer):
    """
    Serializer for the lecturer's advisee submission list (dashboard S-08).

    D-10 columns:
      - student_nim: student's NIM
      - student_name: student's full name
      - symptom_names: list of symptom category names
      - status: submission status (pending/approved/rejected/revision)
      - created_at: submission creation datetime
      - original_filename: uploaded PDF filename
      - file_url: /api/files/<uuid>/ — protected route (D-29), NOT a media path

    T-1-23 mitigation: file_url always points at the ownership-checked /api/files/<uuid>/
    endpoint — never a direct MEDIA_URL path. The file endpoint re-checks auth (Plan 04).
    """
    student_nim = serializers.CharField(source='student.nim', read_only=True)
    student_name = serializers.CharField(source='student.full_name', read_only=True)
    symptom_names = serializers.SerializerMethodField()
    original_filename = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = [
            'id',
            'student_nim',
            'student_name',
            'symptom_names',
            'status',
            'created_at',
            'original_filename',
            'file_url',
        ]

    def get_symptom_names(self, obj):
        """Return list of symptom category name strings."""
        return [s.name for s in obj.symptoms.all()]

    def get_original_filename(self, obj):
        """Return the original PDF filename from the associated SubmissionFile."""
        try:
            return obj.file.original_filename
        except SubmissionFile.DoesNotExist:
            return None

    def get_file_url(self, obj):
        """
        Return the protected file URL: /api/files/<uuid>/ (D-29 compliant).

        CRITICAL: This must NEVER return a MEDIA_URL path (T-1-23).
        The /api/files/<uuid>/ endpoint enforces ownership auth (Plan 04).
        """
        try:
            return f'/api/files/{obj.file.uuid}/'
        except SubmissionFile.DoesNotExist:
            return None
