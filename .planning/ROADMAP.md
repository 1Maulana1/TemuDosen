# Roadmap: TemuDosen

## Overview

**Revised plan — June 2026:** Due to a hard deadline of 15 July 2026 and a 4-person team (1 effective person-day/day), scope was originally cut to Phases 1–3 for the submission, with Phases 4–8 deferred as documented future work.

**Update — 2026-07-03:** In practice, team members kept building past the cut scope. A post-merge code audit (see `.planning/STATE.md` → Code-Ahead-of-Process Audit) found Phases 3–5, 7, and 8 all had real code, without going through a formal plan/verification loop. All of Phases 3–8 have now been formally verified (retroactive `0N-VERIFICATION.md` reports, new test coverage, and several real bugs/gaps found and fixed along the way — see their sections below). **Phase 6 (STT, AI Summarization & Logbook) is the only phase with no work at all**, confirmed by `06-VERIFICATION.md`, and is now the real blocker to full-scope completion. It also depends on one missing piece of Phase 5 (actual audio capture) that nothing has built yet, and Phase 7's advice-tracking half turned out to have no frontend UI at all despite a working, tested backend.

The MVP delivers the full guidance request and queue backbone: a student submits a request with symptoms and a draft PDF, the lecturer approves/rejects with triage-calculated duration, and the student tracks their real-time queue position and can self-cancel. This is a complete, usable flow for the primary actors.

Phases 4, 5, 7, and 8 (Google Calendar sync, session recording, advisory continuity, admin reports) have substantial code already landed — see per-phase status below. Phase 6 (STT/AI logbook) remains untouched.

## Phases

**Phase Numbering:**

- Integer phases (1–8): Planned milestone work
- Decimal phases (e.g. 2.1): Urgent insertions (marked INSERTED)

### In Scope — July 15 Deadline

- [x] **Phase 1: Submission & Triage Foundation** - Student submits guidance request with symptoms + draft PDF; admin configures symptom weights; lecturer views pending requests — COMPLETE (2026-06-25)
- [x] **Phase 2: Approval & Queue Placement** - Lecturer approves/rejects requests; approved requests get a triage-estimated duration and a queue slot — IMPLEMENTED & VERIFIED (2026-06-30, commit 55aefb3 + 02-VERIFICATION.md)
- [x] **Phase 3: Live Queue Management & Quota** - Students see real-time queue status, can self-cancel, and daily lecturer quotas are enforced — VERIFIED (2026-07-03, `03-VERIFICATION.md` — 3/3 success criteria, existing test coverage already sufficient)

### Built ahead of schedule — originally "Deferred — Post July 15"

