# Roadmap: TemuDosen

## Overview

TemuDosen v2.2 builds in eight phases as a chain of usable vertical slices. The first four phases deliver the scheduling and queue backbone (submission triage, approval, live queue, Google Calendar sync) — largely unchanged from v1.0. Phase 5 adds the session execution flow with the combined "Mulai & Rekam" button and recording consent. Phase 6 implements the STT + AI summarization pipeline that turns recordings into an editable logbook entry. Phase 7 adds advisory continuity (follow-up tracking across sessions) and campus logbook integration (Sekawan/KPTI). Phase 8 closes the loop with admin emergency controls and Kaprodi reporting including advice-compliance metrics.

Every phase leaves the system in a state a real actor could use. The documentation and continuity features (phases 6–7) build directly on top of the queue infrastructure (phases 1–5), so no re-architecture is needed at the boundary.

## Phases

**Phase Numbering:**
- Integer phases (1–8): Planned milestone work
- Decimal phases (e.g. 2.1): Urgent insertions (marked INSERTED)

- [ ] **Phase 1: Submission & Triage Foundation** - Student submits guidance request with symptoms + draft PDF; admin configures symptom weights; lecturer views pending requests
- [ ] **Phase 2: Approval & Queue Placement** - Lecturer approves/rejects requests; approved requests get a triage-estimated duration and a queue slot
- [ ] **Phase 3: Live Queue Management & Quota** - Students see real-time queue status, can self-cancel, and daily lecturer quotas are enforced
- [ ] **Phase 4: Google Calendar Sync & Graceful Degradation** - Approved/cancelled/rescheduled sessions sync to Google Calendar with local fallback and admin error logs
- [ ] **Phase 5: Session Execution with Recording & Consent** - Consent prompt, single "Mulai & Rekam" button (TS1 + audio start), "Selesai" (TS2 + audio stop), T-15 notifications, auto-cancel, online/offline mode
- [ ] **Phase 6: STT, AI Summarization & Logbook** - Async STT transcription (faster-whisper), LLM summary generation, lecturer review/edit/approve flow, student-visible transcript + summary; fallback to manual notes
- [ ] **Phase 7: Advisory Continuity & Campus Logbook Integration** - Per-session advice items, student follow-up marking, lecturer advice history view, Sekawan/KPTI API sync (or CSV/PDF export fallback)
- [ ] **Phase 8: Admin Emergency Controls & Kaprodi Reporting** - Emergency Cancel, Admin Dashboard (all error logs + STT/LLM quota), Kaprodi guidance history + workload + advice-compliance reports

---

## Phase Details

### Phase 1: Submission & Triage Foundation
**Goal**: A student can submit a guidance request (symptoms + draft PDF) that is validated and visible to their lecturer, with admin-configured symptom weights in place that later drive the triage calculation
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: TRIAGE-01, TRIAGE-02, REVIEW-01, ADMIN-01
**Success Criteria** (what must be TRUE):
  1. Student can select an "Academic Symptom" from a dropdown and upload a draft PDF (max 5MB) to submit a guidance request
  2. A submission missing the file or symptom is rejected with a clear, specific error
  3. Admin can set/update a duration weight (minutes) for each "Academic Symptom" category, persisting for use in approval
  4. Lecturer can view a list of pending guidance requests with each student's symptom and a link/preview to the draft
**Plans**: TBD

### Phase 2: Approval & Queue Placement
**Goal**: A lecturer can act on a pending request, and approval turns it into a triage-estimated, queued guidance slot
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: TRIAGE-03, REVIEW-02, QUEUE-01
**Success Criteria** (what must be TRUE):
  1. Lecturer can Approve a pending request, or Reject/Request-Revision with notes the student can see
  2. On approval, system calculates an estimated guidance duration from the symptom + admin-configured weight
  3. On approval, the student is placed in that lecturer's queue with an assigned queue number and a fixed estimated schedule slot
**Plans**: TBD

### Phase 3: Live Queue Management & Quota
**Goal**: Students can track and manage their queue position, and lecturers' daily guidance time cannot be over-booked
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: QUEUE-02, QUEUE-03, QUEUE-04
**Success Criteria** (what must be TRUE):
  1. Student can view their current queue number, estimated guidance time, and real-time status that updates as the queue progresses
  2. Student can self-cancel their queue slot at any point before status becomes "Your Turn"
  3. When a new approval would push a lecturer's remaining daily quota below zero, that approval is rejected with a clear reason
**Plans**: TBD

### Phase 4: Google Calendar Sync & Graceful Degradation
**Goal**: Approved guidance slots automatically appear on both parties' Google Calendar, and the queue/triage core keeps working — with errors visible to Admin — if the integration is unavailable
**Mode:** mvp
**Depends on**: Phase 2, Phase 3
**Requirements**: QUEUE-05, QUEUE-06, ADMIN-03
**Success Criteria** (what must be TRUE):
  1. When a request is approved, system checks the lecturer's Google Calendar free/busy and creates a calendar event for both lecturer and student
  2. When a slot is cancelled or rescheduled, the corresponding calendar event is updated or deleted for both parties
  3. If the Calendar API fails, times out, or token has expired, the approval/cancellation still completes locally and the failure is recorded
  4. Admin can view a log of Calendar integration errors on an Admin Dashboard
