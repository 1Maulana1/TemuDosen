# Phase 7 — Deferred / Known Issues

**Phase 7 status:** ✅ COMPLETE (all 6 success criteria built + tested, 2026-07-06).
Backend 298/298, frontend 56/56, tsc clean, pushed to `origin/master` (`9ab505a`).

The items below are **non-blocking** follow-ups carried forward explicitly — they do
not invalidate Phase 7 completion, but are recorded so they are not silently dropped.

## 1. SC1 — optional note/evidence on advice completion — ✅ RESOLVED 2026-07-07

Added `ActionItem.completion_note` (TextField, migration 0009); `CompleteActionItemView`
accepts an optional `note`; the student "Tandai Selesai" UI in `StudentSessionDetail.tsx`
has an optional note textarea, and the note is shown to the lecturer (`LecturerSessionDetail`
+ `/dosen/saran`). 3 backend + 1 frontend tests. (Evidence *attachments* — files — remain a
possible future enhancement; free-text note/evidence is covered.)

## 2. SC3 — real Sekawan/KPTI API never exercised (by design)

**What:** The campus sync adapters (`apps/logbook/services/campus_logbook.py`) implement the
`POST /api/v1/logbook/entries` contract from `.planning/deferred/TECH-SPEC.md §2` and are
verified via **mocked** adapters, never against a live Sekawan/KPTI server.

**Impact:** expected. PROJECT.md v2.2 deliberately chose a layered-adapter + fallback design
precisely because the campus API may not be available in the project timeline. Real HTTP only
fires when `CAMPUS_LOGBOOK_ENABLED` + credentials are set (default off).

**To close (only when a real endpoint exists):** obtain the actual Sekawan/KPTI base URL, auth
token, and confirm the request/response schema matches `build_payload()`; run one live sync and
adjust the adapter's response-id parsing (`data.get('id') / data.get('entry_id')`) if needed.

## 3. No live browser E2E of the campus-sync flow

**What:** All Phase 7 verification is via automated tests (pytest + vitest + tsc). The
approve → sync → status-badge → CSV/PDF export flow was not driven live in a browser with
seeded data.

**Impact:** low. The flow is mostly backend + graceful degradation, and each piece is unit/
integration tested. A live pass would only add visual confirmation.

**To close:** seed a lecturer + advisee + approved logbook, run backend + frontend dev servers,
and walk the flow in the preview, checking the sync-status chip + export downloads.