- [x] **Phase 4: Google Calendar Sync & Graceful Degradation** - Approved/cancelled/rescheduled sessions sync to Google Calendar with local fallback and admin error logs — VERIFIED (2026-07-03, `04-VERIFICATION.md` — 4/4 success criteria, 16 tests; fixed a real bug where the OAuth callback showed raw JSON instead of redirecting back to the app)
- [x] **Phase 5: Session Execution with Recording & Consent** - Consent prompt, single "Mulai & Rekam" button (TS1 + audio start), "Selesai" (TS2 + audio stop), T-15 notifications, auto-cancel, online/offline mode — VERIFIED 6/6 (2026-07-04, `05-VERIFICATION.md` re-verification; backend 221/221, frontend 37/37). Only manual real-mic browser checks remain open (Chrome/Firefox/Safari, 360px indicator — UX confirmations, not implementation gaps)
- [ ] **Phase 6: STT, AI Summarization & Logbook** - Async STT transcription (faster-whisper), LLM summary generation, lecturer review/edit/approve flow, student-visible transcript + summary; fallback to manual notes — **NOT STARTED** (confirmed 2026-07-03, `06-VERIFICATION.md` — 0/6, zero code found)
- [~] **Phase 7: Advisory Continuity & Campus Logbook Integration** - Per-session advice items, student follow-up marking, lecturer advice history view, Sekawan/KPTI API sync (or CSV/PDF export fallback) — PARTIAL, VERIFIED (2026-07-03, `07-VERIFICATION.md` — 2/6 success criteria; backend (`ActionItem` CRUD + compliance report) works and is tested, but **has no frontend UI on either side** (lecturer can't add advice, student can't view/complete it); campus API sync (SC3-6) not started
- [x] **Phase 8: Admin Emergency Controls & Ketua Jurusan Reporting** - Emergency Cancel, Admin Dashboard (all error logs + STT/LLM quota), Ketua Jurusan guidance history + workload + advice-compliance reports — VERIFIED (2026-07-03, `08-VERIFICATION.md` — 3/4 success criteria clean; SC3 "sessions completed" metric is structurally always 0 until Phase 5's Selesai action exists, not a Phase 8 bug)

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
**Status**: VERIFIED (2026-07-03) — see `phases/03-live-queue-management-quota/03-VERIFICATION.md`
**Success Criteria** (what must be TRUE):

  1. Student can view their current queue number, estimated guidance time, and real-time status that updates as the queue progresses — ✅ VERIFIED (`StudentQueue.tsx`, 30s poll; `TestStudentQueueView`)
  2. Student can self-cancel their queue slot at any point before status becomes "Your Turn" — ✅ VERIFIED (`CancelStudentQueueView`; `TestCancelStudentQueue`, 4 tests)
  3. When a new approval would push a lecturer's remaining daily quota below zero, that approval is rejected with a clear reason — ✅ VERIFIED (`DOSEN_DAILY_QUOTA_MINUTES` check; `test_approval_blocked_when_daily_quota_exceeded`)

**Plans**: None — implemented directly without a formal PLAN.md, same as Phase 2. Verified retroactively 2026-07-03; existing test coverage was already sufficient, no gaps found.

### Phase 4: Google Calendar Sync & Graceful Degradation

**Goal**: Approved guidance slots automatically appear on both parties' Google Calendar, and the queue/triage core keeps working — with errors visible to Admin — if the integration is unavailable
**Mode:** mvp
**Depends on**: Phase 2, Phase 3
**Requirements**: QUEUE-05, QUEUE-06, ADMIN-03
**Status**: VERIFIED (2026-07-03) — see `phases/04-google-calendar-sync/04-VERIFICATION.md`
**Success Criteria** (what must be TRUE):

  1. When a request is approved, system checks the lecturer's Google Calendar free/busy and creates a calendar event for both lecturer and student — ✅ VERIFIED (`check_free_busy` + async `create_event`, fire-and-forget thread per NFR-01)
  2. When a slot is cancelled or rescheduled, the corresponding calendar event is updated or deleted for both parties — ✅ VERIFIED (`delete_event` on cancel, `update_event` on queue-compaction reschedule)
  3. If the Calendar API fails, times out, or token has expired, the approval/cancellation still completes locally and the failure is recorded — ✅ VERIFIED (exceptions caught in `_create_calendar_event_async`, logged as `CALENDAR_ERROR` SystemLog)
  4. Admin can view a log of Calendar integration errors on an Admin Dashboard — ✅ VERIFIED (`AdminStatsView` recent_errors + `integrations.google_calendar`)

**Plans**: None — implemented directly. Verified 2026-07-03 with `test_calendar.py` (16 tests, 13 recovered + adapted, 3 added during verification). Fixed a real bug where `CalendarCallbackView` returned raw JSON instead of redirecting the browser back to `/dosen/pengaturan` after Google OAuth — the lecturer-facing Calendar connect page (`LecturerSettings.tsx`) existed but nothing drove its success/error banner. Also wired the dead "Profil" bottom-nav button to that page.

### Phase 5: Session Execution with Recording & Consent

**Goal**: Students are alerted as their turn approaches, and lecturers start/end sessions end-to-end with accurate timestamps, audio recording, and an explicit consent gate before any recording begins
**Mode:** mvp
**Depends on**: Phase 3 (queue turn progression drives T-15 notification and auto-cancel)
**Requirements**: SESSION-01, SESSION-02, SESSION-03, SESSION-04, SESSION-05, SESSION-06
**Status**: VERIFIED 6/6 (2026-07-04, `05-VERIFICATION.md` re-verification — supersedes the 2026-07-03 4/6 pass). Manual real-mic browser checks (per `05-VALIDATION.md` manual-only table) remain open as human-verification items.
**Success Criteria** (what must be TRUE):

  1. Student receives an in-app/email notification ~15 minutes before their estimated turn — ✅ VERIFIED (`check_h15_notifications`, every 1 min; `TestH15Notifications`, 3 tests)
  2. Before any recording begins, an explicit consent prompt is displayed to both parties; session proceeds without recording if either party declines — ✅ VERIFIED (`ConsentModal.tsx` + `Session.consent_given_at/consent_by_dosen/consent_by_mahasiswa`; 3 tests)
  3. Lecturer presses a single "Mulai & Rekam" button that simultaneously logs TS1 and begins audio recording; recording indicator ("Merekam…") is clearly visible — ✅ IMPLEMENTED (2026-07-04): "Mulai & Rekam" → `ConsentModal` → `startSession` (TS1) + `useMediaRecorder.start()`; pulsing "Merekam…" badge on the "Sesi Berlangsung" card; graceful fallback message when mic denied/unsupported. Tested (`useMediaRecorder.test.ts`, 5 tests); real-mic behavior needs manual browser check
  4. Lecturer presses "Selesai" to simultaneously stop recording and log TS2; manual result notes are optional — ✅ IMPLEMENTED (2026-07-04): `Session.ts2` + `result_notes` (migration 0004), `CompleteSessionView` (`POST /api/queue/<id>/complete/`) sets TS2 + DONE + saves optional notes + accepts consent-gated multipart audio → `SessionRecording` under `MEDIA_ROOT/recordings/`. Server rejects audio without recorded consent, validates WebM/Ogg/MP4 magic bytes and `RECORDING_MAX_UPLOAD_SIZE`. Tested (`test_session_execution.py`, 17 tests)
  5. If a called student's "Mulai & Rekam" hasn't occurred within 30 minutes, that student's slot is automatically cancelled — ✅ VERIFIED (`check_auto_cancel`, every 5 min, 30-min cutoff; `TestAutoCancel`, 4 tests — also fixed a bug where the audit log mislabeled these as `EMERGENCY_CANCEL`)
  6. Lecturer selects Offline/Online; if Online, must attach an external meeting link — ✅ VERIFIED (`ApproveModal` method radio + required `meeting_link` validation)

**Plans**: None — implemented directly. SC1/2/5/6 verified 2026-07-03 (added `test_scheduler.py` + consent tests). SC3/SC4 closed 2026-07-04 following the `05-VALIDATION.md` Wave 0 plan (webm magic-byte fixture, jsdom `MediaRecorder` shim): backend `test_session_execution.py` (17 tests), frontend `useMediaRecorder.test.ts` + active-session card tests. Phase 6 is now unblocked — completed consented sessions produce a real audio file. The Phase 8 `sesi_selesai` regression guard was flipped to assert completed sessions are counted.

### Phase 6: STT, AI Summarization & Logbook

**Goal**: Every completed session with recording automatically produces an editable, lecturer-approved logbook entry via an async STT → LLM summary pipeline; graceful fallback to manual notes if the pipeline fails. *(Expanded in PRD v2.3)* Online sessions additionally run through in-app embedded video (Jitsi), with both parties' audio mixed into one recording so the STT pipeline works identically for offline and online sessions.
**Mode:** mvp
**Depends on**: Phase 5 (recording must exist to transcribe)
**Requirements**: STT-01, STT-02, STT-03, STT-04, STT-05, STT-06, STT-07, ADMIN-05, VIDEO-01, VIDEO-02
**Status**: NOT STARTED — confirmed 2026-07-03, see `phases/06-stt-ai-summarization-logbook/06-VERIFICATION.md`. The only phase with zero code: no whisper/STT, no LLM call, no transcript or summary field on `Session`. **No longer blocked** — Phase 5's audio capture landed 2026-07-04 (`SessionRecording` files under `MEDIA_ROOT/recordings/`). Scope expanded 2026-07-05 (PRD v2.3) to fold in Jitsi video + dual-party audio capture for online sessions — see `06-CONTEXT.md`.
**Success Criteria** (what must be TRUE):

  1. After a session ends with a recording, the system asynchronously transcribes the audio via self-hosted faster-whisper; transcript is available within ≤2× audio duration for 90% of sessions — ❌ NOT STARTED
  2. System generates a structured AI summary (advice points + improvement notes) from the transcript via an LLM API call after transcript is ready — ❌ NOT STARTED
  3. Lecturer can view, edit, and approve the AI-generated summary and advice items; only approved content is committed to the logbook — ❌ NOT STARTED
  4. Transcript and approved summary are stored linked to the session and student; student can view them after approval — ❌ NOT STARTED
  5. If STT or LLM fails or times out, lecturer sees a manual note editor and the failure is logged to Admin Dashboard — ❌ NOT STARTED
  6. Admin can monitor STT/LLM quota and view failure logs — ❌ NOT STARTED
  7. *(new, v2.3)* Online sessions run via in-app embedded Jitsi video instead of an external meeting link — ❌ NOT STARTED
  8. *(new, v2.3; revised 2026-07-05 per research finding)* For online sessions, the existing `useMediaRecorder` flow records lecturer-mic-only audio (identical to Phase 5's behavior), feeding the same STT pipeline as offline sessions. Full dual-party audio mixing (D-16) was found not implementable against the locked Jitsi iframe stack — cancelled, tracked as a deferred idea (D-19), not attempted this phase — ❌ NOT STARTED

**Plans**: TBD — this is the real next greenfield phase. Its Phase 5 dependency is satisfied as of 2026-07-04 (audio files exist under `MEDIA_ROOT/recordings/`).

### Phase 7: Advisory Continuity & Campus Logbook Integration

**Goal**: Advice items are tracked across sessions (student can mark follow-up, lecturer sees full history), and approved summaries sync to the campus logbook system with a CSV/PDF fallback
**Mode:** mvp
**Depends on**: Phase 6 (advice items come from approved summaries)
**Requirements**: ADVICE-01, ADVICE-02, LOGBOOK-01, LOGBOOK-02, LOGBOOK-03, ADMIN-04
**Status**: PARTIAL, VERIFIED (2026-07-03) — see `phases/07-advisory-continuity-campus-logbook/07-VERIFICATION.md`. 2/6 success criteria have working, tested API logic; **none are fully satisfied**, since the advice-tracking half has zero frontend UI and the campus-sync half was never started.
**Success Criteria** (what must be TRUE):

  1. Student can mark individual advice items as "addressed" with an optional note/evidence before submitting the next session request — 🟡 PARTIAL: `CompleteActionItemView` correctly flips `is_completed`/`completed_at` (tested, 4 tests), but **no UI exists anywhere** — no page lets a lecturer create an advice item, no page lets a student see or complete one. No note/evidence field either, just a boolean
  2. Lecturer can view the complete advice history and follow-up status for each advisee student — ❌ NOT SATISFIED: the only aggregate view (`KetuaJurusanComplianceView`) is ketua jurusan/admin-only; a lecturer can only `GET` action items one session at a time, not an aggregate advisee history, and there's no UI for even that
  3. System attempts to sync approved summaries to the campus logbook API (Sekawan/KPTI) when configured; on success, logbook entry ID is stored — ❌ NOT STARTED (no Sekawan/KPTI code anywhere — and nothing to sync yet without Phase 6's summaries)
  4. If the campus API is unavailable or unconfigured, system offers a CSV/PDF export of the summary for manual upload — ❌ NOT STARTED for summaries specifically, though `KetuaJurusanExportView` already does CSV+PDF export for guidance-history/workload data (FR-KP03) — a related but distinct feature
  5. If the campus API call fails or times out, summary remains saved internally, is queued for retry, and error appears in Admin Dashboard — ❌ NOT STARTED
  6. Admin can configure campus logbook API credentials and settings — ❌ NOT STARTED

**Plans**: None — implemented directly (partially). Verified 2026-07-03 with `test_action_items.py` (14 tests, previously zero coverage). No bugs found in the backend logic itself — every gap here is "doesn't exist yet," not "implemented wrong." Needs real product/UI work (advice-item creation + student-facing follow-up view) before this phase can close, separately from the campus-sync half which is legitimately blocked on Phase 6.

### Phase 8: Admin Emergency Controls & Ketua Jurusan Reporting

**Goal**: Admin has a safety valve for disrupting a lecturer's day, and Ketua Jurusan has a complete digital record — including documentation quality and advice compliance — for accreditation
**Mode:** mvp
**Depends on**: Phase 7 (session records, summaries, and advice tracking must all exist for meaningful reporting)
**Requirements**: ADMIN-02, REPORT-01, REPORT-02, REPORT-03
**Status**: VERIFIED (2026-07-03) — see `phases/08-admin-emergency-controls-ketua-jurusan-reporting/08-VERIFICATION.md`. 3/4 success criteria clean; the 4th is mechanically correct but data-starved by gaps in other phases.
**Success Criteria** (what must be TRUE):

  1. Admin can trigger an Emergency Cancel that clears all of a specific lecturer's remaining queued slots for the current day — ✅ VERIFIED (`AdminEmergencyCancelView`; 6 tests incl. validation + permission guards)
  2. Ketua Jurusan can view a digitized guidance history (timestamps, durations, symptoms, approved summaries) across all lecturers — 🟡 PARTIAL: history/timestamps/durations/symptoms all present and tested (`KetuaJurusanStatsView`/`KetuaJurusanExportView`); "approved summaries" column will stay empty until Phase 6 exists
  3. Ketua Jurusan can view each lecturer's workload summary (sessions completed, total time) suitable for accreditation reporting — 🟡 PARTIAL: `total_sesi`/`total_durasi_menit` verified correct; **`sesi_selesai` ("sessions completed") is structurally always 0** — no code path anywhere ever sets a `Session` to `DONE`, because Phase 5's "Selesai" action doesn't exist yet. Regression-guarded so this test fails loudly once that gap closes
  4. Ketua Jurusan can view advice follow-up compliance rates per lecturer/student — ✅ VERIFIED (mechanism): `KetuaJurusanComplianceView` tested with real data (50% rate, per-dosen/per-mahasiswa breakdowns correct); whether it has real data to show in practice depends on Phase 7's UI gap

**Plans**: None — implemented directly. Verified 2026-07-03 with `test_admin.py` (24 tests, previously zero coverage). Also fixed an environment gap: `reportlab` was declared in `requirements.txt` but not actually installed, silently breaking the PDF export path.

---

## Progress

**Deadline: 15 July 2026 | Team: 4 people, all working daily**
**Execution Order (MVP scope):** 1 → 2 → 3 — in practice, code for 4/5/7/8 landed early too; see 2026-07-03 audit note above.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Submission & Triage Foundation | 5/5 | ✅ Complete, verified | 2026-06-25 |
| 2. Approval & Queue Placement | n/a (direct) | ✅ Implemented & Verified (32 tests) | 2026-06-30 |
| 3. Live Queue Management & Quota | n/a (direct) | ✅ Verified (3/3 SC, 15 tests) | 2026-07-03 |
| 4. Google Calendar Sync & Graceful Degradation | n/a (direct) | ✅ Verified (4/4 SC, 16 tests) | 2026-07-03 |
| 5. Session Execution with Recording & Consent | n/a (direct) | ✅ Verified (6/6 SC; 17+7 new tests; manual mic checks open) | 2026-07-04 |
| 6. STT, AI Summarization & Logbook | 0/TBD | ❌ Not started (confirmed) | - |
| 7. Advisory Continuity & Campus Logbook Integration | n/a (direct) | 🟡 Verified (2/6 SC, 14 tests); backend works, zero frontend UI; campus sync not started | 2026-07-03 |
| 8. Admin Emergency Controls & Ketua Jurusan Reporting | n/a (direct) | ✅ Verified (3/4 SC, 24 tests); `sesi_selesai` metric unblocked by Phase 5 close (regression guard now asserts real counts); 4th SC still data-starved by Phase 7 gap | 2026-07-03 |

**Team assignments:**
- Person A → Auth & User Management (registration, admin approval, role redirect)
- Person B → Symptom Config & Submission (symptom weights, submission form, My Submissions)
- Person C → Approval & Triage (approve/reject, duration calc, QueueSlot model)
- Person D → Queue Engine (queue status, self-cancel, quota enforcement)

**Sprint timeline:**
- Jun 25–Jul 1: A+B finish Phase 1 remaining work; C+D design Phase 2 models
- Jul 2–Jul 8: A+B join Phase 2; D builds queue engine foundation
- Jul 9–Jul 15: All 4 on Phase 3 + integration testing + buffer
