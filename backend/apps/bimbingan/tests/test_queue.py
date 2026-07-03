"""
Phase 2 — Queue display, self-cancel, and lecturer queue.

Covers the queue-facing endpoints created when a submission is approved:
  GET  /api/queue/my/            → StudentQueueView      (IsStudent)
  POST /api/queue/<id>/cancel/   → CancelStudentQueueView (IsStudent)
  POST /api/queue/<id>/start/    → StartSessionView      (IsLecturer)
  GET  /api/queue/lecturer/      → LecturerQueueView     (IsLecturer)

Note: tests that involve two actors (lecturer + student) build a fresh
APIClient per actor — the shared `api_client` fixture is a single instance,
so authenticating two `authenticated_*` fixtures in one test would have them
clobber each other.
"""
import pytest
from rest_framework.test import APIClient

from apps.bimbingan.models import Session
from apps.submissions.models import Submission


def client_for(user):
    """A dedicated APIClient authenticated as `user`."""
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def approve_url(pk):
    return f'/api/submissions/{pk}/approve/'


def _approve(lecturer, submission):
    """Helper: approve a submission (offline) as `lecturer` and return its Session."""
    resp = client_for(lecturer).post(
        approve_url(submission.id), {'method': 'offline'}, format='json'
    )
    assert resp.status_code == 200, resp.data
    return Session.objects.get(submission=submission)


@pytest.mark.django_db
class TestStudentQueueView:
    """GET /api/queue/my/ — student sees their current queue slot."""

    url = '/api/queue/my/'

    def test_student_without_queue_has_no_active_queue(self, advisee_student):
        """A student with no approved session reports hasActiveQueue=False."""
        resp = client_for(advisee_student).get(self.url)
        assert resp.status_code == 200
        assert resp.data['hasActiveQueue'] is False
        assert resp.data['session'] is None

    def test_student_sees_queue_after_approval(
        self, lecturer_user, advisee_student, pending_submission
    ):
        """After approval the student sees an active queue with a position and schedule."""
        _approve(lecturer_user, pending_submission)

        resp = client_for(advisee_student).get(self.url)
        assert resp.status_code == 200
        assert resp.data['hasActiveQueue'] is True
        session = resp.data['session']
        assert session['queue_position'] == 1
        assert session['scheduled_at'] is not None

    def test_non_student_forbidden(self, lecturer_user):
        """The student queue endpoint is student-only."""
        resp = client_for(lecturer_user).get(self.url)
        assert resp.status_code == 403


@pytest.mark.django_db
class TestCancelStudentQueue:
    """POST /api/queue/<id>/cancel/ — student self-cancels before their turn."""

    def cancel_url(self, pk):
        return f'/api/queue/{pk}/cancel/'

    def test_student_can_cancel_own_waiting_session(
        self, lecturer_user, advisee_student, pending_submission
    ):
        """Cancelling a WAITING session flips both session and submission to CANCELLED."""
        session = _approve(lecturer_user, pending_submission)

        resp = client_for(advisee_student).post(self.cancel_url(session.id))
        assert resp.status_code == 200

        session.refresh_from_db()
        assert session.status == Session.Status.CANCELLED
        session.submission.refresh_from_db()
        assert session.submission.status == Submission.Status.CANCELLED

    def test_student_cannot_cancel_others_session(
        self, lecturer_user, student_user, pending_submission
    ):
        """A different student cannot cancel someone else's queue slot."""
        session = _approve(lecturer_user, pending_submission)
        # student_user is not the advisee who owns the session.
        resp = client_for(student_user).post(self.cancel_url(session.id))
        assert resp.status_code == 403

        session.refresh_from_db()
        assert session.status == Session.Status.WAITING

    def test_cancel_nonexistent_returns_404(self, advisee_student):
        """Cancelling a non-existent session returns 404."""
        resp = client_for(advisee_student).post(self.cancel_url(999999))
        assert resp.status_code == 404

    def test_cannot_cancel_non_waiting_session(
        self, lecturer_user, advisee_student, pending_submission
    ):
        """A session already in progress cannot be self-cancelled (400)."""
        session = _approve(lecturer_user, pending_submission)
        session.status = Session.Status.IN_PROGRESS
        session.save(update_fields=['status'])

        resp = client_for(advisee_student).post(self.cancel_url(session.id))
        assert resp.status_code == 400


