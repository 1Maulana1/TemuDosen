---
phase: 06-stt-ai-summarization-logbook
plan: "01"
subsystem: infra
tags: [celery, redis, docker-compose, django-settings, faster-whisper, anthropic, feature-flag]

# Dependency graph
requires:
  - phase: 05-session-execution-with-recording-consent
    provides: "SessionRecording audio files at MEDIA_ROOT/recordings/<uuid>.webm — the input the STT pipeline will transcribe"
provides:
  - "Celery app (celery_app) importable at Django startup via config/__init__.py, autodiscovering @shared_task project-wide"
  - "Phase 6 settings block in base.py: CELERY_*, STT_*, LLM_*, ANTHROPIC_API_KEY, LLM cost-rate env vars, MAX_TRANSCRIPT_TOKENS"
  - "CELERY_TASK_ALWAYS_EAGER/EAGER_PROPAGATES in test.py — tasks run synchronously in tests, no broker needed"
  - "apps.logbook Django app scaffold (LogbookConfig), registered in INSTALLED_APPS, collectable by pytest"
  - "redis + celery-worker docker-compose services (both docker-compose.yml and docker-compose.dev.yml), Redis internal-network-only"
  - "requirements.txt: faster-whisper==1.2.1, celery==5.6.3, redis==8.0.1, anthropic>=0.69, pydantic>=2.7"
affects:
  - "06-02 through 06-09 — every subsequent Phase 6 plan (STT task, LLM summarization task, logbook models/UI, Jitsi integration test) builds directly on this Celery/Redis/settings/apps.logbook foundation"

# Tech tracking
tech-stack:
  added:
    - "celery==5.6.3"
    - "redis==8.0.1"
    - "faster-whisper==1.2.1"
    - "anthropic>=0.69"
    - "pydantic>=2.7"
  patterns:
    - "Celery app instantiated in config/celery.py, config_from_object('django.conf:settings', namespace='CELERY'), imported as celery_app in config/__init__.py (standard Celery-Django wiring)"
    - "No CELERY_RESULT_BACKEND set — durable pipeline state lives in Django models (SessionLogbook/SystemLog), tasks use ignore_result=True"
    - "CELERY_TASK_ALWAYS_EAGER=True in test settings — pipeline tests run inline, no live Redis broker required in CI/local test runs"
    - "STT_LLM_ENABLED feature flag (default False, D-04) gates the entire pipeline; safe to deploy infra before the pipeline is functional"
    - "Redis given no ports: mapping in docker-compose — broker reachable only on the internal Docker network (T-06-01 mitigation)"
    - "celery-worker shares the web service's storage_data volume so recordings and the whisper model cache are accessible to the worker"

key-files:
  created:
    - "backend/config/celery.py"
    - "backend/apps/logbook/__init__.py"
    - "backend/apps/logbook/apps.py"
    - "backend/apps/logbook/tests/__init__.py"
  modified:
    - "backend/config/__init__.py"
    - "backend/config/settings/base.py"
    - "backend/config/settings/test.py"
    - "backend/requirements.txt"
    - "docker-compose.yml"
    - "docker-compose.dev.yml"

key-decisions:
  - "Package legitimacy checkpoint (Task 1) approved after manual PyPI verification: celery/redis/faster-whisper/anthropic confirmed as legitimate, officially-maintained projects — the 06-RESEARCH.md [SUS] tags were false positives from a seam that misread release timestamps as project age"
  - "celery==5.6.3 pinned together with redis==8.0.1, with an inline requirements.txt comment plus a STATE.md todo, documenting a known celery/celery#10294 result-backend pubsub regression (not exercised here since Redis is broker-only, no CELERY_RESULT_BACKEND) — future edits must not let the two versions drift apart independently"
  - "LLM cost-rate settings (LLM_INPUT_RATE_USD_PER_MTOK/LLM_OUTPUT_RATE_USD_PER_MTOK) default to the Anthropic BATCH tier ($0.50/$2.50), not the standard $1/$5 rate, to match 06-AI-SPEC.md Section 4b's budget (D-11)"
  - "apps/logbook/apps.py deliberately has no ready() scheduler hook — unlike apps.bimbingan's APScheduler pattern, Celery workers are started by docker-compose, not from within Django app startup"

