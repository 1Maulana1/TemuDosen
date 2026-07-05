---
phase: 6
slug: stt-ai-summarization-logbook
status: draft
nyquist_compliant: false
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

*Exact task IDs are TBD until `gsd-planner` produces PLAN.md — this map's requirement/test-type/command columns are locked from `06-RESEARCH.md`'s Validation Architecture section plus the D-11 cost-tracking decision closed in `06-CONTEXT.md`; task numbering is filled in during/after planning, matching the Phase 5 precedent (`05-VALIDATION.md`).*

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-0X-TBD | TBD | 0 | — | — | Celery app wired to Django settings; `CELERY_TASK_ALWAYS_EAGER=True` in test settings; `redis`+`celery-worker` services added to docker-compose | integration | `pytest apps/logbook --collect-only` (once scaffolded) | ❌ Wave 0 | ⬜ pending |
| 06-0X-TBD | TBD | TBD | STT-01 | — | `transcribe_session` task produces a transcript from a fixture audio file (mocked `WhisperModel`) | integration (Celery eager) | `pytest apps/logbook/tests/test_logbook_tasks.py::test_transcribe_session_success -x` | ❌ Wave 0 | ⬜ pending |
| 06-0X-TBD | TBD | TBD | STT-02 | — | Audio duration captured via `info.duration` and persisted on `SessionRecording.duration_seconds` (D-02) | unit | `pytest apps/logbook/tests/test_logbook_tasks.py::test_duration_persisted -x` | ❌ Wave 0 | ⬜ pending |
| 06-0X-TBD | TBD | TBD | STT-07 | — | STT failure (corrupt/missing audio) → `SessionLogbook.status=failed` + `SystemLog(event_type=STT_FAILED)` | integration | `pytest apps/logbook/tests/test_logbook_tasks.py::test_transcribe_session_failure_logs_systemlog -x` | ❌ Wave 0 | ⬜ pending |
| 06-0X-TBD | TBD | TBD | STT-07 | — | STT timeout (simulated, 2× duration/min 5min per D-08) falls back to manual-notes editor path | integration | `pytest apps/logbook/tests/test_logbook_tasks.py::test_stt_timeout_fallback -x` | ❌ Wave 0 | ⬜ pending |
| 06-0X-TBD | TBD | TBD | STT-07 | — | LLM timeout (simulated, `LLM_BATCH_TIMEOUT_MINUTES`=180 per D-08) is logged as `LLM_TIMEOUT`, distinct from `LLM_FAILED` | integration | `pytest apps/logbook/tests/test_logbook_tasks.py::test_llm_timeout_vs_failed_distinct_event_types -x` | ❌ Wave 0 | ⬜ pending |
| 06-0X-TBD | TBD | TBD | ADMIN-05 (D-11) | — | `poll_summary_batch` persists actual input/output token counts + computed cost estimate onto `SessionLogbook` at pipeline completion (D-11: batched/cached, not real-time) | unit | `pytest apps/logbook/tests/test_logbook_tasks.py::test_token_cost_persisted_on_completion -x` | ❌ Wave 0 | ⬜ pending |
| 06-0X-TBD | TBD | TBD | ADMIN-05 (D-11) | — | Admin cost-estimate query sums pre-stored per-session values (no re-derivation from Anthropic API on dashboard load) | unit | `pytest apps/logbook/tests/test_admin_dashboard.py::test_monthly_cost_is_sum_of_stored_values -x` | ❌ Wave 0 | ⬜ pending |
| 06-0X-TBD | TBD | TBD | STT-05 | V4 | `SessionLogbook` created with correct FK/OneToOne linkage to `Session`; `source_mode` set correctly for offline/online | unit | `pytest apps/logbook/tests/test_logbook_models.py::test_session_logbook_link -x` | ❌ Wave 0 | ⬜ pending |
| 06-0X-TBD | TBD | TBD | STT-06 | V4 | Student can GET own approved logbook; 403/404 on another student's | integration | `pytest apps/logbook/tests/test_logbook_views.py::test_student_logbook_ownership -x` | ❌ Wave 0 | ⬜ pending |
| 06-0X-TBD | TBD | TBD | STT-04 | V4 | Approve endpoint enforces lecturer-owns-session + valid status transition into `approved`; unrelated lecturer gets 403 | integration | `pytest apps/logbook/tests/test_logbook_views.py::test_lecturer_approve_ownership_and_transition -x` | ❌ Wave 0 | ⬜ pending |
| 06-0X-TBD | TBD | TBD | STT-05 | V6 | `SessionLogbook.transcript`/`summary_raw` stored via the existing encrypted-field helper (same pattern as `SessionRecording`) — round-trips correctly; **known pre-existing gap, not fixed this phase:** underlying cipher is Fernet/AES-128-CBC, not the AES-256 `PROJECT.md` specifies (CLAUDE.md NFR-03) | unit | `pytest apps/logbook/tests/test_logbook_models.py::test_transcript_encrypted_at_rest_roundtrip -x` | ❌ Wave 0 | ⬜ pending |
| 06-0X-TBD | TBD | TBD | ADMIN-05 | — | Admin Dashboard endpoint returns STT/LLM `SystemLog` counts filtered by `event_type` set (`STT_FAILED`, `STT_TIMEOUT`, `LLM_FAILED`, `LLM_TIMEOUT`, `LLM_VALIDATION_FAILED`, `LLM_DISABLED`, `STT_DISABLED`) | integration | `pytest apps/logbook/tests/test_admin_dashboard.py::test_stt_llm_job_counts -x` | ❌ Wave 0 | ⬜ pending |
| 06-0X-TBD | TBD | TBD | VIDEO-01 | — | `JitsiVideoProvider` component mounts with correct `roomName`/`domain` props; loading/error states render per S-16 | unit (Vitest/RTL) | `npm run test -- --run JitsiVideoProvider` | ❌ Wave 0 | ⬜ pending |
| 06-0X-TBD | TBD | TBD | VIDEO-02 | — | Online-session recording upload succeeds via D-17 lecturer-mic-only path (unchanged `useMediaRecorder` flow — now the confirmed shipped default, not a fallback) | integration | `pytest apps/bimbingan/tests/test_session_recording.py::test_online_session_lecturer_mic_only_recording -x` | ❌ Wave 0 | ⬜ pending |

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
