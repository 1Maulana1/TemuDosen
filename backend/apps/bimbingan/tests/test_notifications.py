"""
Audit G2 — per-user in-app notifications. notify_* now writes a Notification row
(what the recipient sees) in addition to the admin-only SystemLog.
"""
import pytest
from rest_framework.test import APIClient

from apps.bimbingan.models import Notification, SystemLog
from apps.bimbingan.services.notification import notify_student, notify_lecturer


def client_for(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


URL = '/api/notifications/'


@pytest.mark.django_db
class TestNotifyWritesFeedRow:
    def test_notify_student_creates_notification_and_systemlog(self, student_user):
        notify_student(student_user, 'Pengajuan disetujui.', event_type='APPROVED')
        assert Notification.objects.filter(recipient=student_user, event_type='APPROVED').count() == 1
        assert SystemLog.objects.filter(event_type='APPROVED').count() == 1

    def test_notify_lecturer_creates_notification(self, lecturer_user):
        notify_lecturer(lecturer_user, 'Sesi dibatalkan mahasiswa.', event_type='STUDENT_CANCEL')
        assert Notification.objects.filter(recipient=lecturer_user).count() == 1


@pytest.mark.django_db
class TestNotificationListView:
    def test_lists_only_own_with_unread_count(self, student_user, second_approved_student):
        notify_student(student_user, 'Untuk saya 1')
        notify_student(student_user, 'Untuk saya 2')
        notify_student(second_approved_student, 'Untuk orang lain')

        resp = client_for(student_user).get(URL)
        assert resp.status_code == 200
        assert resp.data['unread_count'] == 2
        assert len(resp.data['notifications']) == 2
        assert all('Untuk saya' in n['message'] for n in resp.data['notifications'])

    def test_requires_auth(self):
        assert APIClient().get(URL).status_code in (401, 403)


@pytest.mark.django_db
class TestNotificationRead:
    def test_mark_one_read(self, student_user):
        notify_student(student_user, 'x')
        n = Notification.objects.get(recipient=student_user)
        resp = client_for(student_user).post(f'{URL}{n.id}/read/')
        assert resp.status_code == 200
        n.refresh_from_db()
        assert n.is_read is True

    def test_cannot_read_another_users_notification(self, student_user, second_approved_student):
        notify_student(student_user, 'x')
        n = Notification.objects.get(recipient=student_user)
        resp = client_for(second_approved_student).post(f'{URL}{n.id}/read/')
        assert resp.status_code == 404
        n.refresh_from_db()
        assert n.is_read is False

    def test_mark_all_read(self, student_user):
        notify_student(student_user, 'a')
        notify_student(student_user, 'b')
        resp = client_for(student_user).post(f'{URL}read-all/')
        assert resp.status_code == 200
        assert resp.data['marked_read'] == 2
        assert Notification.objects.filter(recipient=student_user, is_read=False).count() == 0