patterns-established:
  - "Pattern: Phase 6 settings block appended directly after RECORDING_MAX_UPLOAD_SIZE in base.py, mirroring the existing env()/env.bool()/env.int() style used throughout the file"
  - "Pattern: celery-worker docker-compose service mirrors web's build/volumes/environment blocks exactly, differing only in command and Phase-6-specific env vars — keeps the two services from drifting on shared config"

requirements-completed: []

# Metrics
duration: "~20min (Tasks 2-3 automated; Task 1 human checkpoint)"
completed: "2026-07-05"
status: complete
---

# Phase 06 Plan 01: Celery/Redis Infrastructure + apps.logbook Scaffold Summary

**Celery app wired to Django settings with a full Phase-6 STT/LLM settings block (feature-flagged off by default), apps.logbook scaffolded, and redis + celery-worker added to both docker-compose files with Redis kept off the host network**

## Performance

- **Duration:** ~20 min (Task 2 + Task 3 automated; Task 1 human-verify checkpoint)
- **Started:** 2026-07-05T08:59:56+07:00 (approx., first plan-related commit)
- **Completed:** 2026-07-05T16:19:21+07:00
- **Tasks:** 3 (1 checkpoint:human-verify + 2 auto)
- **Files modified:** 10 (6 created, 4 modified across backend config/settings + 2 docker-compose files + requirements.txt)

## Accomplishments

