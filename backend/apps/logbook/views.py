"""
Phase 6 (06-04): DRF views over SessionLogbook.

Menggantikan SessionSummaryView di apps/bimbingan/views.py. Menerapkan disiplin
akses proyek yang sama: urutan 404 -> 403 -> 400, ownership via
session.submission.student.adviser, dan state-guard di server (jangan percaya klien).
"""
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdmin, IsApprovedUser, IsLecturer, IsStudent
from apps.bimbingan.models import ActionItem, SystemLog
from apps.bimbingan.services.notification import notify_student

from .models import SessionLogbook
from .serializers import (
    ApproveLogbookSerializer,
    LogbookDetailSerializer,
    LogbookListSerializer,
    ManualNotesSerializer,
    StudentLogbookDetailSerializer,
)


def _get_logbook_or_404(session_id):
    return (
        SessionLogbook.objects
        .select_related('session__submission__student__adviser', 'session__recording')
        .filter(session_id=session_id)
        .first()
    )


def _create_action_items_from_summary(session, summary):
    """Phase 6->7 handoff (STT-05): split an approved summary's structured
    advice/improvement items into ActionItem rows so Phase 7's advice-tracking
    (student follow-up marking, KetuaJurusanComplianceView) has real data to
    work with — previously nothing ever created an ActionItem from a logbook
    approval, despite 06-BREAKDOWN.md calling for exactly this.

    Defensive by design: `summary` is an arbitrary client-supplied JSON blob
    (ApproveLogbookSerializer only requires it to be valid JSON, not a
    specific shape), so a malformed/partial payload just yields fewer items —
    it never raises and never blocks the approval itself.
    """
    if not isinstance(summary, dict):
        return
    for point in summary.get('advice_points') or []:
        if not isinstance(point, dict):
            continue
        topic = (point.get('topic') or '').strip()
        detail = (point.get('detail') or '').strip()
        if not detail:
            continue
        ActionItem.objects.create(
            session=session,
            description=f'{topic}: {detail}' if topic else detail,
        )
    for note in summary.get('improvement_notes') or []:
        if not isinstance(note, dict):
            continue
        area = (note.get('area') or '').strip()
        action = (note.get('action') or '').strip()
        if not action:
            continue
        ActionItem.objects.create(
            session=session,
            description=f'{area}: {action}' if area else action,
        )


class LecturerLogbookListView(APIView):
    """GET /api/logbook/lecturer/ — daftar logbook mahasiswa bimbingan (advisee-scoped)."""
    permission_classes = [IsLecturer]

    def get(self, request):
        qs = (
            SessionLogbook.objects
            .filter(session__submission__student__adviser=request.user)
            .select_related('session__submission__student__adviser')
            .order_by('-created_at')[:100]  # S2: cap, pola sama dgn history [:50]
        )
        return Response(LogbookListSerializer(qs, many=True).data)


class LecturerLogbookDetailView(APIView):
    """GET /api/logbook/<session_id>/ — detail 1 logbook milik dosen pembimbing."""
    permission_classes = [IsLecturer]

    def get(self, request, session_id):
        logbook = _get_logbook_or_404(session_id)
        if logbook is None:
            return Response({'detail': 'Logbook tidak ditemukan.'},
                            status=status.HTTP_404_NOT_FOUND)
        if logbook.session.submission.student.adviser != request.user:
            return Response({'detail': 'Anda tidak memiliki izin.'},
                            status=status.HTTP_403_FORBIDDEN)
        return Response(LogbookDetailSerializer(logbook).data)


