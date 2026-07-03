---
phase: 04-google-calendar-sync
verified: 2026-07-03T00:00:00Z
status: verified
score: 4/4 success criteria verified
test_evidence: backend/apps/bimbingan/tests/test_calendar.py — 16 tests, all passing; full backend suite 166/166
human_verification:
  - test: "Real OAuth connect flow with a live Google account (GOOGLE_CALENDAR_ENABLED=true + real client id/secret)"
    expected: "Dosen clicks 'Hubungkan' on /dosen/pengaturan → Google consent screen → redirected back to /dosen/pengaturan?calendar=connected with a success banner → an approved session appears on the dosen's real Google Calendar with the student as attendee"
    why_human: "Requires a real Google Cloud OAuth client + a live Google account; never exercised with real credentials in this pass (all API calls are mocked at the cal_service boundary in tests, per GOOGLE_CALENDAR_ENABLED=false default)"
  - test: "Token expiry + refresh in a live session"
    expected: "An expired access_token is silently refreshed via _refresh_and_save() before the next Calendar API call, with no user-visible interruption"
    why_human: "Requires waiting out a real Google token expiry window or manually forging one against a live account"
---

# Phase 04: Google Calendar Sync & Graceful Degradation — Verification Report

**Phase Goal:** Approved guidance slots automatically appear on both parties' Google Calendar, and the queue/triage core keeps working — with errors visible to Admin — if the integration is unavailable.
**Verified:** 2026-07-03
**Status:** verified (programmatic, via automated tests) + one production bug fixed, one UI gap closed
**Re-verification:** No — initial verification

> **Provenance note.** Like Phase 2, the Phase 4 backend (service, views, models) was implemented and committed (`55aefb3 feat(phase2)`) before a formal GSD plan/verification loop was run, so no `04-*-PLAN.md` files exist. This document verifies the shipped code against the ROADMAP Phase 4 success criteria and records the result as the closing artifact for this phase. `test_calendar.py` (13 tests) was recovered from an untracked teammate copy earlier this session and adapted to match the current async (fire-and-forget thread) calendar-creation architecture; 3 more tests for the OAuth callback redirect were added during this verification pass.

---

## Goal Achievement

### Success Criteria (from ROADMAP)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On approval, system checks the lecturer's Google Calendar free/busy and creates a calendar event for both lecturer and student | VERIFIED | `ApproveSubmissionView` calls `cal_service.check_free_busy()` before scheduling, then fires `_create_calendar_event_async()` on a background thread (NFR-01) which calls `cal_service.create_event()` with both dosen and student as attendees. `google_event_id` persisted on `Session` once the thread completes. Tests: `TestApproveCalendarSync::test_approve_stores_google_event_id_when_calendar_succeeds` |
| 2 | On cancel/reschedule, the corresponding calendar event is updated or deleted for both parties | VERIFIED | `CancelStudentQueueView` calls `cal_service.delete_event()` when `session.google_event_id` is set. Queue compaction after a cancel (`scheduler._recalculate_queue`) calls `update_event()` for every remaining session whose `scheduled_at` shifted. Tests: `TestCancelCalendarSync` (delete-when-present, skip-when-absent) + `TestRescheduleCalendarSync::test_recalculate_queue_updates_calendar_when_schedule_shifts` |
| 3 | If the Calendar API fails, times out, or token has expired, the approval/cancellation still completes locally and the failure is recorded | VERIFIED | `_create_calendar_event_async` wraps the whole calendar call in `try/except`, logs a `CALENDAR_ERROR` SystemLog on failure, and never lets the exception reach the request/response cycle (the approve response returns 200 regardless — the calendar write is fire-and-forget). A busy free/busy result is logged as `CALENDAR_CONFLICT` (WARNING) but does not block approval. Tests: `test_approve_succeeds_when_calendar_create_fails`, `test_approve_logs_error_when_calendar_service_raises`, `test_approve_logs_conflict_but_does_not_block` |
| 4 | Admin can view a log of Calendar integration errors on an Admin Dashboard | VERIFIED | `AdminStatsView` returns `recent_errors` (includes `CALENDAR_ERROR`/`CALENDAR_CONFLICT` `SystemLog` rows) and `integrations.google_calendar` (`enabled`, `connected_dosens`). `AdminDashboard.tsx` renders both. Tests: `TestAdminCalendarErrorLog` (3 tests) |

