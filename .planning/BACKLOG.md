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

> **✅ RESOLVED 2026-07-07: G1, G2, G3, G5, G6, G7 all built + tested** (backend 337,
> frontend 63). G1 advice edit/delete · G2 user-facing notifications (Notification
> model + bell) · G3 notify-on-advice-add · G5 recording retention job · G6 STT
> pipeline retry endpoint+button · G7 SystemLog auto-cleanup job. Remaining open:
> N-04, G8 (low-priority polish), P1/P2 + v2 features.

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

### G5 — 🔧 No retention/cleanup for session recording audio (storage + privacy)
Nothing ever deletes `SessionRecording` audio files. On a system that records every
session they accumulate on disk unbounded, and keeping guidance-audio indefinitely is
a privacy concern. Add a retention policy + scheduled cleanup (e.g. delete the audio
file once the logbook is approved / after N days), mirroring the H-15 / auto-cancel
scheduler jobs. Consider deleting the file but keeping the transcript/summary.

### G6 — 🔧 No way to re-run a FAILED STT/AI pipeline
`dispatch_pipeline` fires once on session complete. If it fails (STT_TIMEOUT /
STT_EMPTY / LLM_FAILED), the logbook goes FAILED and the only path is manual notes —
there's no "coba proses ulang" action to re-attempt (useful for transient failures,
e.g. the LLM API was briefly down). Add a lecturer/admin endpoint to re-dispatch the
pipeline for a FAILED logbook that still has a recording.

### G7 — 💡 SystemLog cleanup is manual, not scheduled (low priority)
`AdminLogsCleanupView` (>30 days) exists but is a manual POST — an admin must click
it. Could be a scheduled job (like the other scheduler tasks) so logs self-prune.

### G8 — 💡 Dead footer links (low priority polish)
StudentDashboard footer "Tentang / Panduan / Kontak" and some nav items are inert
"Segera hadir" placeholders. Either build the pages or remove the links.

### Verified NOT gaps (checked 2026-07-07)
- Resubmit after REJECTED is blocked; REVISION allowed + linked via
  `previous_submission`; the revision note is shown to the student in `SubmissionForm`.
- `CompleteSessionView` guards `status != IN_PROGRESS` and enforces the recording
  consent gate server-side.
- Daily-quota-full on approve returns a clean 400.
- Reject-logbook → FAILED → manual-notes recovery works end-to-end.
- No crude `prompt()/alert()` UX left in the frontend.

---

## Security & robustness gaps (deeper audit 2026-07-07)

> **✅ RESOLVED 2026-07-07: S1 + S4 built + tested** (backend 339). S1 CSV-injection
> guard (`_csv_safe` applied to both CSV exports) · S4 login rate-limiting (DRF
> ScopedRateThrottle `login` scope, 10/min, + cache-clear test fixture). Remaining:
> S2 (pagination), S3 (concurrency lock, low).

### S1 — 🔧 CSV injection in exports (security)
`KetuaJurusanExportView` and `LogbookExportView` write user-controlled text (student
names, descriptions, summary/advice text) into CSV cells with no formula-injection
guard. A value starting with `=`, `+`, `-`, or `@` is executed as a formula by Excel/
LibreOffice → CSV injection (data exfiltration / command execution on the opener's
machine). Fix: prefix such cells with a `'` (or wrap) before writing. Low effort,
real security fix.

### S2 — 🔧 Unbounded list endpoints (performance)
`SubmissionListCreateView.get` (student's submissions), `LecturerLogbookListView`,
`StudentLogbookListView`, and `LecturerAdviceHistoryView` return ALL rows with no
pagination or cap. (Session-history and notifications are already capped at [:50].)
Grows unbounded per user over time. Fix: add DRF pagination or a sane cap.

### S4 — 🔧 No login rate-limiting / brute-force protection (security)
No DRF throttling and no django-axes/ratelimit anywhere, so the login endpoint
accepts unlimited password attempts. Fix: add DRF `AnonRateThrottle` on auth (or
django-axes) to lock out repeated failures.

### S3 — 💡 No DB-level concurrency guard on approve/complete (low)
Approve/complete rely on a status-check (`status != PENDING` / `!= IN_PROGRESS`)
rather than `select_for_update()` inside a transaction. The status-check makes
double-submit practically safe, but a tight race window remains under true
concurrency. Low priority; wrap the read-modify-write in `transaction.atomic()` +
`select_for_update()` if it ever matters.

### Verified NOT gaps (deeper audit)
- Recording file serving is auth-gated (`_can_view_session`).
- `meeting_link` is validated (URLField + http/https URLValidator).
- email / nim / nidn are `unique=True` (registration uniqueness enforced).
- No XSS: frontend uses no `dangerouslySetInnerHTML`; React auto-escapes.
- Approve is guarded against double-submit via a `status != PENDING` check.

---

## UI review findings (live walk, 2026-07-07 — see UI-REVIEW-2026-07-07.md)

> **✅ RESOLVED 2026-07-07 (same day): U1, U2, U3, U4, U5, U8 all fixed + tested**
> (backend 340 / frontend 64; U1 verified live in the browser). **U0 follow-up done
> 2026-07-07:** the stale outer copies were renamed to
> `E:\Proyek S4\_STALE_frontend_jangan-dipakai` + `_STALE_backend_jangan-dipakai`
> (safe to delete permanently once confident). Remaining: U6 (=G8 dead footer
> links), U7 (pre-hydration click, low).

- **U0 (KRITIS, resolved)** — outer `.claude/launch.json` served the STALE outer copy;
  fixed to point at TemuDosen. Follow-up: delete/archive `E:\Proyek S4\frontend`+`backend`.
- **U1 🟠** — advice delete: no confirmation modal; edit/delete still offered on
  student-completed items (deleting erases their evidence note).
- **U2 🟡** — logbook export CSV "Tanggal" is a raw ISO timestamp; format it.
- **U3 ✅ fixed** — bare "-" placeholder no longer escaped to `'-` by the S1 guard.
- **U4 🟡** — NotificationBell never auto-refreshes (fetch on mount/open only).
- **U5 🟡** — login 429 throttle message likely shown in English (needs ID copy).
- **U7/U8 💡** — pre-hydration submit click swallowed; menu_book shown for WAITING
  sessions (ambiguous expectation).

## Priority recap (for whoever picks this up)

**Highest value, small effort (do first):**
- P1 (recalc queue on early finish) — cuts wait time, reuses infra.
- G1 (advice edit/delete), G3 (notify on advice add).

**Real gaps, moderate effort:**
- G2 (user-facing notifications — nothing is shown to students today).
- G5 (recording retention), G6 (STT pipeline retry).

**Low priority / polish:** N-04, G7, G8.

**v2 milestone (large):** P2 (defense scheduling) + the deferred set (VIDEO-01,
NOTIF-01, PLAG-01, MOBILE-01, DIAR-01, SCORE-01).
