# Requirements: TemuDosen

**Defined:** 2026-06-12
**Updated:** 2026-07-06 (synced against actual implementation across Phases 2–8; see `.planning/STATE.md` Code-Ahead-of-Process Audit and `.planning/phases/06-*/06-VERIFICATION.md`)
**Core Value:** Turn ephemeral guidance conversations into a permanent logbook — automated STT → AI summary → one-tap approval, while cutting student wait time from ~120 min to <30 min.

## v1 Requirements

### Submission & Triage

- [x] **TRIAGE-01**: Student can submit a guidance request by selecting "Academic Symptoms" from a dropdown and uploading a draft PDF (max 5MB) — implemented in 01-04
- [x] **TRIAGE-02**: System validates the draft file and symptom form together on submit, rejecting incomplete submissions with a clear error — implemented in 01-04
- [x] **TRIAGE-03**: System calculates an estimated guidance duration from weighted "Academic Symptoms" when the lecturer approves a request — Phase 2, verified `02-VERIFICATION.md`

### Lecturer Review

- [x] **REVIEW-01**: Lecturer can view pending guidance requests, including the student's stated symptoms and draft attachment — implemented in 01-05
- [x] **REVIEW-02**: Lecturer can Approve a request, or Reject/Request-Revision with notes returned to the student — Phase 2, verified `02-VERIFICATION.md`

### Queue & Scheduling

- [x] **QUEUE-01**: On approval, student is placed into the lecturer's queue with a queue number and a fixed estimated schedule — Phase 2, verified
- [x] **QUEUE-02**: Student can view real-time queue status (Waiting / Your Turn / etc.) and estimated guidance time — Phase 3, verified `03-VERIFICATION.md`
- [x] **QUEUE-03**: Student can self-cancel their queue slot before status becomes "Your Turn" — Phase 3, verified
- [x] **QUEUE-04**: System enforces each lecturer's daily guidance-time quota, rejecting approvals that would push that day's total over the quota — Phase 3, verified
- [x] **QUEUE-05**: System checks the lecturer's Google Calendar free/busy and creates/updates/deletes a calendar event (for lecturer and student) on approval, cancellation, or reschedule — Phase 4, verified `04-VERIFICATION.md`
- [x] **QUEUE-06**: If the Google Calendar integration fails, times out, or tokens expire, the queue keeps working on local data and the error is logged to the Admin Dashboard (graceful degradation) — Phase 4, verified

### Session Execution (Updated v2.1 / v2.2)

- [x] **SESSION-01**: Student receives a notification (in-app/email) when their estimated turn is ~15 minutes away — Phase 5, verified `05-VERIFICATION.md` (re-verified 6/6, 2026-07-04)
- [x] **SESSION-02** *(revised)*: Before the session begins, an explicit recording consent prompt is shown; both parties must consent for recording to proceed; session can still run without recording if consent is declined — Phase 5, verified
- [x] **SESSION-03** *(revised)*: Lecturer presses a single "Mulai & Rekam" button that simultaneously records the session start timestamp (TS1) and begins audio recording — Phase 5, verified (implemented + `useMediaRecorder.test.ts`); real-mic cross-browser check still open as non-blocking human_verification
- [x] **SESSION-04** *(revised)*: Lecturer presses "Selesai" to simultaneously stop recording and record the session end timestamp (TS2); manual result notes are optional (AI summary serves this role) — Phase 5, verified (`CompleteSessionView`, `test_session_execution.py`)
- [x] **SESSION-05**: System auto-cancels a student's queue slot if "Mulai & Rekam" hasn't occurred within 30 minutes of being called — Phase 5, verified
- [x] **SESSION-06**: Lecturer selects Offline/Online for the session; if Online, attaches an external meeting link — Phase 5, verified

### STT & AI Summarization

