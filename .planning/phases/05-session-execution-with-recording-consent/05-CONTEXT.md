# Phase 5: Session Execution with Recording & Consent - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 5 delivers the session-execution layer for an already-approved, queued guidance slot: a T-15 pre-turn notification (already implemented), an explicit recording-consent gate, the "Mulai & Rekam" action that starts both a session timestamp and browser audio recording, a "Selesai" action that stops recording and closes the session with optional manual notes, offline/online method (already implemented), and 30-minute no-show auto-cancel (already implemented).

**Two of six requirements are already fully implemented in code** (from an earlier bulk commit that landed Phase 3/4/8 work alongside Phase 2). Discussion below focuses only on the three requirements that are genuinely unbuilt: consent (SESSION-02), real audio recording (part of SESSION-03), and session completion / TS2 (SESSION-04).

</domain>

<decisions>
## Implementation Decisions

### Already Implemented — No New Decisions Needed
- **D-01:** SESSION-01 (T-15 notification) — fully implemented in `apps/bimbingan/scheduler.py::check_h15_notifications` (runs every 1 min via APScheduler, sends when `scheduled_at` is 14–16 min out and `notification_sent=False`).
- **D-02:** SESSION-05 (auto-cancel, no-show >30min) — fully implemented in `apps/bimbingan/scheduler.py::check_auto_cancel` (runs every 5 min, cancels `WAITING` sessions past `scheduled_at + 30min` with `ts1__isnull=True`, notifies both parties, deletes calendar event, recalculates queue).
- **D-03:** SESSION-06 (offline/online + meeting link) — fully implemented. Dosen selects method + optional meeting link at **approval time** (`LecturerRequests.tsx`), stored on `Session.method` / `Session.meeting_link`. No new UI needed in Phase 5.
- **D-04:** Partial: `Session.ts1` + status transition `WAITING → IN_PROGRESS` already exists via `StartSessionView` (`POST /api/queue/<id>/start/`), triggered by a "Mulai" button on `LecturerDashboard.tsx`. This button currently does NOT gate on consent and does NOT record audio — it only timestamps and notifies. Phase 5 extends this existing endpoint/button rather than building a new one from scratch.

### Consent Flow (SESSION-02)
- **D-05:** Consent is captured as part of the existing "Mulai & Rekam" action (renamed from "Mulai") — not a separate pre-step page. Clicking the button opens a consent modal first; only on confirm does `ts1` get set and recording start.
- **D-06:** Single confirmation by the lecturer on behalf of both parties (dosen + mahasiswa share the same device/room during an in-person session — this matches how `method`/offline sessions work). No separate student-side consent action.
- **D-07:** If consent is declined: session still starts normally (`ts1` recorded, status → `IN_PROGRESS`) but flagged as "no recording" — functionally identical to today's plain "Mulai" behavior. Session is never blocked by a consent refusal.
- **D-08:** Consent is asked every session (no "always allow" / remembered-consent state for a dosen-mahasiswa pair) — matches SESSION-02's "explicit... before the session begins" wording and avoids a new persistence concept.

### Audio Recording (part of SESSION-03)
- **D-09:** Recorded client-side via the browser's native `MediaRecorder` API in **WebM/Opus** — no client-side transcoding. This format is directly consumable by faster-whisper in Phase 6.
- **D-10:** Recording is buffered in the browser for the session's duration and uploaded as a **single file** when "Selesai" is pressed — no chunked/incremental upload. Mirrors the existing PDF-upload pattern (D-26/D-27 from Phase 1: local disk storage, UUID-based filename, no guessable path).
- **D-11:** No hard duration/size cap for MVP — sessions are already bounded by symptom-weight-estimated duration (typically 15–60 min); only a soft warning if a session runs unusually long. Revisit if real usage shows a problem.
- **D-12:** If the browser denies microphone permission, the session is NOT blocked — it proceeds exactly like a declined-consent session (`ts1` recorded, no recording, dosen notified inline that recording failed/unavailable).

### Session Completion / TS2 (SESSION-04)
- **D-13:** "Selesai" lives on a **dedicated active-session page** (not just a button-swap on the existing dashboard/queue list) — this page also hosts the recording indicator ("Merekam…") required by PROJECT.md's Constraints section.
- **D-14:** Manual notes are entered via a short textarea inside a confirmation modal shown when "Selesai" is pressed — not a separate later-editable field.
- **D-15:** Manual notes remain fully optional even when there is no recording (declined consent or mic failure) — the session can close with zero documentation if the dosen chooses. (Explicitly discussed: user considered making notes mandatory in the no-recording case, then decided against it — flexibility wins over guaranteed documentation for MVP.)
- **D-16:** New `Session.ts2` field required (does not exist yet) — analogous to existing `Session.ts1`. New endpoint (e.g., `POST /api/queue/<id>/complete/`) sets `ts2`, transitions status `IN_PROGRESS → DONE`, accepts the uploaded audio file + optional manual notes.

