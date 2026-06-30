"""
Phase 2 — Approval & Queue Placement (approve/reject endpoints).

Maps to ROADMAP Phase 2 Success Criteria:
  SC1 — Lecturer can Approve, or Reject/Request-Revision with notes the student can see.
  SC2 — On approval, system calculates estimated duration from symptom + admin weight.
  SC3 — On approval, the student is placed in the lecturer's queue with a queue number
        and a fixed estimated schedule slot.

Endpoints:
  POST /api/submissions/<id>/approve/  → ApproveSubmissionView (IsLecturer)
  POST /api/submissions/<id>/reject/   → RejectSubmissionView  (IsLecturer)
"""
import pytest

from apps.bimbingan.models import Session
from apps.submissions.models import Submission


def approve_url(pk):
    return f'/api/submissions/{pk}/approve/'


def reject_url(pk):
    return f'/api/submissions/{pk}/reject/'


@pytest.mark.django_db
class TestApproveSubmission:
    """SC1/SC2/SC3 — lecturer approves a pending request → queued session."""

    def test_lecturer_can_approve_pending_submission(
        self, authenticated_lecturer, pending_submission
    ):
        """Approve returns 200, flips submission to APPROVED, and creates a WAITING session."""
        resp = authenticated_lecturer.post(
            approve_url(pending_submission.id), {'method': 'offline'}, format='json'
        )
        assert resp.status_code == 200

        pending_submission.refresh_from_db()
        assert pending_submission.status == Submission.Status.APPROVED

        session = Session.objects.get(submission=pending_submission)
        assert session.status == Session.Status.WAITING

    def test_approval_calculates_duration_from_symptom_weight(
        self, authenticated_lecturer, pending_submission
    ):
        """SC2 — estimated_minutes equals the sum of the symptoms' admin-configured weights.

        pending_submission has one symptom with duration_minutes == 45.
        """
        resp = authenticated_lecturer.post(
            approve_url(pending_submission.id), {'method': 'offline'}, format='json'
        )
        assert resp.status_code == 200
        assert resp.data['session']['estimated_minutes'] == 45

        session = Session.objects.get(submission=pending_submission)
        assert session.estimated_minutes == 45

    def test_duration_sums_multiple_symptom_weights(
        self, authenticated_lecturer, advisee_student, submission_for
    ):
        """SC2 — multiple symptoms sum their weights (45 + 30 = 75)."""
        from apps.symptoms.models import SymptomCategory
        s1, _ = SymptomCategory.objects.get_or_create(
            name='Metodologi', defaults={'duration_minutes': 45}
        )
        s2, _ = SymptomCategory.objects.get_or_create(
            name='Penulisan', defaults={'duration_minutes': 30}
        )
        sub = submission_for(advisee_student, [s1, s2])

        resp = authenticated_lecturer.post(
            approve_url(sub.id), {'method': 'offline'}, format='json'
        )
        assert resp.status_code == 200
        assert resp.data['session']['estimated_minutes'] == 75

    def test_approval_assigns_queue_number_and_schedule(
        self, authenticated_lecturer, pending_submission
    ):
        """SC3 — first approval gets queue position 1 and a concrete scheduled_at slot."""
        resp = authenticated_lecturer.post(
            approve_url(pending_submission.id), {'method': 'offline'}, format='json'
        )
        assert resp.status_code == 200
        assert resp.data['session']['queue_position'] == 1
        assert resp.data['session']['scheduled_at'] is not None

        session = Session.objects.get(submission=pending_submission)
        assert session.scheduled_at is not None

    def test_second_approval_queues_behind_first(
        self,
        authenticated_lecturer,
        pending_submission,
        second_advisee_student,
        submission_for,
        symptom_category,
    ):
        """SC3 — a second approved student gets queue position 2, scheduled after the first."""
        r1 = authenticated_lecturer.post(
            approve_url(pending_submission.id), {'method': 'offline'}, format='json'
        )
        assert r1.status_code == 200

        sub2 = submission_for(second_advisee_student, [symptom_category])
        r2 = authenticated_lecturer.post(
            approve_url(sub2.id), {'method': 'offline'}, format='json'
        )
        assert r2.status_code == 200
        assert r2.data['session']['queue_position'] == 2
        assert r2.data['session']['scheduled_at'] > r1.data['session']['scheduled_at']

    def test_online_method_requires_meeting_link(
        self, authenticated_lecturer, pending_submission
    ):
        """Online sessions must carry an external meeting link (serializer validation)."""
        resp = authenticated_lecturer.post(
            approve_url(pending_submission.id), {'method': 'online'}, format='json'
        )
        assert resp.status_code == 400
        assert 'meeting_link' in resp.data

    def test_online_method_with_link_succeeds(
        self, authenticated_lecturer, pending_submission
    ):
        """Online + a link approves and stores the link on the session."""
        resp = authenticated_lecturer.post(
            approve_url(pending_submission.id),
            {'method': 'online', 'meeting_link': 'https://meet.google.com/abc-defg-hij'},
            format='json',
        )
        assert resp.status_code == 200
        session = Session.objects.get(submission=pending_submission)
        assert session.method == 'online'
        assert session.meeting_link == 'https://meet.google.com/abc-defg-hij'

    def test_cannot_approve_already_approved(
        self, authenticated_lecturer, pending_submission
    ):
        """Only PENDING submissions may be approved — re-approval is a 400."""
        first = authenticated_lecturer.post(
            approve_url(pending_submission.id), {'method': 'offline'}, format='json'
        )
        assert first.status_code == 200
        second = authenticated_lecturer.post(
            approve_url(pending_submission.id), {'method': 'offline'}, format='json'
        )
        assert second.status_code == 400

    def test_lecturer_cannot_approve_non_advisee_submission(
        self, authenticated_lecturer, student_user, submission_for, symptom_category
    ):
        """student_user has no adviser → acting lecturer is not their adviser → 403."""
        sub = submission_for(student_user, [symptom_category])
        resp = authenticated_lecturer.post(
            approve_url(sub.id), {'method': 'offline'}, format='json'
        )
        assert resp.status_code == 403

    def test_student_cannot_approve(self, authenticated_student, pending_submission):
        """Non-lecturer roles are forbidden from approving."""
        resp = authenticated_student.post(
            approve_url(pending_submission.id), {'method': 'offline'}, format='json'
        )
        assert resp.status_code == 403

    def test_anonymous_cannot_approve(self, api_client, pending_submission):
        """Anonymous request is forbidden."""
        resp = api_client.post(
            approve_url(pending_submission.id), {'method': 'offline'}, format='json'
        )
        assert resp.status_code in (401, 403)

    def test_approve_nonexistent_returns_404(self, authenticated_lecturer):
        """Approving a submission that doesn't exist returns 404."""
        resp = authenticated_lecturer.post(
            approve_url(999999), {'method': 'offline'}, format='json'
        )
        assert resp.status_code == 404

    def test_approval_blocked_when_daily_quota_exceeded(
        self, authenticated_lecturer, pending_submission, monkeypatch
    ):
        """A request whose duration would push the day over quota is rejected with a reason."""
        # symptom weight is 45; shrink the quota below that so a single approval overflows.
        monkeypatch.setattr('apps.bimbingan.views.DOSEN_DAILY_QUOTA_MINUTES', 30)
        resp = authenticated_lecturer.post(
            approve_url(pending_submission.id), {'method': 'offline'}, format='json'
        )
        assert resp.status_code == 400
        assert 'detail' in resp.data
        # nothing should have been queued
        assert not Session.objects.filter(submission=pending_submission).exists()


