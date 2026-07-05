"""
Phase 6 / Wave 2 (06-04): lecturer/student logbook view tests — ownership and
read-access guards.
"""
import pytest
from django.utils import timezone

from apps.bimbingan.models import Session
from apps.logbook.models import SessionLogbook
from apps.submissions.models import Submission


def _make_logbook(student, submission_for, **overrides):
    """Creates an approved Submission -> Session -> SessionLogbook chain for
    the given student, defaulting to READY_FOR_REVIEW so approve/detail tests
    have a sensible starting point."""
    submission = submission_for(student)
    submission.status = Submission.Status.APPROVED
    submission.save(update_fields=['status'])
    session = Session.objects.create(
        submission=submission,
        status=Session.Status.DONE,
        method=Session.Method.OFFLINE,
        estimated_minutes=45,
        scheduled_at=timezone.now(),
        ts2=timezone.now(),
    )
    defaults = dict(
        session=session,
        status=SessionLogbook.Status.READY_FOR_REVIEW,
        transcript='Halo, ini transkrip contoh.',
        summary_raw={'advice_points': [], 'improvement_notes': []},
    )
    defaults.update(overrides)
    return SessionLogbook.objects.create(**defaults)


@pytest.mark.django_db
class TestLecturerLogbookList:
    def test_list_is_advisee_scoped(
        self, authenticated_lecturer, lecturer_user, advisee_student,
        second_advisee_student, second_approved_student, submission_for,
    ):
        _make_logbook(advisee_student, submission_for)
        _make_logbook(second_advisee_student, submission_for)
        _make_logbook(second_approved_student, submission_for)  # not advised by lecturer_user

        response = authenticated_lecturer.get('/api/logbook/lecturer/')

        assert response.status_code == 200
        assert len(response.data) == 2
        nims = {row['student_nim'] for row in response.data}
        assert nims == {advisee_student.nim, second_advisee_student.nim}


@pytest.mark.django_db
class TestLecturerLogbookDetail:
    def test_owner_lecturer_sees_detail(self, authenticated_lecturer, advisee_student, submission_for):
        logbook = _make_logbook(advisee_student, submission_for)

        response = authenticated_lecturer.get(f'/api/logbook/{logbook.session_id}/')

        assert response.status_code == 200
        assert response.data['transcript'] == 'Halo, ini transkrip contoh.'

    def test_non_owner_lecturer_gets_403(self, authenticated_lecturer, second_approved_student, submission_for):
        logbook = _make_logbook(second_approved_student, submission_for)

        response = authenticated_lecturer.get(f'/api/logbook/{logbook.session_id}/')

        assert response.status_code == 403

    def test_missing_logbook_gets_404(self, authenticated_lecturer):
        response = authenticated_lecturer.get('/api/logbook/999999/')
        assert response.status_code == 404


@pytest.mark.django_db
class TestStudentLogbook:
    def test_student_sees_own_approved_logbook(self, authenticated_advisee, advisee_student, submission_for):
        logbook = _make_logbook(advisee_student, submission_for, status=SessionLogbook.Status.APPROVED)

        response = authenticated_advisee.get(f'/api/logbook/student/{logbook.session_id}/')

        assert response.status_code == 200
        assert response.data['status'] == 'approved'

    def test_student_blocked_on_unapproved_own_logbook(self, authenticated_advisee, advisee_student, submission_for):
        logbook = _make_logbook(advisee_student, submission_for, status=SessionLogbook.Status.READY_FOR_REVIEW)

        response = authenticated_advisee.get(f'/api/logbook/student/{logbook.session_id}/')

        assert response.status_code == 403

    def test_student_blocked_on_other_students_logbook(
        self, authenticated_advisee, second_advisee_student, submission_for,
    ):
        logbook = _make_logbook(
            second_advisee_student, submission_for, status=SessionLogbook.Status.APPROVED,
        )

        response = authenticated_advisee.get(f'/api/logbook/student/{logbook.session_id}/')

        assert response.status_code == 404
