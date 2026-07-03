# Roadmap: TemuDosen

## Overview

**Revised plan — June 2026:** Due to a hard deadline of 15 July 2026 and a 4-person team (1 effective person-day/day), scope was originally cut to Phases 1–3 for the submission, with Phases 4–8 deferred as documented future work.

**Update — 2026-07-03:** In practice, team members kept building past the cut scope. A post-merge code audit (see `.planning/STATE.md` → Code-Ahead-of-Process Audit) found Phases 3, 4, and 8 are essentially code-complete, and Phases 5 and 7 are partially implemented — none of it went through a formal plan/verification loop, so it's marked code-complete rather than verified below. **Phase 6 (STT, AI Summarization & Logbook) is the only phase with no work at all**, and is now the real blocker to full-scope completion. It also depends on one missing piece of Phase 5 (actual audio capture) that nothing has built yet.

The MVP delivers the full guidance request and queue backbone: a student submits a request with symptoms and a draft PDF, the lecturer approves/rejects with triage-calculated duration, and the student tracks their real-time queue position and can self-cancel. This is a complete, usable flow for the primary actors.

Phases 4, 5, 7, and 8 (Google Calendar sync, session recording, advisory continuity, admin reports) have substantial code already landed — see per-phase status below. Phase 6 (STT/AI logbook) remains untouched.

## Phases

**Phase Numbering:**

- Integer phases (1–8): Planned milestone work
- Decimal phases (e.g. 2.1): Urgent insertions (marked INSERTED)

### In Scope — July 15 Deadline

- [x] **Phase 1: Submission & Triage Foundation** - Student submits guidance request with symptoms + draft PDF; admin configures symptom weights; lecturer views pending requests — COMPLETE (2026-06-25)
- [x] **Phase 2: Approval & Queue Placement** - Lecturer approves/rejects requests; approved requests get a triage-estimated duration and a queue slot — IMPLEMENTED & VERIFIED (2026-06-30, commit 55aefb3 + 02-VERIFICATION.md)
- [x] **Phase 3: Live Queue Management & Quota** - Students see real-time queue status, can self-cancel, and daily lecturer quotas are enforced — CODE-COMPLETE, unverified (2026-07-03 audit: all 3 success criteria have working code; no `03-VERIFICATION.md` yet)

### Built ahead of schedule (unverified) — originally "Deferred — Post July 15"

- [x] **Phase 4: Google Calendar Sync & Graceful Degradation** - Approved/cancelled/rescheduled sessions sync to Google Calendar with local fallback and admin error logs — CODE-COMPLETE, tested (2026-07-03: `test_calendar.py`, 13 tests); no formal verification doc
- [~] **Phase 5: Session Execution with Recording & Consent** - Consent prompt, single "Mulai & Rekam" button (TS1 + audio start), "Selesai" (TS2 + audio stop), T-15 notifications, auto-cancel, online/offline mode — PARTIAL: consent + TS1 + T-15 notification + 30-min auto-cancel done; **no TS2, no actual audio recording**
- [ ] **Phase 6: STT, AI Summarization & Logbook** - Async STT transcription (faster-whisper), LLM summary generation, lecturer review/edit/approve flow, student-visible transcript + summary; fallback to manual notes — **NOT STARTED** (zero code found in 2026-07-03 audit)
- [~] **Phase 7: Advisory Continuity & Campus Logbook Integration** - Per-session advice items, student follow-up marking, lecturer advice history view, Sekawan/KPTI API sync (or CSV/PDF export fallback) — PARTIAL: `ActionItem` model + compliance reporting done; **no campus API sync, no CSV/PDF fallback export**
- [x] **Phase 8: Admin Emergency Controls & Kaprodi Reporting** - Emergency Cancel, Admin Dashboard (all error logs + STT/LLM quota), Kaprodi guidance history + workload + advice-compliance reports — CODE-COMPLETE, unverified (2026-07-03 audit: Emergency Cancel, Admin Dashboard, Kaprodi export/compliance all implemented)

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
  4. Lecturer can view a list of pending guidance requests with each student's symptom and a link/preview to the draft**Plans**: 5 plans (4 waves)

**Wave 1**

