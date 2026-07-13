"""
Dosen jadwalkan langsung — full control tanpa approval mahasiswa.

  GET  /api/queue/lecturer/advisees/  → LecturerAdviseesView   (IsLecturer)
  POST /api/queue/lecturer/schedule/  → LecturerScheduleSessionView (IsLecturer)

Dosen memilih mahasiswa bimbingan + tanggal → sesi WAITING langsung dibuat
dan mahasiswa menerima notifikasi (hanya informasi, bukan permintaan approve).
"""
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.bimbingan.models import Notification, Session
from apps.submissions.models import Submission


def client_for(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


ADVISEES_URL = '/api/queue/lecturer/advisees/'
SCHEDULE_URL = '/api/queue/lecturer/schedule/'


def future(hours=24):
    return (timezone.now() + timedelta(hours=hours)).isoformat()


@pytest.mark.django_db
class TestLecturerAdviseesView:
    def test_lecturer_sees_own_advisees(self, lecturer_user, advisee_student):
        resp = client_for(lecturer_user).get(ADVISEES_URL)
        assert resp.status_code == 200
        ids = [a['id'] for a in resp.data['advisees']]
        assert advisee_student.id in ids

    def test_student_forbidden(self, advisee_student):
        resp = client_for(advisee_student).get(ADVISEES_URL)
        assert resp.status_code == 403


@pytest.mark.django_db
class TestLecturerScheduleSessionView:
    def test_schedule_creates_session_and_notifies_student(
        self, lecturer_user, advisee_student
    ):
        resp = client_for(lecturer_user).post(
            SCHEDULE_URL,
            {'student_id': advisee_student.id, 'scheduled_at': future(), 'method': 'offline'},
            format='json',
        )
        assert resp.status_code == 201, resp.data
        session = Session.objects.get(pk=resp.data['session']['id'])
        assert session.status == Session.Status.WAITING
        assert session.submission.student == advisee_student
        assert session.submission.status == Submission.Status.APPROVED
        # Mahasiswa dinotifikasi — cukup lihat, tidak ada langkah approve.
        notif = Notification.objects.filter(
            recipient=advisee_student, event_type='SCHEDULED_BY_LECTURER'
        )
        assert notif.count() == 1
        assert 'menjadwalkan sesi bimbingan' in notif.first().message

    def test_online_requires_meeting_link(self, lecturer_user, advisee_student):
        resp = client_for(lecturer_user).post(
            SCHEDULE_URL,
            {'student_id': advisee_student.id, 'scheduled_at': future(), 'method': 'online'},
            format='json',
        )
        assert resp.status_code == 400
        assert 'meeting_link' in resp.data

    def test_rejects_past_datetime(self, lecturer_user, advisee_student):
        past = (timezone.now() - timedelta(hours=1)).isoformat()
        resp = client_for(lecturer_user).post(
            SCHEDULE_URL,
            {'student_id': advisee_student.id, 'scheduled_at': past},
            format='json',
        )
        assert resp.status_code == 400
        assert 'scheduled_at' in resp.data

    def test_rejects_non_advisee(self, lecturer_user, student_user):
        """student_user tidak dibimbing lecturer_user → 403."""
        resp = client_for(lecturer_user).post(
            SCHEDULE_URL,
            {'student_id': student_user.id, 'scheduled_at': future()},
            format='json',
        )
        assert resp.status_code == 403

    def test_conflict_when_student_has_active_session(
        self, lecturer_user, advisee_student
    ):
        first = client_for(lecturer_user).post(
            SCHEDULE_URL,
            {'student_id': advisee_student.id, 'scheduled_at': future()},
            format='json',
        )
        assert first.status_code == 201
        second = client_for(lecturer_user).post(
            SCHEDULE_URL,
            {'student_id': advisee_student.id, 'scheduled_at': future(48)},
            format='json',
        )
        assert second.status_code == 409

    def test_student_cannot_schedule(self, advisee_student):
        resp = client_for(advisee_student).post(
            SCHEDULE_URL,
            {'student_id': advisee_student.id, 'scheduled_at': future()},
            format='json',
        )
        assert resp.status_code == 403

    def test_scheduled_session_appears_in_lecturer_calendar(
        self, lecturer_user, advisee_student
    ):
        """Sesi yang dijadwalkan muncul di grid kalender bulanan dosen."""
        when = timezone.now() + timedelta(hours=24)
        client_for(lecturer_user).post(
            SCHEDULE_URL,
            {'student_id': advisee_student.id, 'scheduled_at': when.isoformat()},
            format='json',
        )
        local = timezone.localtime(when)
        resp = client_for(lecturer_user).get(
            f'/api/queue/lecturer/calendar/?month={local.year:04d}-{local.month:02d}'
        )
        assert resp.status_code == 200
        assert len(resp.data['sessions']) == 1
        assert resp.data['sessions'][0]['mahasiswa_name'] == advisee_student.full_name

    def test_calendar_invalid_month_falls_back_to_current(self, lecturer_user):
        resp = client_for(lecturer_user).get('/api/queue/lecturer/calendar/?month=banana')
        assert resp.status_code == 200
        now = timezone.localtime()
        assert resp.data['month'] == f'{now.year:04d}-{now.month:02d}'

    def test_scheduled_session_appears_in_student_queue(
        self, lecturer_user, advisee_student
    ):
        client_for(lecturer_user).post(
            SCHEDULE_URL,
            {'student_id': advisee_student.id, 'scheduled_at': future()},
            format='json',
        )
        resp = client_for(advisee_student).get('/api/queue/my/')
        assert resp.status_code == 200
        assert resp.data['hasActiveQueue'] is True