- [x] **STT-01**: System transcribes session audio to text via self-hosted STT (faster-whisper large-v3-turbo) asynchronously after session ends — Phase 6, implemented (`apps/logbook/services/stt.py`, `tasks.transcribe_session` via Celery); dispatched from `apps/bimbingan/views.py` `CompleteSessionView`
- [~] **STT-02**: Transcript is available for review within ≤2× audio duration for 90% of sessions; UI is not blocked during processing — mechanism is async/non-blocking (Celery task, `pipeline_status` polling), but the ≤2×/90% performance target itself has never been measured or load-tested
- [x] **STT-03**: System generates a structured AI summary (advice points + improvement notes) from the transcript via LLM API after transcript is ready — Phase 6, implemented (`services/summarizer.py`, Anthropic forced tool-call + Pydantic schema + groundedness flagging)
- [x] **STT-04**: Lecturer can review, edit, and approve the AI-generated summary and advice items before they are committed to the logbook — `ApproveLogbookView`/`RejectLogbookView` + `LecturerSessionDetail.tsx`/`RejectLogbookModal.tsx`. Fixed 2026-07-06: added 9 tests for the previously-untested approve endpoint, and fixed a frontend bug where the AI-draft approve path silently sent `{manual_notes: text}` instead of the structured edited summary (`textToSummary()` added)
- [x] **STT-05**: Approved summary, transcript, and advice items are saved and linked to the session and the student — transcript + summary saved and linked via `SessionLogbook` (OneToOne on `Session`). Fixed 2026-07-06: `ApproveLogbookView.post()` now calls `_create_action_items_from_summary()`, splitting approved `advice_points`/`improvement_notes` into `ActionItem` rows — previously this never happened despite `06-BREAKDOWN.md` calling for it
- [x] **STT-06**: Student can view their approved transcript and summary after lecturer approval — Phase 6, implemented (`StudentLogbookView` + `StudentSessionDetail.tsx`), tested (`test_student_sees_summary_after_approval`)
- [x] **STT-07**: If STT or LLM fails or times out, system provides a manual note editor as fallback and logs the failure to Admin Dashboard (graceful degradation) — Phase 6, implemented (`ManualNotesView`, `RejectLogbookView`, `SystemLog` events), tested

### Advisory Continuity

- [x] **ADVICE-01**: Student can mark individual advice items as "addressed" (with optional note/evidence) — done: UI built 2026-07-06 (`LecturerSessionDetail.tsx` adds advice, `StudentSessionDetail.tsx` views + "Tandai Selesai", fetched independently of logbook-approval status). Optional note/evidence field added 2026-07-07: `ActionItem.completion_note` (migration 0009), `CompleteActionItemView` accepts an optional `note`, surfaced in the student's mark-done UI + shown to the lecturer (session detail + advice history). 3 backend + 1 frontend tests
- [x] **ADVICE-02**: Lecturer can view the complete advice history and follow-up status for each advisee student — done 2026-07-06: `LecturerAdviceHistoryView` (GET `/api/queue/lecturer/advice-history/`, IsLecturer) + `LecturerAdviceHistory` page (`/dosen/saran`), advice grouped per advisee with compliance rate; 6 backend + 2 frontend tests. Distinct from the ketua-jurusan-only `KetuaJurusanComplianceView`

### Campus Logbook Integration

- [x] **LOGBOOK-01**: System syncs approved summaries to the campus logbook API (Sekawan/KPTI) when the API is available — done 2026-07-06: `apps/logbook/services/campus_logbook.py` decoupled `LogbookAdapter` (Sekawan/KPTI HTTP adapters per TECH-SPEC §2) + `build_payload`; `sync_logbook()` fired on approve, `campus_entry_id` stored on success. Real HTTP only when `CAMPUS_LOGBOOK_ENABLED`+configured (default off)
- [x] **LOGBOOK-02**: If campus API is unavailable, system provides CSV/PDF export of the summary as a manual-upload fallback — done 2026-07-06: `LogbookExportView` (GET `/api/logbook/<id>/export/?format=csv|pdf`) exports the exact campus payload; download links + hint surfaced on `LecturerSessionDetail`
- [x] **LOGBOOK-03**: If campus logbook API call fails or times out, summary remains saved internally, is queued for retry, and error is logged to Admin Dashboard (graceful degradation) — done 2026-07-06: failures mark `pending_retry`→`failed` + log `CAMPUS_LOGBOOK_ERROR`; `retry_campus_logbook_sync` scheduler job (10 min); `AdminStatsView.integrations.campus_logbook` reports synced/pending/failed counts

