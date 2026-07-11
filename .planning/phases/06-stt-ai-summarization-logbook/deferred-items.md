# Deferred Items — Phase 06 (STT, AI Summarization & Logbook)

## 06-02: pre-existing `python-magic` environment blocker (out of scope for this plan)

**Found during:** 06-02 Task 1 verification (`python manage.py makemigrations logbook bimbingan --check --dry-run`).

**Issue:** Any Django management command that loads the full URL/app registry (which
`makemigrations`/`pytest` both do) transitively imports `apps/submissions/serializers.py`,
which does `import magic` (the `python-magic==0.4.27` package, pinned in
`backend/requirements.txt`, pre-existing since Phase 1). On this machine's venv
(`backend/.venv`), only `python-magic` is installed — **not** `python-magic-bin`
(the package that bundles a working `libmagic` binary for Windows) — and no system
`libmagic`/`magic1.dll` is reachable either. `python-magic`'s `magic.loader` then calls
`ctypes.util.find_library`, which hangs indefinitely on this Windows environment
(confirmed via isolated `import magic` alone: hung >100s with zero output, no traceback,
no crash — a true hang, not a slow-but-completing import).

**Isolation performed (not a fix, purely diagnostic):**
- `python -c "import django; django.setup()"` — completes in <1s (not the cause).
- `import ctranslate2` / `import faster_whisper` (Phase 6's new STT deps) — both import
  fine in ~1.5–1.8s each (not the cause).
- `import pydantic` — fine (not the cause).
- `python -X importtime` on `apps.submissions.urls` shows the last frame before the hang
  is `ctypes.util` → `magic.loader` (i.e. `apps.submissions.filters` → `apps.submissions.serializers`
  → `import magic`).
- Isolated `import magic` alone (zero Django involvement) reproduces the same >100s hang.

**Why this is out of scope for 06-02:** This plan's files (`backend/apps/logbook/models.py`,
`backend/apps/logbook/schemas.py`, `backend/apps/bimbingan/models.py`'s new
`duration_seconds` field) do not import `magic`, `python-magic`, or anything from
`apps/submissions`. The hang is 100% reproducible with zero Phase 6 code involved — it is
a pre-existing Windows-venv packaging gap in Phase 1's file-upload validation path
(`apps/submissions/serializers.py`), not something introduced by this plan.

**Impact:** Every `python manage.py <command>` and every `pytest` invocation in this repo
hangs on this machine until this is resolved — this blocks not just 06-02 but any future
plan's verify step that runs Django/pytest here.

**Recommended fix (not applied — needs human sign-off per the package-install exclusion
in the executor's Rule 3):** install `python-magic-bin` (Windows-only wheel bundling
`libmagic`) into `backend/.venv`, or point `python-magic` at a system-installed `libmagic`
DLL. This is a package-manager install decision, not an auto-fixable bug — flagging for
the human rather than silently installing an additional package.

**Status:** Logged, not fixed. 06-02 Task 1 and Task 2 verify commands could not be run
to completion in this environment as a direct result.