**Score:** 4/4 success criteria verified by passing automated tests.

---

## Test Evidence

```
$ .venv/Scripts/python -m pytest apps/bimbingan/tests/test_calendar.py -v
16 passed in 0.45s

$ .venv/Scripts/python -m pytest -q
166 passed in 1.64s
```

### Production bug found and fixed during this verification pass

`CalendarCallbackView` (the endpoint Google redirects the browser to after OAuth consent — a **top-level navigation**, not an XHR call) returned raw DRF JSON on every outcome (`{'message': 'Google Calendar berhasil dihubungkan.'}` or a 500 with `{'detail': ...}`). A real user would see a bare JSON page instead of landing back in the app. Fixed by changing every return path to `django.shortcuts.redirect()` back to `{FRONTEND_URL}/dosen/pengaturan?calendar=connected|error&reason=disabled|invalid_state|save_failed` — which `LecturerSettings.tsx` already reads to show a success/error banner (it was built with these exact query params in mind but had nothing driving them until now). Added `FRONTEND_URL` Django setting (`config/settings/base.py`, default `http://localhost:5173`). Added 3 regression tests (`TestCalendarCallbackView`) covering the disabled, missing-code, and state-mismatch redirect paths.

### Frontend gap found and closed during this verification pass

The "Profil" bottom-nav button on `LecturerDashboard.tsx` was a dead `<button>` with no navigation — there was no way for a dosen to actually reach the Calendar settings page from the UI. Wired it to `Link to="/dosen/pengaturan"`, matching the other nav items.

**Not exercised:** the actual OAuth handshake against Google, since `GOOGLE_CALENDAR_ENABLED=false` by default and no real client credentials exist in this environment. See `human_verification` above.

---

## Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| QUEUE-05 | System checks free/busy and creates/updates/deletes a calendar event on approval, cancellation, or reschedule | SATISFIED | `check_free_busy`/`create_event`/`update_event`/`delete_event` wired into approve, cancel, and queue-recompaction flows; all four covered by tests |
| QUEUE-06 | If Calendar integration fails/times out/token expires, the queue keeps working locally and the error is logged (graceful degradation) | SATISFIED | Every `services/calendar.py` method fails closed to a safe default and logs via `SystemLog`; approve/cancel never depend on a successful Calendar call, and creation itself is fire-and-forget so a slow/hung Calendar API can't block the approve request either |
| ADMIN-03 | Admin can view integration error logs (Google Calendar failures) on an Admin Dashboard | SATISFIED | `/api/stats/admin/` `recent_errors` + `integrations.google_calendar`; rendered in `AdminDashboard.tsx` |

---

## Known Issues (pre-existing, out of scope for this phase)

- Frontend `tsc -b`/`vitest` were clean at time of this verification (2026-07-03) — the previous `LecturerDashboard.test.tsx` drift was already fixed earlier this session (split into `LecturerDashboard.test.tsx` + `LecturerRequests.test.tsx`).

---

## Notes / Follow-ups

- **No formal PLAN.md for Phase 4**, same situation as Phase 2 — this verification report is the closing artifact.
- **Not verified against real Google credentials.** Everything above is proven with `GOOGLE_CALENDAR_ENABLED=false` (test default) and mocked API calls at the `cal_service` boundary. Before a real demo/deploy, someone needs to register a Google Cloud OAuth client, set `GOOGLE_CALENDAR_ENABLED=true` + `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in `.env`, and manually run the `human_verification` checks above.
- **Token refresh path** (`_refresh_and_save` in `services/calendar.py`) has no automated test — exercised only implicitly via the mocked path. Low risk since it fails closed like everything else in the service, but worth a dedicated unit test if the team wants full coverage.

---

*Verified: 2026-07-03*
*Verifier: Claude — verification against ROADMAP success criteria; fixed a real OAuth-callback bug and a dead nav link found during the pass*
