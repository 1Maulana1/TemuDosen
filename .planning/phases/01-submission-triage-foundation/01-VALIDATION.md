---
phase: 1
slug: submission-triage-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-23
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | pytest 8.x + pytest-django 4.x |
| **Framework (frontend)** | Vitest 2.x (bundled with Vite) |
| **Config file (backend)** | `backend/pytest.ini` — Wave 0 creates |
| **Config file (frontend)** | `frontend/vite.config.ts` (test block) — Wave 0 adds |
| **Quick run (backend)** | `pytest backend/ -x -q --tb=short` |
| **Quick run (frontend)** | `cd frontend && npx vitest run --reporter=dot` |
| **Full suite** | `pytest backend/ -q && cd frontend && npx vitest run` |
| **Estimated runtime** | ~20 seconds (no E2E in Phase 1) |

---

## Sampling Rate

- **After every task commit:** Run `pytest backend/ -x -q --tb=short`
- **After every plan wave:** Run full suite (both backend + frontend)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Planner fills concrete task IDs and threat refs after creating PLAN.md files.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 0 | TRIAGE-01 | T-1-01 / — | CustomUser AUTH_USER_MODEL set before first migrate | unit | `pytest backend/accounts/tests/ -x -q` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 0 | TRIAGE-01 | T-1-02 / — | CSRF token endpoint returns 200 + sets csrftoken cookie | unit | `pytest backend/core/tests/test_csrf.py -x -q` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | TRIAGE-01 | T-1-03 | PDF upload rejects non-PDF MIME type with 400 | unit | `pytest backend/submissions/tests/test_upload.py -x -q` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | TRIAGE-01 | T-1-04 | File >5MB returns 400, not stored on disk | unit | `pytest backend/submissions/tests/test_upload.py::test_file_size_limit -x -q` | ❌ W0 | ⬜ pending |
| 1-02-03 | 02 | 1 | TRIAGE-02 | T-1-05 | File served via /api/files/<uuid>/ returns 403 for non-owner | unit | `pytest backend/submissions/tests/test_file_access.py -x -q` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 1 | REVIEW-01 | — | Lecturer sees only their own students' submissions | unit | `pytest backend/submissions/tests/test_lecturer_view.py -x -q` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 1 | ADMIN-01 | — | Symptom weight update persists after save | unit | `pytest backend/symptoms/tests/ -x -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/accounts/tests/__init__.py` + `test_models.py` — stubs for TRIAGE-01 user model
- [ ] `backend/submissions/tests/__init__.py` + `test_upload.py` + `test_file_access.py` — stubs for TRIAGE-01, TRIAGE-02
- [ ] `backend/submissions/tests/test_lecturer_view.py` — stub for REVIEW-01
- [ ] `backend/symptoms/tests/__init__.py` + `test_views.py` — stubs for ADMIN-01
- [ ] `backend/core/tests/test_csrf.py` — CSRF endpoint smoke test
- [ ] `backend/pytest.ini` — `DJANGO_SETTINGS_MODULE=config.settings.test`
- [ ] `backend/conftest.py` — shared `api_client`, `student_user`, `lecturer_user`, `admin_user` fixtures
- [ ] `frontend/src/test/setup.ts` — Vitest DOM setup + MSW mock server

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PDF preview renders in iframe at 360px mobile width | TRIAGE-01 | Browser rendering, not testable headlessly in Phase 1 | Open submission form on 360px viewport; click "Lihat Draft"; verify PDF renders without horizontal scroll |
| Pending approval banner shown to unapproved user on login | TRIAGE-01 | Session state + redirect flow | Register new user; log in before admin approval; verify banner page shown, no nav access |
| Admin symptom seed data present after `python manage.py seed` | ADMIN-01 | Management command output | Run `python manage.py seed`; open `/admin/katalog-gejala`; verify 6 default entries exist |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