class ApproveLogbookView(APIView):
    """POST /api/logbook/<session_id>/approve/ — simpan ringkasan editan + setujui."""
    permission_classes = [IsLecturer]

    def post(self, request, session_id):
        logbook = _get_logbook_or_404(session_id)
        if logbook is None:
            return Response({'detail': 'Logbook tidak ditemukan.'},
                            status=status.HTTP_404_NOT_FOUND)
        if logbook.session.submission.student.adviser != request.user:
            return Response({'detail': 'Hanya dosen pembimbing yang dapat menyetujui.'},
                            status=status.HTTP_403_FORBIDDEN)
        if logbook.status != SessionLogbook.Status.READY_FOR_REVIEW:
            return Response(
                {'detail': 'Hanya logbook berstatus "Menunggu Tinjauan" yang dapat disetujui.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ApproveLogbookSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        logbook.summary_edited = serializer.validated_data['summary_edited']
        logbook.status = SessionLogbook.Status.APPROVED
        logbook.approved_at = timezone.now()
        logbook.approved_by = request.user
        logbook.save(update_fields=[
            'summary_edited', 'status', 'approved_at', 'approved_by', 'updated_at'])
        _create_action_items_from_summary(logbook.session, logbook.summary_edited)

        # Phase 7 SC3: sinkron ke logbook kampus (Sekawan/KPTI). Graceful — bila
        # nonaktif/gagal, approve tetap sukses; kegagalan tercatat & di-retry.
        from apps.logbook.services.campus_logbook import sync_logbook
        sync_logbook(logbook)

        notify_student(
            logbook.session.submission.student,
            'Ringkasan hasil bimbingan Anda sudah tersedia.',
            session=logbook.session,
            event_type='SUMMARY_APPROVED',
        )
        return Response(LogbookDetailSerializer(logbook).data)


class RejectLogbookView(APIView):
    """POST /api/logbook/<session_id>/reject/ — tolak draf AI, alihkan ke jalur manual.

    Gate tambahan (STT-04): dosen bisa menolak ringkasan AI yang meragukan alih-alih
    dipaksa menyetujuinya. Menandai FAILED sehingga ManualNotesView menerimanya
    seperti pipeline yang gagal — tidak ada field/status baru yang perlu ditambahkan.
    """
    permission_classes = [IsLecturer]

    def post(self, request, session_id):
        logbook = _get_logbook_or_404(session_id)
        if logbook is None:
            return Response({'detail': 'Logbook tidak ditemukan.'},
                            status=status.HTTP_404_NOT_FOUND)
        if logbook.session.submission.student.adviser != request.user:
            return Response({'detail': 'Hanya dosen pembimbing yang dapat menolak.'},
                            status=status.HTTP_403_FORBIDDEN)
        if logbook.status != SessionLogbook.Status.READY_FOR_REVIEW:
            return Response(
                {'detail': 'Hanya logbook berstatus "Menunggu Tinjauan" yang dapat ditolak.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        logbook.status = SessionLogbook.Status.FAILED
        logbook.save(update_fields=['status', 'updated_at'])

        SystemLog.objects.create(
            level=SystemLog.Level.INFO,
            event_type='LOGBOOK_REJECTED',
            message=f'Dosen {request.user.email} menolak draf ringkasan AI logbook #{logbook.id}',
            context={'logbook_id': logbook.id, 'session_id': session_id},
        )
        return Response(LogbookDetailSerializer(logbook).data)


class ManualNotesView(APIView):
    """POST /api/logbook/<session_id>/manual-notes/ — fallback manual (STT-07)."""
    permission_classes = [IsLecturer]

    def post(self, request, session_id):
        logbook = _get_logbook_or_404(session_id)
        if logbook is None:
            return Response({'detail': 'Logbook tidak ditemukan.'},
                            status=status.HTTP_404_NOT_FOUND)
        if logbook.session.submission.student.adviser != request.user:
            return Response({'detail': 'Hanya dosen pembimbing yang dapat mengisi catatan.'},
                            status=status.HTTP_403_FORBIDDEN)
        # Catatan manual hanya untuk logbook yang pipeline-nya gagal / belum jalan.
        if logbook.status not in (
            SessionLogbook.Status.FAILED, SessionLogbook.Status.PENDING,
        ):
            return Response(
                {'detail': 'Catatan manual hanya untuk logbook yang gagal/menunggu.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ManualNotesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Catatan bebas disimpan sebagai bentuk terstruktur minimal agar UI seragam.
        logbook.summary_edited = {'manual_notes': serializer.validated_data['notes']}
        logbook.is_manual = True
        logbook.status = SessionLogbook.Status.APPROVED
        logbook.approved_at = timezone.now()
        logbook.approved_by = request.user
        logbook.save(update_fields=[
            'summary_edited', 'is_manual', 'status',
            'approved_at', 'approved_by', 'updated_at'])

        notify_student(
            logbook.session.submission.student,
            'Ringkasan hasil bimbingan Anda sudah tersedia.',
            session=logbook.session,
            event_type='SUMMARY_APPROVED',
        )
        return Response(LogbookDetailSerializer(logbook).data)


class StudentLogbookListView(APIView):
    """GET /api/logbook/student/ — daftar logbook milik mahasiswa yang sudah disetujui.

    Endpoint ini TIDAK ada di plan tim lain (mereka hanya punya detail mahasiswa);
    ditambahkan agar StudentHistory.tsx punya sumber daftar. (Celah D di MERGE-PLAN.)
    """
    permission_classes = [IsStudent]

    def get(self, request):
        qs = (
            SessionLogbook.objects
            .filter(session__submission__student=request.user,
                    status=SessionLogbook.Status.APPROVED)
            .select_related('session__submission__student__adviser')
            .order_by('-created_at')[:100]  # S2: cap, pola sama dgn history [:50]
        )
        return Response(LogbookListSerializer(qs, many=True).data)


class StudentLogbookView(APIView):
    """GET /api/logbook/student/<session_id>/ — hanya logbook milik sendiri & sudah approved."""
    permission_classes = [IsStudent]

    def get(self, request, session_id):
        logbook = _get_logbook_or_404(session_id)
        # Jangan bocorkan keberadaan: bukan milik sendiri -> 404.
        if logbook is None or logbook.session.submission.student != request.user:
            return Response({'detail': 'Logbook tidak ditemukan.'},
                            status=status.HTTP_404_NOT_FOUND)
        # Milik sendiri tapi belum disetujui -> 403 (konten tak pernah bocor, STT-06).
        if logbook.status != SessionLogbook.Status.APPROVED:
            return Response({'detail': 'Ringkasan belum tersedia.'},
                            status=status.HTTP_403_FORBIDDEN)
        return Response(StudentLogbookDetailSerializer(logbook).data)


class LogbookExportView(APIView):
    """GET /api/logbook/<session_id>/export/?format=csv|pdf — SC4 (LOGBOOK-02).

    Ekspor ringkasan yang disetujui — dosen pembimbing sesi ATAU mahasiswa
    pemilik sesi. Isinya sama persis dengan payload yang akan dikirim ke API
    kampus (build_payload), ditambah transkrip AI bila ada — jadi yang
    diunggah manual == yang mesin kirim.
    """
    permission_classes = [IsApprovedUser]

    def perform_content_negotiation(self, request, force=False):
        # `?format=csv|pdf` adalah query domain (format ekspor), bukan URL_FORMAT
        # DRF; paksa negosiasi JSON agar DRF tak 404 pada 'csv'/'pdf'.
        from rest_framework.renderers import JSONRenderer
        return (JSONRenderer(), 'application/json')

    def get(self, request, session_id):
        logbook = _get_logbook_or_404(session_id)
        if logbook is None:
            return Response({'detail': 'Logbook tidak ditemukan.'},
                            status=status.HTTP_404_NOT_FOUND)

        student = logbook.session.submission.student
        is_owning_lecturer = request.user.role == 'lecturer' and student.adviser == request.user
        is_owning_student = request.user.role == 'student' and student == request.user
        if not (is_owning_lecturer or is_owning_student):
            return Response(
                {'detail': 'Hanya dosen pembimbing atau mahasiswa pemilik sesi yang dapat mengekspor.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if logbook.status != SessionLogbook.Status.APPROVED:
            return Response({'detail': 'Hanya ringkasan yang sudah disetujui yang dapat diekspor.'},
                            status=status.HTTP_400_BAD_REQUEST)

        from apps.logbook.services.campus_logbook import build_payload
        payload = build_payload(logbook)
        export_format = (request.query_params.get('format') or 'csv').lower()
        filename_base = f'Logbook_Sesi_{session_id}'

        if export_format == 'pdf':
            return self._render_pdf(payload, filename_base, logbook.transcript)
        return self._render_csv(payload, filename_base, logbook.transcript)

    @staticmethod
    def _fmt_tanggal(iso):
        """U2: tampilkan tanggal terbaca manusia di ekspor (payload API tetap ISO)."""
        if not iso:
            return '-'
        try:
            from datetime import datetime
            from django.utils import timezone as djtz
            dt = datetime.fromisoformat(iso)
            if djtz.is_aware(dt):
                dt = djtz.localtime(dt)
            return dt.strftime('%d-%m-%Y %H:%M WIB')
        except (ValueError, TypeError):
            return iso

    def _rows(self, payload, transcript=''):
        rows = [
            ('NIM', payload.get('nim') or '-'),
            ('NIDN', payload.get('nidn') or '-'),
            ('Tanggal', self._fmt_tanggal(payload.get('tanggal'))),
            ('Topik', payload.get('topik') or '-'),
            ('Durasi (menit)', str(payload.get('durasi_menit') or 0)),
            ('Ringkasan', payload.get('ringkasan') or '-'),
            ('Saran', '\n'.join(payload.get('saran') or []) or '-'),
        ]
        # Transkrip mentah hasil STT (di luar kontrak API kampus build_payload) —
        # disertakan hanya di ekspor CSV/PDF sebagai lampiran referensi dosen/mahasiswa.
        if transcript:
            rows.append(('Transkrip Rekaman (AI)', transcript))
        return rows

    def _render_csv(self, payload, filename_base, transcript=''):
        import csv
        from django.http import HttpResponse

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename_base}.csv"'
        response.write('﻿')  # BOM UTF-8 untuk Excel
        from apps.bimbingan.views import _csv_safe  # neutralize CSV injection (S1)
        writer = csv.writer(response)
        writer.writerow(['Field', 'Nilai'])
        writer.writerows([[_csv_safe(c) for c in row] for row in self._rows(payload, transcript)])
        return response

    def _render_pdf(self, payload, filename_base, transcript=''):
        from django.http import HttpResponse
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import A4
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
            from reportlab.lib.styles import getSampleStyleSheet
            import io

            from xml.sax.saxutils import escape as _xml_escape

            styles = getSampleStyleSheet()
            buf = io.BytesIO()
            doc = SimpleDocTemplate(buf, pagesize=A4)
            title = Paragraph('Ringkasan Bimbingan — Logbook', styles['Title'])
            table_data = [['Field', 'Nilai']] + [
                [k, Paragraph(_xml_escape(str(v)).replace('\n', '<br/>'), styles['BodyText'])]
                for k, v in self._rows(payload, transcript)
            ]
            table = Table(table_data, colWidths=[110, 370], repeatRows=1)
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1D4ED8')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            doc.build([title, table])
            pdf_bytes = buf.getvalue()
            buf.close()

            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{filename_base}.pdf"'
            return response
        except Exception as e:
            SystemLog.objects.create(
                level=SystemLog.Level.ERROR,
                event_type='CAMPUS_LOGBOOK_ERROR',
                message=f'Gagal membuat ekspor PDF logbook: {e}',
                context={'filename': filename_base},
            )
            return Response(
                {'detail': 'Gagal membuat ekspor PDF. Coba gunakan format CSV.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class CampusLogbookConfigView(APIView):
    """GET/PUT /api/admin/campus-logbook/ — SC6 (ADMIN-04).

    Admin membaca & mengatur kredensial + setelan integrasi logbook kampus saat
    runtime. Token tidak pernah dikembalikan (hanya `has_token`); dikirim lewat
    field `token` saat PUT untuk memperbaruinya (string kosong = tidak diubah).
    """
    permission_classes = [IsAdmin]

    def _serialize(self, cfg):
        return {
            'enabled': cfg.enabled,
            'provider': cfg.provider,
            'base_url': cfg.base_url,
            'has_token': bool(cfg.token_enc),
        }

    def get(self, request):
        from .models import CampusLogbookConfig
        return Response(self._serialize(CampusLogbookConfig.load()))

    def put(self, request):
        from .models import CampusLogbookConfig
        cfg = CampusLogbookConfig.load()
        data = request.data

        if 'provider' in data:
            provider = str(data.get('provider') or '').strip().lower()
            if provider not in ('sekawan', 'kpti'):
                return Response({'detail': "Provider harus 'sekawan' atau 'kpti'."},
                                status=status.HTTP_400_BAD_REQUEST)
            cfg.provider = provider
        if 'base_url' in data:
            cfg.base_url = str(data.get('base_url') or '').strip()
        if 'enabled' in data:
            cfg.enabled = bool(data.get('enabled'))
        # token opsional: hanya diperbarui bila string non-kosong dikirim
        if data.get('token'):
            cfg.set_token(str(data['token']))

        if cfg.enabled and not (cfg.base_url and (cfg.token_enc or data.get('token'))):
            return Response(
                {'detail': 'URL dan token wajib diisi sebelum mengaktifkan integrasi.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cfg.save()
        SystemLog.objects.create(
            level=SystemLog.Level.INFO,
            event_type='CAMPUS_LOGBOOK_CONFIG',
            message=f'Konfigurasi logbook kampus diperbarui oleh {request.user.email}',
            context={'enabled': cfg.enabled, 'provider': cfg.provider},
        )
        return Response(self._serialize(cfg))


class RetryPipelineView(APIView):
    """POST /api/logbook/<session_id>/retry/ — dosen mencoba ulang pipeline STT/AI.

    Dua jalur (audit G6 + ringkas-ulang):
      - FAILED + ada rekaman → ulangi pipeline penuh (STT → LLM).
      - Sudah punya transkrip (FAILED/READY_FOR_REVIEW) → ulangi tahap LLM saja.
    """
    permission_classes = [IsLecturer]

    def post(self, request, session_id):
        logbook = _get_logbook_or_404(session_id)
        if logbook is None:
            return Response({'detail': 'Logbook tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)
        if logbook.session.submission.student.adviser != request.user:
            return Response({'detail': 'Hanya dosen pembimbing yang dapat mencoba ulang.'},
                            status=status.HTTP_403_FORBIDDEN)
        if logbook.status not in (SessionLogbook.Status.FAILED,
                                  SessionLogbook.Status.READY_FOR_REVIEW):
            return Response({'detail': 'Hanya logbook gagal atau draf siap tinjau yang dapat diproses ulang.'},
                            status=status.HTTP_400_BAD_REQUEST)

        from apps.logbook.tasks import dispatch_pipeline, dispatch_summarize
        if logbook.transcript:
            # Transkrip sudah ada → cukup ulangi tahap ringkasan LLM (hemat STT).
            logbook.status = SessionLogbook.Status.SUMMARIZING
            logbook.save(update_fields=['status', 'updated_at'])
            dispatched = dispatch_summarize(logbook)
        else:
            if not hasattr(logbook.session, 'recording'):
                return Response({'detail': 'Tidak ada rekaman untuk diproses ulang.'},
                                status=status.HTTP_400_BAD_REQUEST)
            logbook.status = SessionLogbook.Status.PENDING
            logbook.save(update_fields=['status', 'updated_at'])
            dispatched = dispatch_pipeline(logbook)
        return Response({'status': logbook.status, 'dispatched': bool(dispatched)})
