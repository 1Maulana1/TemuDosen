---
phase: 01-submission-triage-foundation
plan: "01"
subsystem: auth
tags: [django, react, vite, tailwind, session-auth, csrf, custom-user, drf, vitest]

# Dependency graph
requires: []
provides:
  - "CustomUser (AbstractBaseUser) with role/nim/nidn/is_approved/adviser/google_oauth_token"
  - "AUTH_USER_MODEL = accounts.CustomUser set before first migration"
  - "Session + CSRF auth: GET /api/csrf/, POST /api/auth/login/, POST /api/auth/logout/, GET /api/auth/me/"
  - "Permission classes: IsApprovedUser, IsStudent, IsLecturer, IsAdmin"
  - "seed_admin management command (admin@temudosen.ac.id + kaprodi)"
  - "React 18 + Vite frontend with Tailwind v4 @theme tokens"
  - "createBrowserRouter with all Phase-1 routes + requireAuth/requireRole loaders"
  - "apiRequest wrapper (credentials:include + X-CSRFToken injection)"
  - "LoginPage (S-04) wired to backend auth"
  - "pytest fixtures: api_client, student_user, lecturer_user, admin_user"
  - "Settings split: base / dev / prod / test"
affects:
  - "01-02-PLAN.md — self-registration, approval gate, approved-lecturer dropdown (builds on auth endpoints)"
  - "01-03-PLAN.md — SymptomCategory model (uses CustomUser, settings, conftest)"
  - "01-04-PLAN.md — submission form (uses router, api client, permission classes)"
  - "01-05-PLAN.md — lecturer review dashboard (uses MeView, IsLecturer, router)"
  - "All future plans — depend on CustomUser, session auth, API client, Tailwind tokens"

# Tech tracking
tech-stack:
  added:
    - "django==5.2.*"
    - "djangorestframework==3.17.*"
    - "django-cors-headers==4.9.*"
    - "django-environ==0.14.*"
    - "django-filter==25.2"
    - "python-magic==0.4.27 (+ python-magic-bin dev, Windows)"
    - "pytest==9.1.* + pytest-django==4.12.*"
    - "factory-boy==3.3.*"
    - "react 18 + react-router v7"
    - "@tailwindcss/vite + @tailwindcss/forms (Tailwind v4)"
    - "vitest"
  patterns:
    - "AbstractBaseUser (not AbstractUser) — avoids username/first_name/last_name conflicts with NIM/NIDN"
    - "AUTH_USER_MODEL set in base.py BEFORE first makemigrations (Pitfall 1 prevention)"
    - "Django server-side sessions (D-21) — no JWT"
    - "CSRF: GET /api/csrf/ sets non-HttpOnly cookie; client reads and injects as X-CSRFToken header"
    - "Vite proxy /api → :8000 makes SPA requests same-origin in dev (no withCredentials CORS issues)"
    - "Tailwind v4 @theme CSS custom properties in index.css — no tailwind.config.js (Pitfall 4)"
    - "React Router 7 loaders for requireAuth/requireRole — unapproved users redirect to /pending-approval"
    - "getCSRFToken() awaited in main.tsx before RouterProvider renders"
    - "Settings split: base/dev/prod/test with django-environ reading SECRET_KEY + DATABASE_URL"

key-files:
  created:
    - "backend/apps/accounts/models.py"
    - "backend/apps/accounts/managers.py"
    - "backend/apps/accounts/serializers.py"
    - "backend/apps/accounts/views.py"
    - "backend/apps/accounts/permissions.py"
    - "backend/apps/accounts/urls.py"
    - "backend/apps/accounts/admin.py"
    - "backend/apps/accounts/management/commands/seed_admin.py"
    - "backend/apps/accounts/migrations/0001_initial.py"
    - "backend/apps/accounts/tests/test_models.py"
    - "backend/apps/accounts/tests/test_auth.py"
    - "backend/core/views.py"
    - "backend/core/urls.py"
    - "backend/core/tests/test_csrf.py"
    - "backend/config/settings/base.py"
    - "backend/config/settings/dev.py"
    - "backend/config/settings/prod.py"
    - "backend/config/settings/test.py"
    - "backend/config/urls.py"
    - "backend/config/wsgi.py"
    - "backend/manage.py"
    - "backend/pytest.ini"
    - "backend/conftest.py"
    - "backend/requirements.txt"
    - "backend/requirements-dev.txt"
    - "backend/.env.example"
    - "frontend/package.json"
    - "frontend/vite.config.ts"
    - "frontend/index.html"
    - "frontend/src/main.tsx"
    - "frontend/src/index.css"
    - "frontend/src/router.tsx"
    - "frontend/src/api/client.ts"
    - "frontend/src/api/auth.ts"
    - "frontend/src/hooks/useAuth.ts"
    - "frontend/src/pages/auth/LoginPage.tsx"
    - "frontend/src/test/setup.ts"
  modified: []