- [x] 01-01-PLAN.md — Walking Skeleton: scaffold backend+frontend, CustomUser + session/CSRF auth, seeded admin, test scaffolding (Wave 0)
- [x] 01-02-PLAN.md — Self-registration, pending-approval gate, admin user-approval queue, approved-lecturer dropdown (Wave 1)
- [x] 01-03-PLAN.md — SymptomCategory model + 6-category seed + admin inline-editable weight config (ADMIN-01) (Wave 1)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-04-PLAN.md — Student submission form + validated upload + protected file serving + My Submissions dashboard (TRIAGE-01/02) (Wave 2)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-05-PLAN.md — Lecturer review dashboard: advisee-scoped filterable list + PDF preview, view-only (REVIEW-01) (Wave 3)

### Phase 2: Approval & Queue Placement

**Goal**: A lecturer can act on a pending request, and approval turns it into a triage-estimated, queued guidance slot
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: TRIAGE-03, REVIEW-02, QUEUE-01
**Status**: IMPLEMENTED & VERIFIED (2026-06-30) — see `phases/02-approval-queue-placement/02-VERIFICATION.md`
**Success Criteria** (what must be TRUE):

  1. Lecturer can Approve a pending request, or Reject/Request-Revision with notes the student can see — ✅ VERIFIED
  2. On approval, system calculates an estimated guidance duration from the symptom + admin-configured weight — ✅ VERIFIED
  3. On approval, the student is placed in that lecturer's queue with an assigned queue number and a fixed estimated schedule slot — ✅ VERIFIED

**Plans**: None — Phase 2 was implemented directly in commit 55aefb3 (no formal PLAN.md). Verified retroactively with `apps/bimbingan/tests/` (32 passing tests).

### Phase 3: Live Queue Management & Quota

**Goal**: Students can track and manage their queue position, and lecturers' daily guidance time cannot be over-booked
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: QUEUE-02, QUEUE-03, QUEUE-04
**Status**: CODE-COMPLETE, unverified (2026-07-03 audit) — no formal PLAN.md or VERIFICATION.md exists
**Success Criteria** (what must be TRUE):

  1. Student can view their current queue number, estimated guidance time, and real-time status that updates as the queue progresses — 🟢 CODE PRESENT (`StudentQueue.tsx`, 30s poll)
  2. Student can self-cancel their queue slot at any point before status becomes "Your Turn" — 🟢 CODE PRESENT (`CancelStudentQueueView`)
  3. When a new approval would push a lecturer's remaining daily quota below zero, that approval is rejected with a clear reason — 🟢 CODE PRESENT (`DOSEN_DAILY_QUOTA_MINUTES` check in `ApproveSubmissionView`)

**Plans**: None — implemented directly without a formal PLAN.md, same as Phase 2. Needs a retroactive `03-VERIFICATION.md` (UAT pass) before it can be marked verified.

### Phase 4: Google Calendar Sync & Graceful Degradation

**Goal**: Approved guidance slots automatically appear on both parties' Google Calendar, and the queue/triage core keeps working — with errors visible to Admin — if the integration is unavailable
**Mode:** mvp
**Depends on**: Phase 2, Phase 3
**Requirements**: QUEUE-05, QUEUE-06, ADMIN-03
**Status**: CODE-COMPLETE, tested (2026-07-03) — `backend/apps/bimbingan/tests/test_calendar.py` (13 tests, recovered + adapted this session); no formal PLAN.md or VERIFICATION.md
**Success Criteria** (what must be TRUE):

  1. When a request is approved, system checks the lecturer's Google Calendar free/busy and creates a calendar event for both lecturer and student — 🟢 DONE (`check_free_busy` + async `create_event`, fire-and-forget thread per NFR-01)
  2. When a slot is cancelled or rescheduled, the corresponding calendar event is updated or deleted for both parties — 🟢 DONE (`delete_event` on cancel, `update_event` on queue-compaction reschedule)
  3. If the Calendar API fails, times out, or token has expired, the approval/cancellation still completes locally and the failure is recorded — 🟢 DONE (exceptions caught in `_create_calendar_event_async`, logged as `CALENDAR_ERROR` SystemLog)
  4. Admin can view a log of Calendar integration errors on an Admin Dashboard — 🟢 DONE (`AdminStatsView` recent_errors + `integrations.google_calendar`)

**Plans**: None — implemented directly. Test coverage added 2026-07-03; still needs a formal `04-VERIFICATION.md`/UAT pass. Also includes a lecturer-facing Calendar connect/status page (`LecturerSettings.tsx`, `/dosen/pengaturan`).

### Phase 5: Session Execution with Recording & Consent