@pytest.mark.django_db
class TestRejectSubmission:
    """SC1 — reject / request-revision carries a note the student can later read."""

    def test_lecturer_can_reject_with_reason(
        self, authenticated_lecturer, pending_submission
    ):
        """REJECTED action sets status REJECTED and persists the reason on the submission."""
        resp = authenticated_lecturer.post(
            reject_url(pending_submission.id),
            {'action': 'REJECTED', 'reason': 'Draft belum lengkap, mohon dilengkapi.'},
            format='json',
        )
        assert resp.status_code == 200

        pending_submission.refresh_from_db()
        assert pending_submission.status == Submission.Status.REJECTED
        # SC1 — the note must be readable by the student on their submission record.
        assert pending_submission.rejection_reason == 'Draft belum lengkap, mohon dilengkapi.'

    def test_lecturer_can_request_revision(
        self, authenticated_lecturer, pending_submission
    ):
        """REVISION action sets status REVISION and keeps the note."""
        resp = authenticated_lecturer.post(
            reject_url(pending_submission.id),
            {'action': 'REVISION', 'reason': 'Perbaiki rumusan masalah di bab 1.'},
            format='json',
        )
        assert resp.status_code == 200
        pending_submission.refresh_from_db()
        assert pending_submission.status == Submission.Status.REVISION
        assert 'rumusan masalah' in pending_submission.rejection_reason

    def test_reject_does_not_create_a_session(
        self, authenticated_lecturer, pending_submission
    ):
        """Rejection must never place the student into the queue."""
        authenticated_lecturer.post(
            reject_url(pending_submission.id),
            {'action': 'REJECTED', 'reason': 'Tidak memenuhi syarat pengajuan.'},
            format='json',
        )
        assert not Session.objects.filter(submission=pending_submission).exists()

    def test_reject_reason_too_short_is_rejected(
        self, authenticated_lecturer, pending_submission
    ):
        """A reason under 10 characters fails validation (400)."""
        resp = authenticated_lecturer.post(
            reject_url(pending_submission.id),
            {'action': 'REJECTED', 'reason': 'no'},
            format='json',
        )
        assert resp.status_code == 400

    def test_cannot_reject_non_pending(
        self, authenticated_lecturer, pending_submission
    ):
        """Only PENDING submissions may be rejected/revised."""
        authenticated_lecturer.post(
            approve_url(pending_submission.id), {'method': 'offline'}, format='json'
        )
        resp = authenticated_lecturer.post(
            reject_url(pending_submission.id),
            {'action': 'REJECTED', 'reason': 'Mencoba menolak yang sudah disetujui.'},
            format='json',
        )
        assert resp.status_code == 400

    def test_lecturer_cannot_reject_non_advisee(
        self, authenticated_lecturer, student_user, submission_for, symptom_category
    ):
        """A lecturer cannot reject a submission from a student they don't advise."""
        sub = submission_for(student_user, [symptom_category])
        resp = authenticated_lecturer.post(
            reject_url(sub.id),
            {'action': 'REJECTED', 'reason': 'Bukan mahasiswa bimbingan saya.'},
            format='json',
        )
        assert resp.status_code == 403

    def test_student_cannot_reject(self, authenticated_student, pending_submission):
        """Non-lecturer roles are forbidden from rejecting."""
        resp = authenticated_student.post(
            reject_url(pending_submission.id),
            {'action': 'REJECTED', 'reason': 'Mahasiswa mencoba menolak.'},
            format='json',
        )
        assert resp.status_code == 403