key-decisions:
  - "AbstractBaseUser over AbstractUser — prevents username/first_name/last_name conflicts with NIM/NIDN; USERNAME_FIELD=email"
  - "Django server-side sessions (D-21) — no JWT; sessionid HttpOnly, csrftoken readable by JS"
  - "AUTH_USER_MODEL defined in base.py before any migration is generated (D-23/Pitfall 1)"
  - "Tailwind v4 CSS @theme in index.css — no tailwind.config.js (v4 ignores JS config)"
  - "Vite proxy /api → localhost:8000 — SPA requests are same-origin in dev, eliminating CORS/credentials issues"
  - "CSRF: GET /api/csrf/ with AllowAny + empty authentication_classes forces csrftoken cookie before first POST"
  - "google_oauth_token as JSONField(null=True) on CustomUser — Phase-4 forward-compat stub, no implementation yet"

patterns-established:
  - "Pattern: DRF permission classes in accounts/permissions.py — IsApprovedUser/IsStudent/IsLecturer/IsAdmin; import from here in all feature views"
  - "Pattern: apiRequest(url, options) wrapper in api/client.ts — all API calls go through this; never use raw fetch"
  - "Pattern: requireAuth/requireRole(role) React Router loaders — protect every authenticated route at the router level, not in components"
  - "Pattern: pytest fixtures in conftest.py (api_client, student_user, lecturer_user, admin_user) — use in all backend tests"
  - "Pattern: settings module selected via DJANGO_SETTINGS_MODULE env var; pytest.ini points to test settings"

requirements-completed: [TRIAGE-01]

# Metrics
duration: "~4h (multi-session)"
completed: "2026-06-25"
---

# Phase 01 Plan 01: Walking Skeleton Summary

**Django 5.2 backend with AbstractBaseUser session/CSRF auth + React 18/Vite/Tailwind-v4 frontend wired end-to-end: seeded admin logs in, role-routes, sessionid+csrftoken cookies confirmed in human checkpoint**

## Performance

- **Duration:** ~4h (multi-session, Tasks 1-3 automated + Task 4 human-verify)
- **Started:** 2026-06-25T00:00:00Z
- **Completed:** 2026-06-25T10:00:00Z
- **Tasks:** 4 (3 auto + 1 checkpoint:human-verify)
- **Files modified:** 46 (all created new — first scaffold)

## Accomplishments

- Django 5.2 backend scaffolded with CustomUser (AbstractBaseUser), AUTH_USER_MODEL set before the first migration — zero CircularDependencyError on fresh migrate
- Full session + CSRF auth handshake: GET /api/csrf/, POST /api/auth/login/, POST /api/auth/logout/, GET /api/auth/me/ with correct 403 for anonymous
- seed_admin management command creates admin@temudosen.ac.id and kaprodi account idempotently (get_or_create)
- Permission classes IsApprovedUser / IsStudent / IsLecturer / IsAdmin defined, imported by all feature views going forward
- React 18 + Vite frontend with Tailwind v4 @theme tokens (no tailwind.config.js), createBrowserRouter with all Phase-1 routes, requireAuth/requireRole loaders, CSRF fetched on mount before render
- LoginPage (S-04) renders email + password + "Masuk ke Akun" CTA using design tokens; Vitest smoke test green
- Human checkpoint APPROVED: admin@temudosen.ac.id logged in through UI, sessionid + csrftoken cookies confirmed in DevTools, /api/auth/me/ returns 403 for anonymous requests, role routing correct

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold backend, CustomUser, AUTH_USER_MODEL, seed_admin** — see git log (feat/test — TDD RED + GREEN)
2. **Task 2: Session + CSRF auth endpoints and React API client** — see git log (feat/test — TDD RED + GREEN)
3. **Task 3: Frontend shell — Tailwind v4 @theme, router scaffold, login page** — see git log (feat)
4. **Task 4: Checkpoint human-verify** — APPROVED (no commit needed)

_Note: TDD tasks (1 and 2) each have a test commit (RED) followed by a feat commit (GREEN)._

## Files Created/Modified

**Backend — core scaffold:**
- `backend/manage.py` — Django management entry point
- `backend/requirements.txt` / `requirements-dev.txt` — pinned dependencies
- `backend/.env.example` — environment variable template
- `backend/config/settings/base.py` — AUTH_USER_MODEL, DRF session auth, CORS, CSRF, MEDIA config
- `backend/config/settings/dev.py` — DEBUG=True, SQLite, CORS for localhost:5173
- `backend/config/settings/test.py` — in-memory SQLite, fast password hasher
- `backend/config/settings/prod.py` — production overrides
- `backend/config/urls.py` — root URL config with scaffolded placeholders for submissions/symptoms/users
- `backend/pytest.ini` / `backend/conftest.py` — test config + api_client/student_user/lecturer_user/admin_user fixtures