**Goal**: Students are alerted as their turn approaches, and lecturers start/end sessions end-to-end with accurate timestamps, audio recording, and an explicit consent gate before any recording begins
**Mode:** mvp
**Depends on**: Phase 3 (queue turn progression drives T-15 notification and auto-cancel)
**Requirements**: SESSION-01, SESSION-02, SESSION-03, SESSION-04, SESSION-05, SESSION-06
**Status**: PARTIAL (2026-07-03 audit) — consent + start-timestamp + notification + auto-cancel done; no session-end tracking and no actual audio capture
**Success Criteria** (what must be TRUE):

  1. Student receives an in-app/email notification ~15 minutes before their estimated turn — 🟢 DONE (`check_h15_notifications`, every 1 min)
  2. Before any recording begins, an explicit consent prompt is displayed to both parties; session proceeds without recording if either party declines — 🟢 DONE (`ConsentModal.tsx` + `Session.consent_given_at/consent_by_dosen/consent_by_mahasiswa`)
  3. Lecturer presses a single "Mulai & Rekam" button that simultaneously logs TS1 and begins audio recording; recording indicator ("Merekam…") is clearly visible — 🟡 PARTIAL: the button logs `ts1` via `startSession()`, but **no audio is actually captured** (no `MediaRecorder`/`getUserMedia` anywhere in the frontend) and there is no "Merekam…" indicator
  4. Lecturer presses "Selesai" to simultaneously stop recording and log TS2; manual result notes are optional — ❌ NOT DONE: no `ts2` field on `Session`, no "Selesai" action/button/endpoint exists anywhere
  5. If a called student's "Mulai & Rekam" hasn't occurred within 30 minutes, that student's slot is automatically cancelled — 🟢 DONE (`check_auto_cancel`, every 5 min, 30-min cutoff)
  6. Lecturer selects Offline/Online; if Online, must attach an external meeting link — 🟢 DONE (`ApproveModal` method radio + required `meeting_link` validation)

**Plans**: None — implemented directly (partially). Remaining gap to close: add `ts2` + a "Selesai" action, and real audio capture/storage. This blocks Phase 6 (nothing to transcribe without an audio file).

### Phase 6: STT, AI Summarization & Logbook

**Goal**: Every completed session with recording automatically produces an editable, lecturer-approved logbook entry via an async STT → LLM summary pipeline; graceful fallback to manual notes if the pipeline fails
**Mode:** mvp
**Depends on**: Phase 5 (recording must exist to transcribe)
**Requirements**: STT-01, STT-02, STT-03, STT-04, STT-05, STT-06, STT-07, ADMIN-05
**Status**: NOT STARTED (2026-07-03 audit) — the only phase with zero code. No whisper/STT, no LLM call, no transcript or summary field on `Session`. Also blocked on Phase 5's missing audio capture.
**Success Criteria** (what must be TRUE):

  1. After a session ends with a recording, the system asynchronously transcribes the audio via self-hosted faster-whisper; transcript is available within ≤2× audio duration for 90% of sessions — ❌ NOT STARTED
  2. System generates a structured AI summary (advice points + improvement notes) from the transcript via an LLM API call after transcript is ready — ❌ NOT STARTED
  3. Lecturer can view, edit, and approve the AI-generated summary and advice items; only approved content is committed to the logbook — ❌ NOT STARTED
  4. Transcript and approved summary are stored linked to the session and student; student can view them after approval — ❌ NOT STARTED
  5. If STT or LLM fails or times out, lecturer sees a manual note editor and the failure is logged to Admin Dashboard — ❌ NOT STARTED
  6. Admin can monitor STT/LLM quota and view failure logs — ❌ NOT STARTED

**Plans**: TBD — this is the real next greenfield phase, and needs Phase 5's audio-capture gap closed first.

### Phase 7: Advisory Continuity & Campus Logbook Integration