@pytest.mark.django_db
class TestLecturerQueueView:
    """GET /api/queue/lecturer/ — lecturer sees today's waiting queue."""

    url = '/api/queue/lecturer/'

    def test_empty_queue(self, lecturer_user):
        """No approvals yet → empty queue, zero waiting."""
        resp = client_for(lecturer_user).get(self.url)
        assert resp.status_code == 200
        assert resp.data['totalWaiting'] == 0
        assert resp.data['queue'] == []

    def test_queue_lists_waiting_sessions_in_order(
        self,
        lecturer_user,
        pending_submission,
        second_advisee_student,
        submission_for,
        symptom_category,
    ):
        """Two approvals appear in the queue, ordered by schedule with positions 1 and 2."""
        _approve(lecturer_user, pending_submission)
        sub2 = submission_for(second_advisee_student, [symptom_category])
        _approve(lecturer_user, sub2)

        resp = client_for(lecturer_user).get(self.url)
        assert resp.status_code == 200
        assert resp.data['totalWaiting'] == 2
        positions = [item['position'] for item in resp.data['queue']]
        assert positions == [1, 2]

    def test_non_lecturer_forbidden(self, advisee_student):
        """The lecturer queue endpoint is lecturer-only."""
        resp = client_for(advisee_student).get(self.url)
        assert resp.status_code == 403


@pytest.mark.django_db
class TestStartSession:
    """POST /api/queue/<id>/start/ — lecturer starts a session (sets ts1, IN_PROGRESS)."""

    def start_url(self, pk):
        return f'/api/queue/{pk}/start/'

    def test_lecturer_can_start_waiting_session(
        self, lecturer_user, pending_submission
    ):
        """Starting a waiting session moves it to IN_PROGRESS and stamps ts1."""
        session = _approve(lecturer_user, pending_submission)

        resp = client_for(lecturer_user).post(self.start_url(session.id))
        assert resp.status_code == 200

        session.refresh_from_db()
        assert session.status == Session.Status.IN_PROGRESS
        assert session.ts1 is not None

    def test_student_cannot_start_session(
        self, lecturer_user, advisee_student, pending_submission
    ):
        """Students cannot start sessions — lecturer-only action."""
        session = _approve(lecturer_user, pending_submission)
        resp = client_for(advisee_student).post(self.start_url(session.id))
        assert resp.status_code == 403

    def test_consent_given_at_recorded_when_both_parties_consent(
        self, lecturer_user, pending_submission
    ):
        """FR-M04 — consent_given_at is stamped only when both dosen and
        mahasiswa consent to recording."""
        session = _approve(lecturer_user, pending_submission)

        resp = client_for(lecturer_user).post(
            self.start_url(session.id),
            {'consent_by_dosen': True, 'consent_by_mahasiswa': True},
            format='json',
        )
        assert resp.status_code == 200

        session.refresh_from_db()
        assert session.consent_by_dosen is True
        assert session.consent_by_mahasiswa is True
        assert session.consent_given_at is not None

    def test_session_proceeds_without_recording_if_either_party_declines(
        self, lecturer_user, pending_submission
    ):
        """FR-M04 — session still starts (ts1 stamped, IN_PROGRESS) even when
        consent is declined; it just isn't recorded (consent_given_at stays null)."""
        session = _approve(lecturer_user, pending_submission)

        resp = client_for(lecturer_user).post(
            self.start_url(session.id),
            {'consent_by_dosen': True, 'consent_by_mahasiswa': False},
            format='json',
        )
        assert resp.status_code == 200

        session.refresh_from_db()
        assert session.status == Session.Status.IN_PROGRESS
        assert session.ts1 is not None
        assert session.consent_given_at is None

    def test_consent_defaults_to_declined_when_not_sent(
        self, lecturer_user, pending_submission
    ):
        """Omitting consent fields entirely must not be treated as consent."""
        session = _approve(lecturer_user, pending_submission)

        resp = client_for(lecturer_user).post(self.start_url(session.id))
        assert resp.status_code == 200

        session.refresh_from_db()
        assert session.consent_by_dosen is False
        assert session.consent_by_mahasiswa is False
        assert session.consent_given_at is None
