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

_(populated below as the gap-hunt proceeds)_
