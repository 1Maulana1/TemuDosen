# Roadmap: TemuDosen

## Overview

TemuDosen replaces the paper-sheet hallway queue for academic/thesis guidance with a digital triage-and-queue system. The build proceeds as a chain of usable vertical slices: first the submission and weighted-triage foundation (with the admin config that drives it), then lecturer approval that turns a submission into a scheduled queue slot, then live queue management with self-cancel and quota enforcement, then Google Calendar sync with graceful degradation, then real-time session execution (Start/End, notifications, auto-cancel, online/offline mode), and finally the admin Emergency Cancel control plus Kaprodi reporting that closes the loop for accreditation. Each phase leaves the system in a state a real student, lecturer, admin, or Kaprodi could actually use.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Submission & Triage Foundation** - Student submits a guidance request with symptoms + draft PDF; admin configures symptom duration weights; lecturer can view pending requests
- [ ] **Phase 2: Approval & Queue Placement** - Lecturer approves/rejects requests; approved requests get a triage-calculated duration and a queue slot
- [ ] **Phase 3: Live Queue Management & Quota** - Students see real-time queue status, can self-cancel, and daily lecturer quotas are enforced
- [ ] **Phase 4: Google Calendar Sync & Graceful Degradation** - Approved/cancelled/rescheduled sessions sync to Google Calendar for both parties, with local fallback and admin-visible error logs if the integration fails
- [ ] **Phase 5: Session Execution & Notifications** - Students get T-15 alerts; lecturers run sessions with Start/End, result notes, online/offline mode, and no-show auto-cancel
- [ ] **Phase 6: Admin Emergency Controls & Kaprodi Reporting** - Admin can clear a lecturer's queue in an emergency; Kaprodi can view guidance history and lecturer workload for accreditation

## Phase Details

### Phase 1: Submission & Triage Foundation
**Goal**: A student can submit a guidance request (symptoms + draft PDF) that is validated and visible to their lecturer, with the admin-configured symptom weights in place that later drive the triage calculation
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: TRIAGE-01, TRIAGE-02, ADMIN-01, REVIEW-01
**Success Criteria** (what must be TRUE):
  1. Student can select an "Academic Symptom" from a dropdown and upload a draft PDF (max 5MB) to submit a guidance request
  2. A submission missing the file or symptom selection is rejected with a clear, specific error instead of being silently accepted
  3. Admin can set/update a duration weight (in minutes) for each "Academic Symptom" category, and these weights persist for use in approval
  4. Lecturer can view a list of pending guidance requests, each showing the student's stated symptom and a link/preview to the draft attachment
**Plans**: TBD

### Phase 2: Approval & Queue Placement
**Goal**: A lecturer can act on a pending request, and approval turns it into a triage-estimated, queued guidance slot
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: TRIAGE-03, REVIEW-02, QUEUE-01
**Success Criteria** (what must be TRUE):
  1. Lecturer can Approve a pending request, or Reject/Request-Revision with notes that the student can see
  2. On approval, the system calculates an estimated guidance duration from the request's symptom and the admin-configured weight (Phase 1)
  3. On approval, the student is placed into that lecturer's queue with an assigned queue number and a fixed estimated schedule slot
**Plans**: TBD

### Phase 3: Live Queue Management & Quota
**Goal**: Students can track and manage their place in the queue, and lecturers' daily guidance time cannot be over-booked
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: QUEUE-02, QUEUE-03, QUEUE-04
**Success Criteria** (what must be TRUE):
  1. Student can view their current queue number, estimated guidance time, and real-time status (e.g. Waiting / Your Turn) that updates as the queue progresses
  2. Student can self-cancel their queued slot at any point before their status becomes "Your Turn"
  3. When a lecturer's remaining daily guidance-time quota for a date would be exceeded by approving a new request, that approval is rejected with a clear reason
**Plans**: TBD

### Phase 4: Google Calendar Sync & Graceful Degradation
**Goal**: Approved guidance slots automatically appear on both the lecturer's and student's Google Calendar, and the queue/triage core keeps working — with errors visible to Admin — if that integration is unavailable
**Mode:** mvp
**Depends on**: Phase 2 (queue placement must exist to have something to sync), Phase 3 (cancellation flow must exist to sync deletions)
**Requirements**: QUEUE-05, QUEUE-06, ADMIN-03
**Success Criteria** (what must be TRUE):
  1. When a request is approved, the system checks the lecturer's Google Calendar free/busy before finalizing the slot and creates a calendar event for both lecturer and student
  2. When a queued slot is cancelled or rescheduled, the corresponding calendar event(s) are updated or deleted for both parties
  3. If the Google Calendar API fails, times out, or a lecturer's token has expired, the approval/cancellation still completes locally (queue and triage remain usable) and the failure is recorded
  4. Admin can view a log of integration errors (e.g. Calendar failures/timeouts/token issues) on an Admin Dashboard
**Plans**: TBD

### Phase 5: Session Execution & Notifications
**Goal**: Students are alerted as their turn approaches, and lecturers run the actual guidance session end-to-end with accurate timestamps, mode, and result notes
**Mode:** mvp
**Depends on**: Phase 3 (queue status/turn progression must exist to know when to notify or call a student)
**Requirements**: SESSION-01, SESSION-02, SESSION-03, SESSION-04, SESSION-05
**Success Criteria** (what must be TRUE):
  1. Student receives an in-app/email notification roughly 15 minutes before their estimated turn
  2. Lecturer can press "Start Session" to record the real session start timestamp for the student currently called
  3. Lecturer can press "End Session", is required to enter "Guidance Result Notes", and the real end timestamp is recorded
  4. If a called student's "Start Session" hasn't happened within 30 minutes, that student's slot is automatically cancelled
  5. Lecturer selects Offline or Online for the session, and for Online must attach an external meeting link
**Plans**: TBD

### Phase 6: Admin Emergency Controls & Kaprodi Reporting
**Goal**: Admin has a safety-valve for disrupting a lecturer's day, and Kaprodi has a digital record of guidance activity for accreditation
**Mode:** mvp
**Depends on**: Phase 5 (session records must exist for meaningful reporting; queue must exist for emergency clearing)
**Requirements**: ADMIN-02, REPORT-01, REPORT-02
**Success Criteria** (what must be TRUE):
  1. Admin can trigger an Emergency Cancel that clears all of a specific lecturer's remaining queued slots for the current day
  2. Kaprodi can view a digitized history of guidance sessions (timestamps, durations, symptoms, result notes) across all lecturers
  3. Kaprodi can view each lecturer's workload summary (sessions completed, total time spent) suitable for accreditation reporting
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Submission & Triage Foundation | 0/TBD | Not started | - |
| 2. Approval & Queue Placement | 0/TBD | Not started | - |
| 3. Live Queue Management & Quota | 0/TBD | Not started | - |
| 4. Google Calendar Sync & Graceful Degradation | 0/TBD | Not started | - |
| 5. Session Execution & Notifications | 0/TBD | Not started | - |
| 6. Admin Emergency Controls & Kaprodi Reporting | 0/TBD | Not started | - |
