---
phase: 6
slug: stt-ai-summarization-logbook
status: draft
nyquist_compliant: false
# 2026-07-05 (later): reconciled to 21 real tasks (06-06 gained Task 4 to close
# the anti-rubber-stamp behavioral-test gap; 06-08-T2's recording-path invariant
# promoted from a textual acceptance-criteria note to an automated exact-count
# check). Still false: feedback-latency remains unmeasured, and 06-06-T2/06-07-T2
# are still build-only with no dedicated behavioral test.
wave_0_complete: false
created: 2026-07-05
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | pytest 9.1.x + pytest-django 4.12.x (existing project stack, `backend/pytest.ini`) |
| **Framework (frontend)** | Vitest + @testing-library/react (existing project stack, established in Phase 5) |
| **Config file (backend)** | `backend/pytest.ini` (existing — `DJANGO_SETTINGS_MODULE=config.settings.test`) |
| **Config file (frontend)** | `frontend/package.json` (`"test": "vitest run"`), `frontend/src/test/setup.ts` |
| **Quick run command (backend)** | `pytest apps/logbook -q` (from `backend/`, project venv activated) |
| **Quick run command (frontend)** | `npm run test -- --run JitsiVideoProvider` (from `frontend/`) |
| **Full suite command (backend)** | `pytest -q` (from `backend/`) |
| **Full suite command (frontend)** | `npm run test -- --run` (from `frontend/`) |
| **Estimated runtime** | Not measured this session. Baseline pre-Phase-6 is 221 backend / 37 frontend tests (`STATE.md`) — take a fresh `time pytest -q` reading once Wave 0 lands, since a real faster-whisper model load in tests could change this materially (see Wave 0 Requirements) |

**New test-settings requirement (Wave 0, per `06-RESEARCH.md` Validation Architecture):** `config/settings/test.py` must set `CELERY_TASK_ALWAYS_EAGER = True` so `transcribe_session` / `submit_summary_batch` / `poll_summary_batch` run synchronously in-process during tests — no live Redis broker required for the suite.

---

## Sampling Rate