### Admin & Configuration

- [x] **ADMIN-01**: Admin configures per-"Symptom" duration weights at the start of each semester
- [x] **ADMIN-02**: Admin can trigger an Emergency Cancel that clears a lecturer's remaining queue for the day — Phase 8, verified `08-VERIFICATION.md`
- [x] **ADMIN-03**: Admin can view integration error logs (Google Calendar failures) on an Admin Dashboard — Phase 4, verified
- [x] **ADMIN-04** *(new)*: Admin configures campus logbook API credentials and integration settings (Sekawan/KPTI) — done 2026-07-06: `CampusLogbookConfig` singleton (encrypted token) + `CampusLogbookConfigView` (GET/PUT `/api/logbook/admin/campus-config/`, IsAdmin); `effective_config()` lets the DB row override `CAMPUS_LOGBOOK_*` settings at runtime; AdminDashboard config card
- [x] **ADMIN-05** *(new)*: Admin can monitor STT/LLM service quota usage and review failure logs — Phase 6, implemented (`AdminStatsView.stt_llm`: monthly cost, transcription/summary success counts, failure-event log; surfaced in `AdminDashboard.tsx`)

### Reporting

- [x] **REPORT-01**: Kaprodi can view digitized guidance history (timestamps, durations, symptoms, summaries) across all lecturers — done 2026-07-07: `KetuaJurusanExportView` now joins `SessionLogbook` and emits a "Ringkasan Disetujui" column via `_approved_summary_text()` (approved summary as text; a status label when not yet approved). Timestamps/durations/symptoms already present. 2 new tests
- [x] **REPORT-02**: Kaprodi can view each lecturer's workload summary (sessions completed, total time) for accreditation reporting — now fully satisfied: `sesi_selesai` correctly counts real `DONE` sessions once Phase 5's "Selesai" action closed (2026-07-04); `test_admin.py`'s regression guard was updated to assert a real completed session is counted. (ROADMAP.md's older "structurally always 0" note for this SC is stale — flagged for correction there too.)
- [x] **REPORT-03** *(new)*: Kaprodi can view advice follow-up compliance rates per lecturer/student — mechanism verified (`KetuaJurusanComplianceView`, tested with real data); now backed by real data since Phase 7's advice UI (ADVICE-01/02) lets lecturers create and students complete advice items end-to-end

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Communication

- **VIDEO-01**: In-app/native video conferencing integration (Zoom/Meet) instead of external link field
- **NOTIF-01**: Dedicated native push-notification gateway (beyond in-app/email T-15 alerts)

### Academic Workflows

- **DEFENSE-01**: Scheduling for thesis defense exams involving multiple examiners simultaneously
- **PLAG-01**: Plagiarism-check integration (Turnitin/Grammarly) on uploaded drafts

### Platform

- **MOBILE-01**: Native mobile apps (Android/iOS)

### AI Enhancements

- **DIAR-01**: Speaker diarization — automatic separation of lecturer vs. student speech in transcript
- **SCORE-01**: AI-based quality scoring of guidance sessions

## Out of Scope

| Feature | Reason |
|---------|--------|
| Plagiarism checking (Turnitin/Grammarly) | Separate concern from scheduling/documentation |
| In-app/native video conferencing | MVP only needs an external meeting link/URL field |
| Native push-notification gateway | T-15 alerts ship via in-app/email for MVP |
| Multi-examiner thesis defense scheduling | Different workflow (group vs. 1:1 advisor sessions) |
| Native mobile apps (Android/iOS) | Responsive PWA (360px+) covers target devices |
| Speaker diarization | Merged transcript is sufficient for MVP; diarization is complex and error-prone |
| AI quality scoring of sessions | Out of scope per PRD v2.2 explicit exclusion |

