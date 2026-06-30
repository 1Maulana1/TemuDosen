---
phase: 02-approval-queue-placement
verified: 2026-06-30T12:00:00Z
status: verified
score: 3/3 success criteria verified
test_evidence: backend/apps/bimbingan/tests/ — 32 tests, all passing
human_verification:
  - test: "Approve flow end-to-end in browser (lecturer /dosen → Setujui)"
    expected: "Pending request moves to queue; student sees queue number + estimated schedule on /mahasiswa"
    why_human: "Requires running backend + frontend with seeded adviser–advisee data"
  - test: "Self-cancel + queue recompaction in browser"
    expected: "Student cancels; remaining queue positions/times shift up; lecturer queue reflects the change"
    why_human: "Requires live multi-actor session"
---

# Phase 02: Approval & Queue Placement — Verification Report

**Phase Goal:** A lecturer can act on a pending request, and approval turns it into a triage-estimated, queued guidance slot.
**Verified:** 2026-06-30
**Status:** verified (programmatic, via automated tests)
**Re-verification:** No — initial verification

> **Provenance note.** Phase 2 was implemented and committed (`55aefb3 feat(phase2)`) *before* a formal GSD plan/verification loop was run, so no `02-*-PLAN.md` files exist. This document verifies the shipped code retroactively against the ROADMAP Phase 2 success criteria. The same commit also landed adjacent-phase code (Phase 3 self-cancel/quota, Phase 4 Google Calendar, Phase 8 stats/reporting) — those are tracked under their own phases and are **not** claimed complete here.

---

## Goal Achievement

### Success Criteria (from ROADMAP)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Lecturer can Approve, or Reject/Request-Revision with notes the student can see | VERIFIED | `ApproveSubmissionView` + `RejectSubmissionView` (`apps/bimbingan/views.py`) persist `rejection_reason`. **"Student can see" verified end-to-end:** `SubmissionListSerializer` now exposes `rejection_reason` and `StudentDashboard.tsx` renders it for rejected/revision. Tests: `test_approval.py::TestRejectSubmission` — incl. `test_student_can_see_rejection_note_via_their_submissions` (lecturer rejects → student GET `/api/submissions/` shows the note), plus reject/revision/short-reason/non-advisee/role guards |
| 2 | On approval, system calculates estimated duration from symptom + admin-configured weight | VERIFIED | `estimated_minutes = sum(s.duration_minutes for s in submission.symptoms.all()) or 30` (`views.py:140`). Tests: `test_approval.py::TestApproveSubmission::test_approval_calculates_duration_from_symptom_weight` (single = 45) and `test_duration_sums_multiple_symptom_weights` (45+30 = 75) |
| 3 | On approval, student is placed in lecturer's queue with a queue number + fixed estimated schedule slot | VERIFIED | `_calculate_schedule()` returns `(scheduled_at, queue_position, total_wait)`; `Session` row created WAITING with `scheduled_at` + `estimated_minutes`. Tests: `test_approval_assigns_queue_number_and_schedule` (pos 1, scheduled_at set) and `test_second_approval_queues_behind_first` (pos 2, later slot) |

**Score:** 3/3 success criteria verified by passing automated tests.

---

## Test Evidence

New test suite added in this change: `backend/apps/bimbingan/tests/` (Phase 1's `apps/bimbingan/` had **no** tests before).

| File | Covers | Tests |
|------|--------|-------|
| `test_approval.py` | Approve, reject, revision, duration calc, queue placement, quota guard, role/ownership guards, **student-visible reject note (end-to-end)** | 20 |
| `test_queue.py` | Student queue view, self-cancel, lecturer queue ordering, start session | 13 |

```
$ .venv/Scripts/python -m pytest apps/bimbingan/tests/ -q
33 passed
```

Full backend suite after the change: **140 passed, 0 failed**.

**SC1 gap caught in review and fixed in this PR:** `rejection_reason` was persisted but
the student-facing `SubmissionListSerializer` did not expose it and `StudentDashboard.tsx`
did not render it — so "notes the student can see" was not actually met end-to-end. Both
were fixed (serializer field + UI block) and a new end-to-end test now guards it.

A previously-failing Phase 1 test (`test_upload.py::test_missing_file_returns_400_with_exact_copy`)
was also fixed here, since this PR already edits the same serializer — added a `'null'`
error-message key so the student-facing copy fires whether `draft_file` is absent or null.

---

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| TRIAGE-03 | Approval computes estimated guidance duration from symptom weights | SATISFIED | Duration sum in `ApproveSubmissionView`; tests assert 45 and 75 |
| REVIEW-02 | Lecturer approves/rejects/requests revision with a student-visible note | SATISFIED | `RejectSubmissionView` persists `rejection_reason`; approve flips status; tests cover all three actions + guards |
| QUEUE-01 | Approved request gets a queue number and an estimated schedule slot | SATISFIED | `Session` created with `scheduled_at` + `queue_position`; ordering test confirms FIFO placement |

---

## Notes / Follow-ups

- **No formal PLAN.md for Phase 2.** If the team wants full GSD traceability, run `/gsd-plan-phase 2` retroactively, or accept this verification as the closing artifact.
- **Adjacent-phase code shipped in the same commit** (Phase 3 quota/self-cancel, Phase 4 Calendar, Phase 8 stats). Those phases remain open; only the Phase 2 slice is verified here. The quota guard (`test_approval_blocked_when_daily_quota_exceeded`) and self-cancel (`test_queue.py`) are tested opportunistically since the code already exists, but their phases are not closed.
- **Google Calendar** degrades gracefully (`GOOGLE_CALENDAR_ENABLED=false` → no-op) so approval works without OAuth configured; tests run with the integration disabled.

---

*Verified: 2026-06-30*
*Verifier: Claude — retroactive verification against ROADMAP success criteria + new automated tests*
