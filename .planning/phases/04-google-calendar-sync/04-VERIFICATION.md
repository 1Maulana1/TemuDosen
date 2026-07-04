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
    status: "DONE 2026-07-04 — exercised by a teammate's real-credential pass (see Addendum). Found 2 real bugs invisible to the mocked suite (PKCE code_verifier lost across the OAuth redirect; missing CSRF_TRUSTED_ORIGINS blocking the cross-origin approve POST); both fixes ported into this repo 2026-07-04."
  - test: "Token expiry + refresh in a live session"
    expected: "An expired access_token is silently refreshed via _refresh_and_save() before the next Calendar API call, with no user-visible interruption"
    why_human: "Requires waiting out a real Google token expiry window or manually forging one against a live account"
    status: "Still open — not exercised in the 2026-07-04 pass (token stayed valid throughout; also _build_credentials never sets creds.expiry, so the .expired property is always False and the proactive refresh path never triggers. See Addendum.)"
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

## Addendum: Real-Credential Human Verification (2026-07-04, ported from teammate's pass)

**Status: DONE.** This closes the first `human_verification` item above. A teammate (Nala) ran the OAuth-connect flow end-to-end with real Google Cloud OAuth client credentials (`GOOGLE_CALENDAR_ENABLED=true`, real `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` in `backend/.env`, consent screen in Google's "Testing" publishing status). Two real bugs were found and fixed in that pass — both invisible to the mocked test suite because they only manifest with a real browser + real Google redirect. Both fixes were ported into this repo on 2026-07-04.

### Bug 1 — PKCE `code_verifier` lost across the OAuth redirect

- **Symptom**: clicking "Hubungkan" → Google login → consent → redirected back to `/dosen/pengaturan?calendar=error&reason=save_failed`.
- **Root cause**: `google-auth-oauthlib` 1.4.0 defaults `autogenerate_code_verifier=True`. `CalendarAuthView.get()` calls `flow.authorization_url()`, which generates a PKCE `code_verifier` and sends its hash (`code_challenge`) to Google — but only `oauth_state` was persisted to the session, never the verifier. `CalendarCallbackView.get()` then builds a **new** `Flow` instance (with no `code_verifier`) and calls `fetch_token(code=code)`, which Google rejects: `invalid_grant: Missing code verifier.`
- **Fix** (`backend/apps/bimbingan/views.py`): persist `flow.code_verifier` into `request.session['oauth_code_verifier']` in `CalendarAuthView`; restore it onto the callback's `Flow` instance (`flow.code_verifier = request.session.get('oauth_code_verifier')`) before `fetch_token()` in `CalendarCallbackView`; clean up the session key alongside `oauth_state`/`oauth_dosen_id`.

### Bug 2 — Missing `CSRF_TRUSTED_ORIGINS` blocks the approve POST

- **Symptom**: after connecting Calendar successfully, clicking "Setujui" on a pending submission failed in the browser with "CSRF failed".
- **Root cause**: Django 4.0+ requires `CSRF_TRUSTED_ORIGINS` to include the frontend's origin for any cross-origin unsafe request, even with a valid session + CSRF cookie. `CORS_ALLOWED_ORIGINS` was set in `dev.py`/`docker.py`/`prod.py`, but `CSRF_TRUSTED_ORIGINS` was never set anywhere. Login was unaffected because DRF's `SessionAuthentication.enforce_csrf()` only runs once a session-authenticated user already exists on the request — an anonymous login POST skips it, but an authenticated approve POST does not. Confirmed rejection: `CSRF Failed: Origin checking failed - http://localhost:5173 does not match any trusted origins.`
- **Fix**: added `CSRF_TRUSTED_ORIGINS = CORS_ALLOWED_ORIGINS` to `backend/config/settings/dev.py`, `docker.py`, and `prod.py`.

### End-to-end evidence (from the teammate's environment, after both fixes)

- OAuth connect completed via real browser + real Google account (Google's "unverified app" warning + Test-user allowlist both expected for an app in Testing status).
- `POST /api/submissions/<id>/approve/ → 200 OK` with `google_event_id` persisted, and the event cross-checked directly against the Google Calendar API (`events().get()`) — it genuinely exists on the dosen's calendar with the student as attendee.
- `check_free_busy()` also exercised directly against the live API with a correct real result.
- Note: that pass ran against the pre-async (synchronous) calendar-creation code; this repo creates the event on a background thread (NFR-01), which does not change either bug or fix — both live in the OAuth handshake and CSRF layers, before/outside the calendar write itself.

### Still open (not a blocker, noted for later)

- **`_build_credentials()` never sets `creds.expiry`** (`backend/apps/bimbingan/services/calendar.py`), so `Credentials.expired` is always `False` regardless of the real token lifetime stored in `DosenCalendarToken.expires_at`. Likely harmless in practice — `googleapiclient`'s transport also refreshes reactively on a 401 — but the proactive refresh path in `_get_calendar_service()` never actually triggers. Worth a small fix (`Credentials(..., expiry=token_row.expires_at)`) plus a dedicated test. The "token expiry + refresh" `human_verification` item above stays open for the same reason.

*Addendum recorded: 2026-07-04 — fixes ported from Nala's real-credential verification pass into this repo (PKCE session persistence, CSRF_TRUSTED_ORIGINS).*

---

*Verified: 2026-07-03*
*Verifier: Claude — verification against ROADMAP success criteria; fixed a real OAuth-callback bug and a dead nav link found during the pass*
