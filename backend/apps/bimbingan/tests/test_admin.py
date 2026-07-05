"""
Phase 8 — Admin Emergency Controls & Ketua Jurusan Reporting (FR-AD02/03, FR-KP01/02/03).

Covers:
  GET  /api/stats/admin/                  → AdminStatsView
  POST /api/admin/emergency-cancel/       → AdminEmergencyCancelView
  GET  /api/admin/logs/                   → AdminLogsView
  POST /api/admin/logs/cleanup/           → AdminLogsCleanupView
  GET  /api/ketua-jurusan/stats/                → KetuaJurusanStatsView
  GET  /api/ketua-jurusan/export/               → KetuaJurusanExportView (CSV + PDF)
"""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.bimbingan.models import Session, SystemLog


def client_for(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _approve(lecturer, submission):
    resp = client_for(lecturer).post(
        f'/api/submissions/{submission.id}/approve/', {'method': 'offline'}, format='json'
    )
    assert resp.status_code == 200, resp.data
    return Session.objects.get(submission=submission)


@pytest.mark.django_db
class TestAdminStatsView:
    url = '/api/stats/admin/'

    def test_admin_can_view_stats(self, authenticated_admin, lecturer_user):
        resp = authenticated_admin.get(self.url)
        assert resp.status_code == 200
        assert 'total_students' in resp.data
        assert 'total_lecturers' in resp.data
        assert 'recent_errors' in resp.data
        assert 'lecturers' in resp.data
        assert 'integrations' in resp.data

    def test_lecturers_list_includes_active_session_count(
        self, authenticated_admin, lecturer_user, pending_submission
    ):
        _approve(lecturer_user, pending_submission)

        resp = authenticated_admin.get(self.url)
        assert resp.status_code == 200
        row = next(l for l in resp.data['lecturers'] if l['id'] == lecturer_user.id)
        assert row['active_sessions'] == 1

    def test_non_admin_forbidden(self, authenticated_lecturer):
        resp = authenticated_lecturer.get(self.url)
        assert resp.status_code == 403

    def test_response_includes_stt_llm_block(self, authenticated_admin):
        resp = authenticated_admin.get(self.url)
        assert resp.status_code == 200
        assert 'stt_llm' in resp.data
        for key in ('transcription_success', 'summary_success', 'failed_fallback',
                    'monthly_cost_idr', 'avg_cost_per_session_idr'):
            assert key in resp.data['stt_llm']

    def test_monthly_cost_idr_sums_stored_logbook_costs(
        self, authenticated_admin, lecturer_user, pending_submission, submission_for, second_advisee_student,
    ):
        from decimal import Decimal
        from apps.logbook.models import SessionLogbook

        session1 = _approve(lecturer_user, pending_submission)
        submission2 = submission_for(second_advisee_student)
        session2 = _approve(lecturer_user, submission2)

        SessionLogbook.objects.create(
            session=session1, status=SessionLogbook.Status.APPROVED,
            llm_cost_estimate_idr=Decimal('120.50'),
        )
        SessionLogbook.objects.create(
            session=session2, status=SessionLogbook.Status.APPROVED,
            llm_cost_estimate_idr=Decimal('79.50'),
        )

        resp = authenticated_admin.get(self.url)
        assert resp.status_code == 200
        assert Decimal(str(resp.data['stt_llm']['monthly_cost_idr'])) == Decimal('200.00')

    def test_failed_fallback_counts_phase6_event_types(self, authenticated_admin):
        SystemLog.objects.create(level=SystemLog.Level.ERROR, event_type='STT_FAILED', context={})
        SystemLog.objects.create(level=SystemLog.Level.ERROR, event_type='LLM_TIMEOUT', context={})
        SystemLog.objects.create(level=SystemLog.Level.ERROR, event_type='UNRELATED_EVENT', context={})

        resp = authenticated_admin.get(self.url)
        assert resp.status_code == 200
        assert resp.data['stt_llm']['failed_fallback'] == 2


@pytest.mark.django_db
class TestAdminEmergencyCancelView:
    url = '/api/admin/emergency-cancel/'

    def test_cancels_all_active_sessions_for_a_lecturer(
        self, authenticated_admin, lecturer_user, pending_submission
    ):
        session = _approve(lecturer_user, pending_submission)

        resp = authenticated_admin.post(
            self.url,
            {'dosen_id': lecturer_user.id, 'alasan': 'Dosen sakit mendadak hari ini'},
            format='json',
        )
        assert resp.status_code == 200
        assert resp.data['sessions_cancelled'] == 1

        session.refresh_from_db()
        assert session.status == Session.Status.CANCELLED
        session.submission.refresh_from_db()
        assert session.submission.status == 'cancelled'

    def test_logs_event_type_emergency_cancel(
        self, authenticated_admin, lecturer_user, pending_submission
    ):
        _approve(lecturer_user, pending_submission)

        authenticated_admin.post(
            self.url,
            {'dosen_id': lecturer_user.id, 'alasan': 'Dosen sakit mendadak hari ini'},
            format='json',
        )

        assert SystemLog.objects.filter(event_type='EMERGENCY_CANCEL').exists()

    def test_rejects_reason_shorter_than_10_chars(self, authenticated_admin, lecturer_user):
        resp = authenticated_admin.post(
            self.url, {'dosen_id': lecturer_user.id, 'alasan': 'short'}, format='json'
        )
        assert resp.status_code == 400

    def test_rejects_missing_dosen_id(self, authenticated_admin):
        resp = authenticated_admin.post(self.url, {'alasan': 'Alasan yang cukup panjang'}, format='json')
        assert resp.status_code == 400

    def test_nonexistent_dosen_returns_404(self, authenticated_admin):
        resp = authenticated_admin.post(
            self.url, {'dosen_id': 999999, 'alasan': 'Alasan yang cukup panjang'}, format='json'
        )
        assert resp.status_code == 404

    def test_non_admin_forbidden(self, authenticated_lecturer, lecturer_user):
        resp = authenticated_lecturer.post(
            self.url, {'dosen_id': lecturer_user.id, 'alasan': 'Alasan yang cukup panjang'}, format='json'
        )
        assert resp.status_code == 403


@pytest.mark.django_db
class TestAdminLogsView:
    url = '/api/admin/logs/'

    def test_admin_can_list_logs(self, authenticated_admin):
        SystemLog.objects.create(level=SystemLog.Level.INFO, event_type='TEST_EVENT', message='hello')

        resp = authenticated_admin.get(self.url)
        assert resp.status_code == 200
        assert resp.data['total'] >= 1
        assert any(l['type'] == 'TEST_EVENT' for l in resp.data['logs'])

    def test_filters_by_type(self, authenticated_admin):
        SystemLog.objects.create(level=SystemLog.Level.INFO, event_type='TYPE_A', message='a')
        SystemLog.objects.create(level=SystemLog.Level.INFO, event_type='TYPE_B', message='b')

        resp = authenticated_admin.get(self.url, {'type': 'TYPE_A'})
        assert resp.status_code == 200
        assert all(l['type'] == 'TYPE_A' for l in resp.data['logs'])

    def test_pagination_limit_is_capped_at_200(self, authenticated_admin):
        resp = authenticated_admin.get(self.url, {'limit': 9999})
        assert resp.status_code == 200
        assert resp.data['limit'] == 200

    def test_non_admin_forbidden(self, authenticated_lecturer):
        resp = authenticated_lecturer.get(self.url)
        assert resp.status_code == 403


@pytest.mark.django_db
class TestAdminLogsCleanupView:
    url = '/api/admin/logs/cleanup/'

    def test_deletes_logs_older_than_30_days(self, authenticated_admin):
        old = SystemLog.objects.create(level=SystemLog.Level.INFO, event_type='OLD', message='old')
        SystemLog.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=31))
        recent = SystemLog.objects.create(level=SystemLog.Level.INFO, event_type='RECENT', message='recent')

        resp = authenticated_admin.post(self.url)
        assert resp.status_code == 200
        assert resp.data['deleted'] == 1
        assert not SystemLog.objects.filter(pk=old.pk).exists()
        assert SystemLog.objects.filter(pk=recent.pk).exists()

    def test_non_admin_forbidden(self, authenticated_lecturer):
        resp = authenticated_lecturer.post(self.url)
        assert resp.status_code == 403