**Goal**: Advice items are tracked across sessions (student can mark follow-up, lecturer sees full history), and approved summaries sync to the campus logbook system with a CSV/PDF fallback
**Mode:** mvp
**Depends on**: Phase 6 (advice items come from approved summaries)
**Requirements**: ADVICE-01, ADVICE-02, LOGBOOK-01, LOGBOOK-02, LOGBOOK-03, ADMIN-04
**Status**: PARTIAL (2026-07-03 audit) — advice tracking + compliance reporting done; campus API sync and CSV/PDF fallback missing
**Success Criteria** (what must be TRUE):

  1. Student can mark individual advice items as "addressed" with an optional note/evidence before submitting the next session request — 🟡 PARTIAL: `ActionItem.is_completed` + `CompleteActionItemView` exist, but there's no note/evidence field, just a boolean
  2. Lecturer can view the complete advice history and follow-up status for each advisee student — 🟢 DONE (`KaprodiComplianceView` reports per-mahasiswa/per-dosen compliance rate)
  3. System attempts to sync approved summaries to the campus logbook API (Sekawan/KPTI) when configured; on success, logbook entry ID is stored — ❌ NOT STARTED (no Sekawan/KPTI code anywhere — and nothing to sync yet without Phase 6's summaries)
  4. If the campus API is unavailable or unconfigured, system offers a CSV/PDF export of the summary for manual upload — ❌ NOT STARTED for summaries specifically, though `KaprodiExportView` already does CSV+PDF export for guidance-history/workload data (FR-KP03)
  5. If the campus API call fails or times out, summary remains saved internally, is queued for retry, and error appears in Admin Dashboard — ❌ NOT STARTED
  6. Admin can configure campus logbook API credentials and settings — ❌ NOT STARTED

**Plans**: TBD — the advice/compliance half is essentially done; the campus-logbook-sync half hasn't been started and depends on Phase 6 existing first.

### Phase 8: Admin Emergency Controls & Kaprodi Reporting

**Goal**: Admin has a safety valve for disrupting a lecturer's day, and Kaprodi has a complete digital record — including documentation quality and advice compliance — for accreditation
**Mode:** mvp
**Depends on**: Phase 7 (session records, summaries, and advice tracking must all exist for meaningful reporting)
**Requirements**: ADMIN-02, REPORT-01, REPORT-02, REPORT-03
**Status**: CODE-COMPLETE, unverified (2026-07-03 audit) — no formal PLAN.md or VERIFICATION.md
**Success Criteria** (what must be TRUE):

  1. Admin can trigger an Emergency Cancel that clears all of a specific lecturer's remaining queued slots for the current day — 🟢 DONE (`AdminEmergencyCancelView`)
  2. Kaprodi can view a digitized guidance history (timestamps, durations, symptoms, approved summaries) across all lecturers — 🟡 PARTIAL: history/timestamps/durations/symptoms all present (`KaprodiStatsView`/`KaprodiExportView`); "approved summaries" column will stay empty until Phase 6 exists
  3. Kaprodi can view each lecturer's workload summary (sessions completed, total time) suitable for accreditation reporting — 🟢 DONE (`KaprodiStatsView`, CSV/PDF export via `KaprodiExportView`)
  4. Kaprodi can view advice follow-up compliance rates per lecturer/student — 🟢 DONE (`KaprodiComplianceView`)

**Plans**: None — implemented directly. Needs a retroactive `08-VERIFICATION.md`/UAT pass; SC2 will only be fully true once Phase 6 produces summaries to show.

---

## Progress

**Deadline: 15 July 2026 | Team: 4 people, all working daily**
**Execution Order (MVP scope):** 1 → 2 → 3 — in practice, code for 4/5/7/8 landed early too; see 2026-07-03 audit note above.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Submission & Triage Foundation | 5/5 | ✅ Complete, verified | 2026-06-25 |
| 2. Approval & Queue Placement | n/a (direct) | ✅ Implemented & Verified (32 tests) | 2026-06-30 |
| 3. Live Queue Management & Quota | 0/TBD | 🟢 Code-complete, unverified | - |
| 4. Google Calendar Sync & Graceful Degradation | 0/TBD | 🟢 Code-complete, tested (13 tests) | - |
| 5. Session Execution with Recording & Consent | 0/TBD | 🟡 Partial — no TS2/no audio capture | - |
| 6. STT, AI Summarization & Logbook | 0/TBD | ❌ Not started | - |
| 7. Advisory Continuity & Campus Logbook Integration | 0/TBD | 🟡 Partial — no campus API sync | - |
| 8. Admin Emergency Controls & Kaprodi Reporting | 0/TBD | 🟢 Code-complete, unverified | - |

**Team assignments:**
- Person A → Auth & User Management (registration, admin approval, role redirect)
- Person B → Symptom Config & Submission (symptom weights, submission form, My Submissions)
- Person C → Approval & Triage (approve/reject, duration calc, QueueSlot model)
- Person D → Queue Engine (queue status, self-cancel, quota enforcement)

**Sprint timeline:**
- Jun 25–Jul 1: A+B finish Phase 1 remaining work; C+D design Phase 2 models
- Jul 2–Jul 8: A+B join Phase 2; D builds queue engine foundation
- Jul 9–Jul 15: All 4 on Phase 3 + integration testing + buffer