### Claude's Discretion
- Exact consent modal copy/wording (Indonesian) — follow existing UI copy tone (see `LoginPage.tsx`, `RegisterStudentPage.tsx` for house style).
- Where the recording indicator ("Merekam…") is visually placed on the active-session page — PROJECT.md only requires it be "clearly visible."
- Whether the active-session page is a new route (e.g., `/dosen/session/:id`) or a modal-over-dashboard — planner decides based on existing router.tsx conventions (see `/dosen/requests`, `/dosen/queue` pattern).
- Exact recovery behavior if the dosen navigates away / refreshes mid-recording (browser tab close would lose an in-memory, non-chunked recording) — flag as a risk for the planner to address, no user preference captured.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — Constraints section: "Mulai & Rekam" and "Selesai" buttons must be large/reachable at 360px; consent must be captured and stored before recording (NFR-08); recordings/transcripts stored encrypted AES-256, access restricted to the specific lecturer/student pair
- `.planning/REQUIREMENTS.md` — SESSION-01 through SESSION-06 (Phase 5 scope)
- `.planning/ROADMAP.md` — Phase 5 section: depends on Phase 3 (queue turn progression drives T-15 + auto-cancel); Phase 6 depends on Phase 5 (needs the recorded audio)
- `.planning/phases/01-submission-triage-foundation/01-CONTEXT.md` — D-26/D-27 (local filesystem storage, UUID-based filenames) — the pattern to mirror for audio file storage; D-29 flags an unresolved file-serving security gap the audio route should NOT repeat (serve through an access-controlled route, not a direct/guessable URL)

### Existing Code — Session Execution
- `backend/apps/bimbingan/models.py` — `Session` model: `ts1`, `method`, `meeting_link`, `status` (WAITING/IN_PROGRESS/DONE/CANCELLED) already exist; `ts2` and any consent/recording fields do NOT exist yet
- `backend/apps/bimbingan/views.py::StartSessionView` (`POST /api/queue/<id>/start/`) — existing "start" logic to extend, not replace
- `backend/apps/bimbingan/scheduler.py` — `check_h15_notifications`, `check_auto_cancel` — fully implemented, do not re-implement (SESSION-01, SESSION-05 are done)
- `backend/apps/bimbingan/services/notification.py` — `notify_student`, `notify_lecturer` helpers already used by scheduler and StartSessionView
- `frontend/src/pages/lecturer/LecturerDashboard.tsx` — existing "Mulai" button (line ~121) to rename/extend into "Mulai & Rekam" with consent gate
- `frontend/src/pages/lecturer/LecturerRequests.tsx` — existing offline/online + meeting_link selection UI (SESSION-06, already done)
- `frontend/src/api/stats.ts::startSession` — existing client call to `POST /api/queue/<id>/start/`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Session` model (`backend/apps/bimbingan/models.py`) — extend with `ts2` and consent/recording-status fields rather than creating a new model
- `StartSessionView` pattern (`backend/apps/bimbingan/views.py`) — template for the new "complete session" endpoint (permission check via `IsLecturer`, ownership check via `student.adviser != request.user`, `SystemLog` audit entry, `notify_student`/`notify_lecturer` calls)
- File upload + serving pattern from Phase 1 (`apps/submissions` — validated upload, UUID filename, protected file-serving route) — reuse for audio files instead of inventing a new storage scheme
- `SystemLog` model — every session-lifecycle event (start, complete, consent declined, recording failed) should log here, matching the existing `H15_NOTIFICATION` / `AUTO_CANCEL` / `SESSION_STARTED` event-type pattern

### Established Patterns
- Backend: DRF `APIView` classes per action, `IsLecturer`/`IsAdmin` permission classes, ownership checked via `request.user` against `student.adviser`
- Frontend: role-scoped routes under `/dosen/*` in `router.tsx`, each with a `requireRole('lecturer')` loader; `api/sessions.ts` and `api/stats.ts` hold the typed fetch wrappers
- Session status is a one-way state machine (`WAITING → IN_PROGRESS → DONE`, or `→ CANCELLED`) per PROJECT.md Constraints — the new `ts2`/complete endpoint must only fire from `IN_PROGRESS`

### Integration Points
- Phase 6 (STT) directly consumes the audio file produced by the "Selesai" upload — the file format/storage decision here (D-09, D-10) is a hard dependency for Phase 6's faster-whisper pipeline
- The active-session page (D-13) is new frontend surface — no existing route to extend; needs its own entry in `router.tsx` under `/dosen`

</code_context>

<specifics>
## Specific Ideas

- "Mulai & Rekam" and "Selesai" replace/extend the current plain "Mulai" button — same interaction slot, upgraded behavior, not a parallel new flow
- The no-recording path (consent declined OR mic permission denied) should look and behave identically from the dosen's perspective — one unified "session without recording" state, not two separate edge cases

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within Phase 5 scope. (Chunked/incremental audio upload and per-pair "remembered consent" were both raised as alternatives during discussion and explicitly rejected for MVP — noted here so a future phase doesn't need to re-litigate them without cause.)

</deferred>

---

*Phase: 5-Session Execution with Recording & Consent*
*Context gathered: 2026-07-02*