- **After every task commit:** `pytest apps/logbook -q` (backend) / `npm run test -- --run <changed-file>.test.tsx` (frontend)
- **After every plan wave:** Full backend suite (`pytest -q`) + full frontend suite (`npm run test -- --run`)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ≤120s target for the quick-run loop (ceiling, not a measured baseline — re-check once Wave 0's faster-whisper test fixture strategy is known; a real model load per test run would blow this budget, so STT unit tests should mock `WhisperModel` rather than load the real 484MB model)

---

## Per-Task Verification Map

*Reconciled 2026-07-05 against the real 06-01..06-09 PLAN.md files (21 tasks across 9 plans, after 06-06 gained Task 4). The pre-planning "STT-05/V6 encrypted-at-rest" row was removed — no task implements it; 06-02-PLAN.md's threat model (T-06-03) explicitly accepts plaintext transcript/summary_raw storage as a carried-forward gap, not something encrypted-then-tested. Automated Command values are copied verbatim from each plan's own `<verify>` block.*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---|---|---|---|---|---|---|---|---|---|
| 06-01-T1 | 06-01 | 0 | — | T-06-SC | Human confirms faster-whisper/celery/redis/anthropic/pydantic are legitimate official packages before first install | human-verify (blocking, non-auto-approvable) | — (human types "approved") | ❌ Wave 0 | ⬜ pending |
| 06-01-T2 | 06-01 | 0 | — | — | celery_app importable; STT_LLM_ENABLED=False; LLM_MODEL='claude-haiku-4-5'; apps.logbook installed; no invalid model id | integration | `cd backend && DJANGO_SETTINGS_MODULE=config.settings.test python -c "...; print('OK')"` + `pytest apps/logbook --collect-only` | ❌ Wave 0 | ⬜ pending |
| 06-01-T3 | 06-01 | 0 | — | T-06-01 | redis+celery-worker docker-compose services validate; Redis has no `ports:` mapping | config validation | `docker compose -f docker-compose.yml config >/dev/null && docker compose -f docker-compose.dev.yml config >/dev/null && echo "COMPOSE_OK"` | ❌ Wave 0 | ⬜ pending |
| 06-02-T1 | 06-02 | 1 | STT-05, STT-02 | — | SessionLogbook OneToOne-links to Session with D-06 6-state lifecycle + D-11 token/cost fields; SessionRecording.duration_seconds added; no leak onto Session | unit + migration check | `python manage.py makemigrations logbook bimbingan --check --dry-run && pytest apps/logbook/tests/test_logbook_models.py -q` | ❌ Wave 0 | ⬜ pending |
| 06-02-T2 | 06-02 | 1 | STT-03 | T-06-04 | SessionSummary Pydantic schema validates honest-empty arrays, rejects placeholder filler, exposes model_json_schema(); no token/cost fields on schema | unit | `pytest apps/logbook/tests/test_logbook_models.py -q` | ❌ Wave 0 | ⬜ pending |
| 06-03-T1 | 06-03 | 2 | STT-01 | — | transcribe_audio (mocked WhisperModel) returns (transcript, duration); model loaded once via worker_process_init | unit (mocked, no real model) | `pytest apps/logbook/tests/test_logbook_services.py -q -k stt` | ❌ Wave 0 | ⬜ pending |
| 06-03-T2 | 06-03 | 2 | STT-03 | T-06-07 | TOOL_SCHEMA==SessionSummary.model_json_schema() strict=True; build_batch_request fields correct; submit_batch skipped when disabled; parse_result success/failure; compute_cost_idr matches D-11 batch rate | unit (mocked Anthropic client) | `pytest apps/logbook/tests/test_logbook_services.py -q -k "summar or cost or batch"` | ❌ Wave 0 | ⬜ pending |
| 06-04-T1 | 06-04 | 2 | STT-06, V4 | T-06-08, T-06-10 | Lecturer list advisee-scoped; lecturer detail 403 non-owner; student sees approved-owned only (403 unapproved, 404 not-owned) | integration | `pytest apps/logbook/tests/test_logbook_views.py -q -k "list or detail or student"` | ❌ Wave 0 | ⬜ pending |
| 06-04-T2 | 06-04 | 2 | STT-04, STT-07 | T-06-08, T-06-09 | Approve: ready_for_review→approved only, 400 wrong-state, 403 non-owner; manual-notes: failed→approved+is_manual, 400 non-failed | integration | `pytest apps/logbook/tests/test_logbook_views.py -q -k "approve or manual" && python manage.py check` | ❌ Wave 0 | ⬜ pending |
| 06-05-T1 | 06-05 | 3 | STT-01, STT-02, STT-07 | — | transcribe_session: success (transcript+duration+summarizing+enqueue); STT_DISABLED; STT_FAILED (exception); empty-transcript gate; CompleteSessionView non-blocking | integration (Celery eager) | `pytest apps/logbook/tests/test_logbook_tasks.py -q -k "transcribe or complete or duration or disabled"` | ❌ Wave 0 | ⬜ pending |
| 06-05-T2 | 06-05 | 3 | STT-03, STT-07, ADMIN-05 | — | submit/poll batch chain; token/cost persisted once at completion (D-11); LLM_TIMEOUT vs LLM_FAILED distinct; LLM_VALIDATION_FAILED + one retry; groundedness flag | integration (Celery eager) | `pytest apps/logbook/tests/test_logbook_tasks.py -q -k "summar or poll or token or cost or timeout or grounded or valid"` | ❌ Wave 0 | ⬜ pending |
| 06-06-T1 | 06-06 | 4 | STT-04, STT-06 | — | LogbookStatusBadge renders correct Bahasa label per status; transcribing/summarizing carry role="status" aria-live | unit (Vitest/RTL) | `npm run test -- --run LogbookStatusBadge` | ❌ Wave 0 | ⬜ pending |
| 06-06-T2 | 06-06 | 4 | STT-06, STT-07 | — | Lecturer list per-status actions + empty state; student read-only view; manual-notes screen; SessionTable gated action | build/compile only (no dedicated component test in plan) | `npm run build` | ❌ Wave 0 | ⬜ pending |
| 06-06-T3 | 06-06 | 4 | STT-04 | T-06-15, T-06-16 | Approve button disabled until transcript expanded once; "Perlu Verifikasi" chip always-visible + top-sorted; permanence modal | build/lint only — behavioral proof now lives in 06-06-T4 | `npm run build && npm run lint` | ❌ Wave 0 | ⬜ pending |
| 06-06-T4 | 06-06 | 4 | STT-04 | T-06-15, T-06-16 | Added post-reconciliation to close 06-06-T3's coverage gap: `disabled_until_transcript_expanded`, `stays_enabled_after_recollapse`, `ungrounded_chip_renders_and_sorted_first`, `click_opens_approve_modal` | unit (Vitest/RTL, component behavior) | `cd frontend && npm run build && npm run lint && npm run test -- --run LecturerLogbookReview` | ❌ Wave 0 | ⬜ pending |
| 06-07-T1 | 06-07 | 4 | ADMIN-05 | T-06-17, T-06-18 | stt_llm block: job counts + monthly_cost_idr as SUM of stored values (not recomputed); non-admin 403 | unit + integration | `pytest apps/bimbingan/tests/test_admin.py -q -k "stt or llm or cost or admin_stats"` | ❌ Wave 0 | ⬜ pending |
| 06-07-T2 | 06-07 | 4 | ADMIN-05 | — | "Pemrosesan STT/AI" section renders cost card, monthly aggregate dominant + per-session sub-text | build/compile only | `npm run build` | ❌ Wave 0 | ⬜ pending |
| 06-08-T1 | 06-08 | 5 | VIDEO-01 | T-06-19, T-06-20 | JitsiVideoProvider mounts with correct roomName/domain; loading→ready via mocked onApiReady; no dual-audio mixing code | unit (Vitest/RTL, jsdom mock) | `npm run test -- --run JitsiVideoProvider` | ❌ Wave 0 | ⬜ pending |
| 06-08-T2 | 06-08 | 5 | VIDEO-01, VIDEO-02 | T-06-21 | Both active-session cards embed JitsiVideoProvider; recording-path exact-count invariant holds (useMediaRecorder x2 / recorder.isRecording x1 / "Merekam" x1 in LecturerDashboard.tsx, baseline verified 2026-07-05); no apps/logbook file touched | build + full frontend regression + exact-count invariant | `cd frontend && npm run build && npm run test -- --run && grep -c "useMediaRecorder" src/pages/lecturer/LecturerDashboard.tsx \| grep -qx "2" && grep -c "recorder.isRecording" src/pages/lecturer/LecturerDashboard.tsx \| grep -qx "1" && grep -c "Merekam" src/pages/lecturer/LecturerDashboard.tsx \| grep -qx "1" && echo "RECORDING_SYMBOLS_INTACT"` | ❌ Wave 0 | ⬜ pending |
| 06-09-T1 | 06-09 | 6 | STT-01..07 | T-06-22, T-06-23 | Offline+online+disabled+STT-failure paths reach ready_for_review→approved→student-visible in eager mode with mocked STT/LLM | integration (Celery eager, E2E) | `pytest apps/logbook/tests/test_logbook_integration.py -q` | ❌ Wave 0 | ⬜ pending |
| 06-09-T2 | 06-09 | 6 | VIDEO-02 | — | Online recording reuses the exact offline CompleteSessionView path; SessionRecording + SessionLogbook(source_mode='online') created identically; full backend suite green | integration + full-suite regression | `pytest apps/bimbingan/tests/test_session_recording.py -q -k online && pytest -q` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/apps/logbook/` app scaffold (models, tasks, services, migrations) — does not exist yet
- [ ] `backend/config/celery.py` + `config/__init__.py` update — Celery app wiring (`06-RESEARCH.md` Pattern 1)
- [ ] `config/settings/test.py`: `CELERY_TASK_ALWAYS_EAGER = True` so Celery tasks run synchronously in the test suite without a live Redis broker
- [ ] `backend/apps/logbook/tests/test_logbook_tasks.py`, `test_logbook_models.py`, `test_logbook_views.py`, `test_admin_dashboard.py` (STT/LLM section) — new test files
- [ ] Fixture audio file(s) for STT integration tests (short, real or synthetic Indonesian speech clip) — mirrors the `webm_audio_file` fixture pattern already established in Phase 5's `conftest.py`
- [ ] Mock/stub for `WhisperModel` in unit tests — do not load the real ~484MB model in the standard test run (keeps the ≤120s quick-run budget realistic)
- [ ] `docker-compose.yml` / `docker-compose.dev.yml` — `redis` + `celery-worker` service additions (`06-RESEARCH.md` Pattern 2/Code Examples) — required before any integration test that exercises the real broker (as opposed to eager mode)
- [ ] `frontend/src/components/video/JitsiVideoProvider.tsx` test scaffold — `@jitsi/react-sdk`'s `JitsiMeeting` needs a test-only mock/stub (a real Jitsi iframe cannot mount in jsdom), analogous to Phase 5's `MediaRecorder`/`getUserMedia` shim in `frontend/src/test/setup.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Real two-party Jitsi video call connects and renders audio/video for both lecturer and student | VIDEO-01 | jsdom cannot exercise real WebRTC/iframe media negotiation; `meet.jit.si` is a live public third-party service | Lecturer opens an online session, student joins from a second browser/device; confirm both video feeds render, mute state syncs (`audioMuteStatusChanged`), and the S-16 error/"Coba Lagi" state appears correctly if a party denies camera/mic permission |
| Lecturer-mic-only transcript quality on real mixed/code-switched Indonesian speech | STT-01/STT-03 (AI-SPEC.md domain FM #2) | faster-whisper's real accuracy on informal, code-switched speech isn't unit-testable — needs a Bahasa Indonesia speaker to judge quality against real audio | Record a short real bimbingan-style conversation (formal Indonesian + fillers + English loanwords), run it through the deployed pipeline, have a lecturer compare the transcript against what was actually said |
| Groundedness flag chip (S-13) actually draws lecturer attention under time pressure | AI-SPEC.md FM #5 (rubber-stamp approval) | Human-factors/UX question, not a unit-testable assertion — the entire point of the flag is whether a real, busy lecturer notices it | Seed a summary with a deliberately-planted unsupported advice item across 2-3 lecturers reviewing under normal time pressure; observe whether the flag gets noticed before approval |
| Admin cost-estimate card matches actual Anthropic Console billing | D-11 | Requires a real API key + real invoiced spend to cross-check the configurable rate setting against Anthropic's actual bill — nothing to assert against in a test environment | Once `ANTHROPIC_API_KEY` is provisioned and `STT_LLM_ENABLED=True` in a real environment, compare the dashboard's monthly aggregate against `console.anthropic.com`'s billing page for the same period |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending — this is a pre-planning scaffold. Task IDs and final sign-off happen once `gsd-planner` produces PLAN.md and Wave 0 executes (see Phase 5's `05-VALIDATION.md` for the equivalent post-planning update pattern).