**Backend — accounts app:**
- `backend/apps/accounts/models.py` — CustomUser (AbstractBaseUser + PermissionsMixin), UserRole TextChoices
- `backend/apps/accounts/managers.py` — CustomUserManager with create_user / create_superuser
- `backend/apps/accounts/serializers.py` — UserSerializer (read-only: email, full_name, role, is_approved, nim, nidn)
- `backend/apps/accounts/views.py` — LoginView, LogoutView, MeView
- `backend/apps/accounts/permissions.py` — IsApprovedUser, IsStudent, IsLecturer, IsAdmin
- `backend/apps/accounts/urls.py` — /api/auth/login|logout|me/
- `backend/apps/accounts/admin.py` — CustomUser registered in Django admin
- `backend/apps/accounts/management/commands/seed_admin.py` — seed_admin command (D-25)
- `backend/apps/accounts/migrations/0001_initial.py` — initial migration committed before any data
- `backend/apps/accounts/tests/test_models.py` — CustomUser model unit tests
- `backend/apps/accounts/tests/test_auth.py` — login/logout/me/403 integration tests

**Backend — core app:**
- `backend/core/views.py` — csrf_cookie GET endpoint (AllowAny, calls get_token)
- `backend/core/urls.py` — /api/csrf/
- `backend/core/tests/test_csrf.py` — CSRF cookie smoke test

**Frontend:**
- `frontend/package.json` — react 18, react-router v7, @tailwindcss/vite, @tailwindcss/forms, vitest
- `frontend/vite.config.ts` — Tailwind plugin, /api proxy to :8000, vitest config
- `frontend/index.html` — Plus Jakarta Sans + Inter + Public Sans Google Fonts
- `frontend/src/main.tsx` — awaits getCSRFToken() before RouterProvider renders
- `frontend/src/index.css` — Tailwind v4 @import + @theme with all UI-SPEC color/radius/font tokens
- `frontend/src/router.tsx` — createBrowserRouter with all Phase-1 routes, requireAuth, requireRole(role)
- `frontend/src/api/client.ts` — apiRequest wrapper (credentials:include, X-CSRFToken injection)
- `frontend/src/api/auth.ts` — getCSRFToken, login, logout, getCurrentUser
- `frontend/src/hooks/useAuth.ts` — auth state from /api/auth/me/
- `frontend/src/pages/auth/LoginPage.tsx` — S-04 login page with design tokens
- `frontend/src/test/setup.ts` — Vitest DOM + MSW setup

## Decisions Made

- **AbstractBaseUser over AbstractUser**: Prevents username/first_name/last_name conflicts with NIM/NIDN fields. USERNAME_FIELD=email. Required full_name in REQUIRED_FIELDS.
- **Django server-side sessions (D-21)**: No JWT. sessionid cookie is HttpOnly; csrftoken is readable by JS (CSRF_COOKIE_HTTPONLY=False) so the client can inject X-CSRFToken.
- **AUTH_USER_MODEL ordering (D-23/Pitfall 1)**: CustomUser model and AUTH_USER_MODEL=accounts.CustomUser defined in base.py BEFORE running makemigrations. 0001_initial committed immediately.
- **Tailwind v4 @theme**: All design tokens declared as CSS custom properties in @theme block inside index.css. No tailwind.config.js created (Pitfall 4 — v4 ignores it).
- **Vite proxy**: /api → http://localhost:8000 with changeOrigin=true, no URL rewrite. Makes browser requests same-origin in dev, solving credentials+CORS entirely.
- **google_oauth_token as JSONField(null=True)**: Forward-compat stub for Phase 4 Google OAuth. No implementation; field accepts null.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. All pitfalls documented in RESEARCH.md were avoided as specified:
- Pitfall 1 (AUTH_USER_MODEL ordering): prevented by correct sequencing
- Pitfall 2/3 (CORS + credentials): eliminated by Vite proxy
- Pitfall 4 (Tailwind config): no tailwind.config.js created
- Pitfall 5 (Windows libmagic): python-magic-bin in requirements-dev.txt
- Pitfall 6 (upload size): DATA_UPLOAD_MAX_MEMORY_SIZE = FILE_UPLOAD_MAX_MEMORY_SIZE = 6MB in base.py
- Pitfall 8 (unapproved users): requireRole checks is_approved, redirects to /pending-approval

## User Setup Required

None — development environment uses SQLite and seed_admin. No external service configuration required for Phase 1.

## Threat Surface Scan

No new threat surface beyond what the plan's threat model covers. All T-1-01 through T-1-SC mitigations implemented as specified.

## Known Stubs

- `google_oauth_token` (JSONField, null=True) on CustomUser — intentional Phase-4 stub, no implementation. Future plan: Phase 4 Google Calendar Sync.
- Placeholder route components in router.tsx (`<div data-route="...">`) — intentional; each feature plan fills in its own route component. Not a rendering gap for current plan goal.

## Next Phase Readiness

Ready for 01-02 (self-registration, pending-approval gate, admin user-approval queue):
- CustomUser model with role + is_approved fields in place
- Auth endpoints tested and verified
- requireRole(role) loader already guards /pending-approval
- Permission classes (IsApprovedUser) ready for the approval gate
- conftest.py fixtures (student_user, lecturer_user) available for 01-02 tests
- Approved-lecturer dropdown backed by CustomUser.role=lecturer + is_approved=True — queryable with existing model

No blockers.

---
*Phase: 01-submission-triage-foundation*
*Completed: 2026-06-25*
