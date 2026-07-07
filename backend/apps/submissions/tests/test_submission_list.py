"""
Audit #1 — the student submission list now exposes the linked Session + logbook
status so the dashboard can show an accurate session state and open the logbook.
"""
import pytest
from rest_framework.test import APIClient

from apps.bimbingan.models import Session
from apps.logbook.models import SessionLogbook


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
class TestSubmissionListLinkage:
    url = '/api/submissions/'

    def test_pending_submission_has_null_session_fields(self, advisee_student, pending_submission):
        resp = client_for(advisee_student).get(self.url)
        assert resp.status_code == 200
        row = next(r for r in resp.data if r['id'] == pending_submission.id)
        assert row['session_id'] is None
        assert row['session_status'] is None
        assert row['logbook_status'] is None

    def test_approved_submission_exposes_session_status(
        self, lecturer_user, advisee_student, pending_submission
    ):
        session = _approve(lecturer_user, pending_submission)

        resp = client_for(advisee_student).get(self.url)
        row = next(r for r in resp.data if r['id'] == pending_submission.id)
        assert row['session_id'] == session.id
        assert row['session_status'] == Session.Status.WAITING
        assert row['logbook_status'] is None  # no logbook yet

    def test_exposes_logbook_status_when_present(
        self, lecturer_user, advisee_student, pending_submission
    ):
        session = _approve(lecturer_user, pending_submission)
        SessionLogbook.objects.create(session=session, status=SessionLogbook.Status.APPROVED)

        resp = client_for(advisee_student).get(self.url)
        row = next(r for r in resp.data if r['id'] == pending_submission.id)
        assert row['session_id'] == session.id
        assert row['logbook_status'] == SessionLogbook.Status.APPROVED
