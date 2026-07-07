# Backlog — TemuDosen

Captured 2026-07-07. Ideas + gaps not yet scheduled. Committed incrementally so
nothing is lost. Status legend: 💡 idea · 🔧 small fix · 🧱 large feature.

---

## Recorded programs (per user request 2026-07-07)

### P1 — 🔧 Recalculate queue when a session finishes early (v1 gap)
**Problem:** `CompleteSessionView` (dosen klik "Selesai") only sets `ts2` + status
`DONE` — it does NOT call `_recalculate_queue(dosen)`. So if a session estimated at
45 min finishes in 20 min, the freed 25 min is not passed on: waiting students keep
their old `scheduled_at` and are not pulled forward.
**Existing mechanism:** `_recalculate_queue(dosen)` (`apps/bimbingan/scheduler.py:130`)
already compacts all WAITING sessions starting from `now()`; it's called on student
cancel (`CancelStudentQueueView`) and auto-cancel (no-show), just not on completion.
**Fix (small):** call `_recalculate_queue(dosen)` at the end of `CompleteSessionView`
(mirror the cancel flow). Optionally notify the next student "giliranmu dimajukan".
Add a test asserting waiting sessions are pulled forward after an early complete.
**Value:** high — directly cuts student wait time (the project's core value), reuses
existing infra. Arguably a v1 bug, not a v2 feature.

### P2 — 🧱 DEFENSE-01: multi-examiner thesis-defense scheduling (v2)
**Idea:** schedule thesis defense exams that need several examiners available at the
same time. Not spec'd yet. Naturally builds on Phase 4's Google Calendar service.
**Sketch:**
- Extend `apps/bimbingan/services/calendar.py` `check_free_busy` to accept multiple
  dosen and compute the intersection of their free slots (common availability).
- Suggest candidate slots where ALL examiners are free; create one calendar event
  with multiple attendees on confirm.
- New model for a defense (student, list of examiners, chosen slot, status).
**Why bigger than current booking:** current queue books ONE adviser; this is a
multi-party constraint-satisfaction problem (find a slot free for everyone).
**Value:** high for accreditation workflows; effort high. True v2 milestone scope.

---

## Feature gaps found in the existing system (audit 2026-07-07)

### G1 — 🔧 Advice items can't be edited or deleted
Only `POST` (add) + `POST /complete/` exist for `ActionItem`. A lecturer who
mistypes an advice item, or wants to remove/reword one, has no way to. Add
`PATCH`/`DELETE /api/queue/<session_id>/action-items/<id>/` (lecturer-only, own
advisee's session). Guard: don't let editing silently un-complete a student's note.

### G2 — 🧱 Notifications are generated but never shown to the recipient
`apps/bimbingan/services/notification.py` is a "Phase 2 stub": `notify_student` /
`notify_lecturer` only write a `SystemLog` row. SystemLog is **admin-only** (Admin
Dashboard). So H-15 reminders, "pengajuan disetujui", "ringkasan tersedia", auto-
cancel notices, etc. are logged but the student/lecturer **never see them** — there
is no per-user notification inbox/feed or email/push delivery. Options: (a) a
`Notification` model + a student/lecturer bell/feed UI (in-app, in scope), and/or
(b) real email/push (NOTIF-01, v2). Right now the whole notification feature is
effectively invisible to end users.

### G3 — 🔧 Adding an advice item doesn't notify the student
`SessionActionItemsView.post` creates the `ActionItem` but never calls
`notify_student`, so even the (stub) notification isn't fired for new advice. Add a
`notify_student(..., event_type='ADVICE_ADDED')` call. (Depends on G2 to actually
reach the student, but the trigger is missing regardless.)

### G4 — ✅ NOT a gap (verified)
`CompleteSessionView` correctly guards `status != IN_PROGRESS` → 400, and enforces
the recording consent gate server-side. Completing a not-started session is blocked.

### N-04 — 💡 estimate fallback is coarse (low priority)
Queue estimate uses `sum(symptom.duration_minutes) or 30`. No per-category
DEFAULT_ESTIMATES and no 5s timeout guard (per the old NFR-04 note). Fine in
practice (durations are DB-driven), noted for completeness.