@pytest.mark.django_db
class TestKetuaJurusanStatsView:
    url = '/api/ketua-jurusan/stats/'

    def test_ketua_jurusan_can_view_stats(self, ketua_jurusan_user, lecturer_user, pending_submission):
        _approve(lecturer_user, pending_submission)

        resp = client_for(ketua_jurusan_user).get(self.url)
        assert resp.status_code == 200
        assert resp.data['total_sesi'] == 1
        assert len(resp.data['beban_per_dosen']) == 1
        assert resp.data['beban_per_dosen'][0]['dosen_id'] == lecturer_user.id

    def test_admin_can_also_view_ketua_jurusan_stats(self, authenticated_admin):
        resp = authenticated_admin.get(self.url)
        assert resp.status_code == 200

    def test_defaults_to_monthly_period(self, ketua_jurusan_user):
        resp = client_for(ketua_jurusan_user).get(self.url)
        assert resp.status_code == 200
        assert resp.data['period'] == 'monthly'

    def test_invalid_period_falls_back_to_monthly(self, ketua_jurusan_user):
        resp = client_for(ketua_jurusan_user).get(self.url, {'period': 'yearly'})
        assert resp.status_code == 200
        assert resp.data['period'] == 'monthly'

    def test_completed_sessions_counted_via_complete_flow(
        self, ketua_jurusan_user, lecturer_user, pending_submission
    ):
        """Phase 5 gap closed (SESSION-04): the 'Selesai' endpoint now transitions a
        Session to DONE, so the sesi_selesai metric counts real completed sessions.
        (This test used to be a regression guard asserting the metric was stuck at 0
        while no completion flow existed — see 05-VERIFICATION.md history.)"""
        session = _approve(lecturer_user, pending_submission)
        client = client_for(lecturer_user)
        assert client.post(f'/api/queue/{session.id}/start/', {}, format='json').status_code == 200
        assert client.post(f'/api/queue/{session.id}/complete/').status_code == 200

        resp = client_for(ketua_jurusan_user).get(self.url)
        assert resp.status_code == 200
        assert resp.data['sesi_selesai'] == 1

    def test_lecturer_forbidden(self, authenticated_lecturer):
        resp = authenticated_lecturer.get(self.url)
        assert resp.status_code == 403


@pytest.mark.django_db
class TestKetuaJurusanExportView:
    url = '/api/ketua-jurusan/export/'

    def test_csv_export_default_format(self, ketua_jurusan_user, lecturer_user, pending_submission):
        _approve(lecturer_user, pending_submission)

        resp = client_for(ketua_jurusan_user).get(self.url)
        assert resp.status_code == 200
        assert resp['Content-Type'].startswith('text/csv')
        body = resp.content.decode('utf-8-sig')
        assert 'NIM' in body
        assert 'Nama Mahasiswa' in body

    def test_pdf_export(self, ketua_jurusan_user, lecturer_user, pending_submission):
        _approve(lecturer_user, pending_submission)

        resp = client_for(ketua_jurusan_user).get(self.url, {'format': 'pdf'})
        assert resp.status_code == 200
        assert resp['Content-Type'] == 'application/pdf'
        assert resp.content[:4] == b'%PDF'

    def test_lecturer_forbidden(self, authenticated_lecturer):
        resp = authenticated_lecturer.get(self.url)
        assert resp.status_code == 403