> Note (2026-07-06, resolved 2026-07-10): a `JitsiVideoProvider`/`VideoProvider` component landed as part of the Phase 6 pull despite VIDEO-01 being out of scope for v1. Confirmed via code read: it **is** live-wired into the Online session flow (`LecturerDashboard.tsx`, `LecturerQueue.tsx`, `StudentQueue.tsx`, gated on `method === 'online'`), not dead code or a spike.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRIAGE-01 | Phase 1 | Complete (01-04) |
| TRIAGE-02 | Phase 1 | Complete (01-04) |
| TRIAGE-03 | Phase 2 | Complete |
| REVIEW-01 | Phase 1 | Complete (01-05) |
| REVIEW-02 | Phase 2 | Complete |
| QUEUE-01 | Phase 2 | Complete |
| QUEUE-02 | Phase 3 | Complete |
| QUEUE-03 | Phase 3 | Complete |
| QUEUE-04 | Phase 3 | Complete |
| QUEUE-05 | Phase 4 | Complete |
| QUEUE-06 | Phase 4 | Complete |
| SESSION-01 | Phase 5 | Complete |
| SESSION-02 | Phase 5 | Complete |
| SESSION-03 | Phase 5 | Complete (manual real-mic browser check open, non-blocking) |
| SESSION-04 | Phase 5 | Complete |
| SESSION-05 | Phase 5 | Complete |
| SESSION-06 | Phase 5 | Complete |
| STT-01 | Phase 6 | Complete |
| STT-02 | Phase 6 | Partial (perf target unmeasured) |
| STT-03 | Phase 6 | Complete |
| STT-04 | Phase 6 | Complete (fixed 2026-07-06) |
| STT-05 | Phase 6 | Complete (fixed 2026-07-06) |
| STT-06 | Phase 6 | Complete |
| STT-07 | Phase 6 | Complete |
| ADVICE-01 | Phase 7 | Partial (UI built 2026-07-06; still no note/evidence field) |
| ADVICE-02 | Phase 7 | Not started |
| LOGBOOK-01 | Phase 7 | Not started |
| LOGBOOK-02 | Phase 7 | Not started (for summaries) |
| LOGBOOK-03 | Phase 7 | Not started |
| ADMIN-01 | Phase 1 | Complete |
| ADMIN-02 | Phase 8 | Complete |
| ADMIN-03 | Phase 4 | Complete |
| ADMIN-04 | Phase 7 | Not started |
| ADMIN-05 | Phase 6 | Complete |
| REPORT-01 | Phase 8 | Partial (summaries column missing) |
| REPORT-02 | Phase 8 | Complete |
| REPORT-03 | Phase 8 | Complete (mechanism; data-starved by ADVICE gap) |

**Coverage:**
- v1 requirements: 37 total (recounted 2026-07-06 — the previous "36" undercounted by one)
- Complete: 29 (STT-04 and STT-05 fixed and moved from Partial 2026-07-06, same day as the initial resync)
- Partial: 3 (STT-02, ADVICE-01, REPORT-01)
- Not started: 5 (ADVICE-02, LOGBOOK-01, LOGBOOK-02, LOGBOOK-03, ADMIN-04)
- Unmapped: 0

---
*Requirements defined: 2026-06-12*
*Last updated: 2026-07-06 (two passes same day) — first a full resync against actual code (Phases 2-8, not just Phase 6); then STT-04/STT-05 were actually implemented and fixed (ActionItem wiring + a frontend payload-shape bug), moving them from Partial to Complete. Previous update (2026-06-21) predated every phase verification pass and had gone stale.*
