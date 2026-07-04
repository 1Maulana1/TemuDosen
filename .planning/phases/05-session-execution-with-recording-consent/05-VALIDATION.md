---
phase: 5
slug: session-execution-with-recording-consent
status: closed
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-02
updated: 2026-07-04
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

**2026-07-03 update:** See `05-VERIFICATION.md` for the actual retroactive verification of this phase — consent (SESSION-02) landed and is now tested (3 tests in `test_queue.py::TestStartSession`), and `test_scheduler.py` (7 tests) now covers SESSION-01/05. This validation strategy remains accurate and still applicable for the real remaining gap: SESSION-03's audio-capture half and SESSION-04 (Selesai/TS2) — nothing below has changed for that part of the plan.

**2026-07-04 update — SESSION-03/04 executed.** Wave 0 items delivered as planned: `backend/apps/bimbingan/tests/test_session_execution.py` (17 tests: complete/TS2/notes, consent-gated upload, magic bytes, size cap, activeSession), `webm_audio_file` fixture in `conftest.py` (EBML magic header), and a `MediaRecorder`/`getUserMedia` shim in `frontend/src/test/setup.ts` (+ `useMediaRecorder.test.ts`, 5 tests, and 2 active-session tests in `LecturerDashboard.test.tsx`). The pre-existing `LecturerDashboard.test.tsx` failure had already been fixed upstream (baseline was green). Only the Manual-Only Verifications table below remains open (real mic in Chrome/Firefox/Safari, 360px indicator, tab-close data-loss behavior).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | pytest + pytest-django (via `rest_framework.test.APIClient`) |
| **Framework (frontend)** | Vitest + @testing-library/react + MSW |
| **Config file (backend)** | `backend/conftest.py` (shared fixtures: `api_client`, `student_user`, `lecturer_user`, `authenticated_lecturer`, etc.) |
| **Config file (frontend)** | `frontend/package.json` (`"test": "vitest run"`), `frontend/src/test/setup.ts` |
| **Quick run command (backend)** | `backend/.venv/Scripts/python.exe -m pytest apps/bimbingan -q` |
| **Quick run command (frontend)** | `npm run test -- --run src/pages/lecturer/<file>.test.tsx` (from `frontend/`) |
| **Full suite command (backend)** | `backend/.venv/Scripts/python.exe -m pytest -q` |
| **Full suite command (frontend)** | `npm run test -- --run` (from `frontend/`) |
| **Estimated runtime** | ~30s backend, ~20s frontend (based on existing 140/140 + 21/30 baseline) |

**Baseline note:** `src/pages/lecturer/LecturerDashboard.test.tsx` fails all 9 tests as of 2026-07-02 — pre-existing, unrelated to Phase 5 (stale expectations vs. current component: labels/search box mismatch). Since Phase 5 extends this exact file (renaming "Mulai" → "Mulai & Rekam"), the planner must explicitly choose: (a) fix in Wave 0 for a green baseline, or (b) document as known-pre-existing and exclude from the phase gate.

---

## Sampling Rate

- **After every task commit:** `pytest apps/bimbingan/tests/test_session_execution.py -q` / `npm run test -- --run <changed file>.test.tsx`
- **After every plan wave:** Full backend suite (`pytest -q`) + full frontend suite (`npm run test -- --run`)
- **Before `/gsd-verify-work`:** Full suite must be green — excluding the pre-existing `LecturerDashboard.test.tsx` failure only if option (b) above is chosen
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-TBD | TBD | 0 | — | — | Test infra for consent/recording/completion exists | unit | `pytest apps/bimbingan/tests/test_session_execution.py --collect-only` | ✅ | ✅ green |
| 05-0X-TBD | TBD | TBD | SESSION-02 | V4/V5 | Consent modal shown before recording; decline still starts session with `consent_given=false` | unit + integration | `pytest apps/bimbingan/tests/test_session_execution.py -k consent` (+ `test_queue.py::TestStartSession`) | ✅ | ✅ green |
| 05-0X-TBD | TBD | TBD | SESSION-03 | V4/V5 | "Mulai & Rekam" sets ts1 + starts MediaRecorder; permission-denied/codec-unsupported falls back to no-recording | unit (mocked MediaRecorder) + integration | `npm run test -- --run src/hooks/useMediaRecorder.test.ts` | ✅ | ✅ green |
| 05-0X-TBD | TBD | TBD | SESSION-04 | V4/V5/V6 | "Selesai" stops recording, uploads single audio file, sets ts2, optional notes | integration + component | `pytest apps/bimbingan/tests/test_session_execution.py -k complete` / active-session tests in `LecturerDashboard.test.tsx` | ✅ | ✅ green |
| — | — | — | SESSION-01, 05, 06 | — | Already implemented — covered by existing `apps/bimbingan/tests/` (32 passing) | — | (existing suite) | ✅ existing | ✅ done |

*Exact task IDs are TBD until gsd-planner produces PLAN.md — this map's requirement/test-type/command columns are locked from research; task numbering will be filled in during/after planning.*

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `backend/apps/bimbingan/tests/test_session_execution.py` — new test file covering consent, start-with-recording-flag, and complete/ts2/upload behaviors (mirrors `test_approval.py`'s `client_for()` + fixture style) — **done, 17 tests**
- [x] A small valid-WebM byte fixture (analogous to existing `pdf_file` fixture in `conftest.py`) — `webm_audio_file` fixture yielding a `BytesIO` starting with the EBML magic header `\x1a\x45\xdf\xa3`, for `SimpleUploadedFile`-based upload tests — **done, in `conftest.py`**
- [x] `frontend/src/test/setup.ts` (or a new test-only shim) — minimal `MediaRecorder`/`getUserMedia` mock, since jsdom does not implement `MediaRecorder` at all — **done, in `setup.ts`**
- [x] Decide and execute on the pre-existing `LecturerDashboard.test.tsx` failure before or alongside Phase 5 changes to that same file — **resolved upstream; baseline was green before SC3/SC4 work**

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Actual microphone recording quality/permission UX in a real browser | SESSION-03 | jsdom cannot exercise real `getUserMedia`/`MediaRecorder` hardware behavior | Open Lecturer dashboard in Chrome + Firefox + Safari, click "Mulai & Rekam", verify mic prompt, verify "Merekam…" indicator, verify Safari falls back gracefully (no WebM support) |
| Recording indicator visibility at 360px | PROJECT.md constraint | Visual/responsive check, not unit-testable | Resize browser to 360px width, confirm "Merekam…" indicator is clearly visible during an active recording |
| Data loss on tab close/refresh mid-recording | Flagged risk (not a locked requirement) | Requires manual browser interaction to reproduce | Start recording, refresh tab mid-session, confirm documented/expected behavior (no crash, session state remains consistent) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** closed 2026-07-04 — all automated items green (backend 221/221, frontend 37/37); only the Manual-Only Verifications table remains open (real mic Chrome/Firefox/Safari, 360px indicator, tab-close behavior). See `05-VERIFICATION.md` (re-verification, 6/6).