- Package legitimacy checkpoint (Task 1) approved by the human after confirming faster-whisper, celery, redis, and anthropic against their official PyPI pages — the 06-RESEARCH.md `[SUS]` verdicts were confirmed false positives
- `config/celery.py` created and wired into `config/__init__.py` (`celery_app` importable at Django startup, `autodiscover_tasks()` active) — first async task infrastructure in the codebase
- Full Phase 6 settings block added to `base.py`: Celery broker/timezone/time-limit settings, `STT_LLM_ENABLED` feature flag (default `False`), STT model config (`small`/`int8`/`id`), `LLM_MODEL=claude-haiku-4-5`, `ANTHROPIC_API_KEY` placeholder, batch cost-rate settings, `MAX_TRANSCRIPT_TOKENS`
- `CELERY_TASK_ALWAYS_EAGER`/`EAGER_PROPAGATES` added to `test.py` so the test suite never needs a live Redis broker
- `apps.logbook` (`LogbookConfig`) scaffolded and registered in `INSTALLED_APPS`, collectable by pytest with zero test-collection errors
- `redis` (no host port mapping) and `celery-worker` (shares `web`'s build/volumes/environment, differs only in command + Phase-6 env vars) added to both `docker-compose.yml` and `docker-compose.dev.yml`, `redis_data` volume declared

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy checkpoint** — APPROVED (human-verify, no commit; five package pages confirmed legitimate)
2. **Task 2: Add dependencies, wire Celery app, add settings, scaffold apps.logbook** — `a1c94f1` (feat)
3. **Task 3: Add redis + celery-worker docker-compose services** — `c3733e8` (feat)

**Plan metadata:** `38fe908` (plan: document celery/redis pin-together rationale — committed ahead of Task 2/3 as part of finalizing the plan's requirements.txt comment)

## Files Created/Modified

- `backend/config/celery.py` — Celery app (`Celery('temudosen')`), `config_from_object('django.conf:settings', namespace='CELERY')`, `autodiscover_tasks()`
- `backend/config/__init__.py` — `from .celery import app as celery_app`, `__all__ = ('celery_app',)`
- `backend/config/settings/base.py` — Phase 6 settings block (Celery/STT/LLM/cost-rate env vars) + `apps.logbook` added to `INSTALLED_APPS`
- `backend/config/settings/test.py` — `CELERY_TASK_ALWAYS_EAGER = True`, `CELERY_TASK_EAGER_PROPAGATES = True`
- `backend/apps/logbook/__init__.py` — empty, new app package
- `backend/apps/logbook/apps.py` — `LogbookConfig(AppConfig)`, `name='apps.logbook'`, no `ready()` hook
- `backend/apps/logbook/tests/__init__.py` — empty, test package scaffold
- `backend/requirements.txt` — `faster-whisper==1.2.1`, `celery==5.6.3`, `redis==8.0.1` (with inline #10294 pin-together comment), `anthropic>=0.69`, `pydantic>=2.7`
- `docker-compose.yml` — `redis` service (no `ports:`), `celery-worker` service, `redis_data` volume
- `docker-compose.dev.yml` — same additions with the `_dev` naming convention

## Decisions Made

- **Package legitimacy checkpoint approved as-is**: all five packages (faster-whisper, celery, redis, anthropic, and the already-`[OK]` `@jitsi/react-sdk`) confirmed against official PyPI/npm pages; no substitutions needed.
- **celery/redis version pin-together rationale documented inline**: `celery==5.6.3` has a known Redis result-backend pubsub reconnect regression (celery/celery#10294) affecting redis-py < 5.3.0. Not exercised in this codebase (Redis is broker-only, `CELERY_RESULT_BACKEND` intentionally unset, `ignore_result=True` will be used on tasks), but the requirements.txt comment and a corresponding STATE.md todo entry warn future editors not to let the two pins drift apart independently. A separate, unrelated observation from the same review — Redis's own broker-side (kombu) reconnect resilience — was noted as worth exercising in Wave 6 (06-09), not because of #10294.
- **No `ready()` scheduler hook on `LogbookConfig`**: unlike `apps.bimbingan`'s APScheduler pattern, Celery workers are started by docker-compose as a separate process, not from within Django's app-startup lifecycle.
- **LLM cost rates default to the Anthropic Batch API tier** ($0.50/$2.50 per MTok), not the standard $1/$5 rate, per D-11 and 06-AI-SPEC.md Section 4b's budget — left env-configurable with a comment to reconcile against live billing before go-live.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created a fresh `backend/.venv` to run the plan's verification commands**
- **Found during:** Task 2 (settings/Celery wiring verification)
- **Issue:** The plan's `<verify>` step requires running a Python one-liner (`django.setup()`, import `celery_app`, assert settings) and `pytest apps/logbook --collect-only` against the newly-added dependencies (`celery`, `anthropic`, `pydantic`, etc.), but no isolated Python environment with these packages existed yet.
- **Fix:** Created `backend/.venv` (already covered by `.gitignore`/`backend/.gitignore`) and installed `requirements.txt` into it to run the verification commands.
- **Files modified:** None tracked (`.venv` is gitignored, not committed).
- **Verification:** Verification one-liner printed `OK`; `pytest apps/logbook --collect-only` exited without collection errors.
- **Committed in:** N/A — environment-only change, no commit.

**2. [Rule 1 - Correctness] Added the celery/celery#10294 issue reference inline into the requirements.txt comment**
- **Found during:** Task 2 (requirements.txt comment authored)
- **Issue:** The plan's action text specified the pin-together rationale comment wording but the issue reference (`celery/celery#10294`) needed to be embedded inline in the comment itself so the acceptance-criteria grep check (`grep -c "celery/celery#10294" backend/requirements.txt` ≥1) would pass.
- **Fix:** Reworded the comment to include `(celery/celery#10294)` inline rather than only in the commit message/plan doc.
- **Files modified:** `backend/requirements.txt`
- **Verification:** `grep -c "celery/celery#10294" backend/requirements.txt` returns ≥1.
- **Committed in:** `a1c94f1` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking/environment, 1 correctness/wording)
**Impact on plan:** Both were necessary to satisfy the plan's own acceptance criteria; no scope creep, no unplanned files touched beyond the venv (untracked).

## Issues Encountered

None beyond the two auto-fixes above.

## User Setup Required

None — `STT_LLM_ENABLED` defaults to `False` and `ANTHROPIC_API_KEY` defaults to an empty-string placeholder, so no external service configuration is required to merge this plan. Real Anthropic API key + toggling the feature flag on will be needed later (before Wave 2/3 pipeline work goes live), not for this plan.

## Next Phase Readiness

Ready for Wave 1 (06-02 onward):
- `celery_app` importable, `@shared_task` discoverable project-wide
- Test suite runs Celery tasks eagerly — no broker dependency in CI/local tests
- `apps.logbook` installed and collectable, ready for models/migrations in the next plan
- Redis + celery-worker running as docker-compose services, network-isolated, sharing the `storage_data` volume with `web` (recordings + future whisper model cache)
- All STT/LLM settings present with safe (feature-flagged-off) defaults

No blockers.

---
*Phase: 06-stt-ai-summarization-logbook*
*Completed: 2026-07-05*