**Plans**: TBD

### Phase 5: Session Execution with Recording & Consent
**Goal**: Students are alerted as their turn approaches, and lecturers start/end sessions end-to-end with accurate timestamps, audio recording, and an explicit consent gate before any recording begins
**Mode:** mvp
**Depends on**: Phase 3 (queue turn progression drives T-15 notification and auto-cancel)
**Requirements**: SESSION-01, SESSION-02, SESSION-03, SESSION-04, SESSION-05, SESSION-06
**Success Criteria** (what must be TRUE):
  1. Student receives an in-app/email notification ~15 minutes before their estimated turn
  2. Before any recording begins, an explicit consent prompt is displayed to both parties; session proceeds without recording if either party declines
  3. Lecturer presses a single "Mulai & Rekam" button that simultaneously logs TS1 and begins audio recording; recording indicator ("Merekam…") is clearly visible
  4. Lecturer presses "Selesai" to simultaneously stop recording and log TS2; manual result notes are optional
  5. If a called student's "Mulai & Rekam" hasn't occurred within 30 minutes, that student's slot is automatically cancelled
  6. Lecturer selects Offline/Online; if Online, must attach an external meeting link
**Plans**: TBD

### Phase 6: STT, AI Summarization & Logbook
**Goal**: Every completed session with recording automatically produces an editable, lecturer-approved logbook entry via an async STT → LLM summary pipeline; graceful fallback to manual notes if the pipeline fails
**Mode:** mvp
**Depends on**: Phase 5 (recording must exist to transcribe)
**Requirements**: STT-01, STT-02, STT-03, STT-04, STT-05, STT-06, STT-07, ADMIN-05
**Success Criteria** (what must be TRUE):
  1. After a session ends with a recording, the system asynchronously transcribes the audio via self-hosted faster-whisper; transcript is available within ≤2× audio duration for 90% of sessions
  2. System generates a structured AI summary (advice points + improvement notes) from the transcript via an LLM API call after transcript is ready
  3. Lecturer can view, edit, and approve the AI-generated summary and advice items; only approved content is committed to the logbook
  4. Transcript and approved summary are stored linked to the session and student; student can view them after approval
  5. If STT or LLM fails or times out, lecturer sees a manual note editor and the failure is logged to Admin Dashboard
  6. Admin can monitor STT/LLM quota and view failure logs
**Plans**: TBD

### Phase 7: Advisory Continuity & Campus Logbook Integration
**Goal**: Advice items are tracked across sessions (student can mark follow-up, lecturer sees full history), and approved summaries sync to the campus logbook system with a CSV/PDF fallback
**Mode:** mvp
**Depends on**: Phase 6 (advice items come from approved summaries)
**Requirements**: ADVICE-01, ADVICE-02, LOGBOOK-01, LOGBOOK-02, LOGBOOK-03, ADMIN-04
**Success Criteria** (what must be TRUE):
  1. Student can mark individual advice items as "addressed" with an optional note/evidence before submitting the next session request
  2. Lecturer can view the complete advice history and follow-up status for each advisee student
  3. System attempts to sync approved summaries to the campus logbook API (Sekawan/KPTI) when configured; on success, logbook entry ID is stored
  4. If the campus API is unavailable or unconfigured, system offers a CSV/PDF export of the summary for manual upload
  5. If the campus API call fails or times out, summary remains saved internally, is queued for retry, and error appears in Admin Dashboard
  6. Admin can configure campus logbook API credentials and settings
**Plans**: TBD

### Phase 8: Admin Emergency Controls & Kaprodi Reporting
**Goal**: Admin has a safety valve for disrupting a lecturer's day, and Kaprodi has a complete digital record — including documentation quality and advice compliance — for accreditation
**Mode:** mvp
**Depends on**: Phase 7 (session records, summaries, and advice tracking must all exist for meaningful reporting)
**Requirements**: ADMIN-02, REPORT-01, REPORT-02, REPORT-03
**Success Criteria** (what must be TRUE):
  1. Admin can trigger an Emergency Cancel that clears all of a specific lecturer's remaining queued slots for the current day
  2. Kaprodi can view a digitized guidance history (timestamps, durations, symptoms, approved summaries) across all lecturers
  3. Kaprodi can view each lecturer's workload summary (sessions completed, total time) suitable for accreditation reporting
  4. Kaprodi can view advice follow-up compliance rates per lecturer/student
**Plans**: TBD

---

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Submission & Triage Foundation | 0/TBD | Not started | - |
| 2. Approval & Queue Placement | 0/TBD | Not started | - |
| 3. Live Queue Management & Quota | 0/TBD | Not started | - |
| 4. Google Calendar Sync & Graceful Degradation | 0/TBD | Not started | - |
| 5. Session Execution with Recording & Consent | 0/TBD | Not started | - |
| 6. STT, AI Summarization & Logbook | 0/TBD | Not started | - |
| 7. Advisory Continuity & Campus Logbook Integration | 0/TBD | Not started | - |
| 8. Admin Emergency Controls & Kaprodi Reporting | 0/TBD | Not started | - |
