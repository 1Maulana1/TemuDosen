---
phase: 01-submission-triage-foundation
type: skeleton
created: 2026-06-23
stack: Django 5.2 + DRF 3.17 + React 18 (Vite) + Tailwind CSS v4
---

# Walking Skeleton — TemuDosen

> The thinnest possible end-to-end stack for Phase 1. Records architectural decisions that
> subsequent phases (2–8) build on without renegotiating. Authored alongside `01-01-PLAN.md`.

## What the Skeleton Proves

The thinnest end-to-end slice for this stack is: **app mount → `GET /api/csrf/` → `POST /api/auth/login/` → authenticated `GET /api/auth/me/` → role-gated React route renders**.

Building this first de-risks the CORS + session-cookie + CSRF handshake (the single most failure-prone integration in a DRF + React SPA) before any business logic is written. After Wave 0, a real admin user (seeded) can log in through the React UI and land on a role-appropriate page.

## Architectural Decisions (locked for all phases)

| Decision | Choice | Rationale / Source |
|----------|--------|--------------------|
| Backend framework | Django 5.2 LTS + DRF 3.17 | RESEARCH Standard Stack; LTS until Apr 2028 |
| Frontend framework | React 18 + Vite (react-ts template) | Confirmed stack decision; UI-SPEC targets React |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` plugin + CSS `@theme` directive | RESEARCH Pattern 8 — v4 does NOT auto-detect `tailwind.config.js` |
| Routing | React Router 7 (`react-router` pkg), `createBrowserRouter` + loader guards | RESEARCH Pattern 9 |
| Auth | Server-side Django sessions + cookie (NOT JWT) | D-21 |
| CSRF | `GET /api/csrf/` called on app mount; `X-CSRFToken` header on all unsafe requests | RESEARCH Pattern 2, Pitfall 3 |
| User model | `AbstractBaseUser` + `PermissionsMixin`, `USERNAME_FIELD='email'` | RESEARCH Pattern 1 — multi-role with NIM/NIDN |
| AUTH_USER_MODEL | `accounts.CustomUser`, set BEFORE first `makemigrations`/`migrate` | RESEARCH Pitfall 1 — NON-NEGOTIABLE order |
| Database | SQLite (dev), PostgreSQL-ready via `django-environ` DATABASE_URL | RESEARCH Open Q4 |
| File storage | Local filesystem, UUID filenames, served ONLY via auth-gated view | D-26, D-27, D-29 |
| Config | `django-environ`, split settings (base/dev/prod/test) | RESEARCH Pattern 10 |
| Dev deployment | Vite dev server (5173) proxies `/api` → Django (8000) — same-origin | RESEARCH Pattern 7 |
| Test framework | pytest + pytest-django (backend), Vitest (frontend) | VALIDATION.md |

## Directory Layout (established in Wave 0)

```
TemuDosen/                       # git root
├── backend/
│   ├── manage.py
│   ├── pytest.ini               # DJANGO_SETTINGS_MODULE = config.settings.test
│   ├── conftest.py              # api_client, student_user, lecturer_user, admin_user fixtures
│   ├── requirements.txt
│   ├── requirements-dev.txt     # adds python-magic-bin (Windows libmagic)
│   ├── .env.example             # SECRET_KEY, DATABASE_URL, MEDIA_ROOT
│   ├── config/
│   │   ├── settings/{base,dev,prod,test}.py
│   │   ├── urls.py              # routes /api/* to app urlconfs (scaffolded complete in W0)
│   │   └── wsgi.py
│   ├── apps/
│   │   ├── accounts/            # CustomUser, auth, registration, approval, permissions
│   │   ├── submissions/         # Submission, SubmissionFile, protected file serving
│   │   └── symptoms/            # SymptomCategory + seed migration
│   ├── core/                    # cross-cutting: csrf endpoint, health check
│   │   └── tests/test_csrf.py
│   └── storage/                 # MEDIA_ROOT, gitignored, NOT under MEDIA_URL
└── frontend/
    ├── vite.config.ts           # proxy /api → :8000; vitest test block
    ├── src/
    │   ├── main.tsx             # calls getCSRFToken() on mount before render
    │   ├── index.css            # @import "tailwindcss"; @theme { UI-SPEC tokens }
    │   ├── router.tsx           # createBrowserRouter, ALL Phase-1 routes scaffolded W0
    │   ├── api/{client.ts,auth.ts}
    │   ├── hooks/useAuth.ts
    │   ├── components/          # StatusBadge, UploadZone, PDFPreview (added by feature plans)
    │   └── pages/{auth,student,lecturer,admin}/
    └── src/test/setup.ts        # Vitest DOM + MSW
```

## Endpoint Map (scaffolded in Wave 0, filled by feature plans)

| Endpoint | Method | Plan that implements | Auth |
|----------|--------|----------------------|------|
| `/api/csrf/` | GET | 01 (skeleton) | AllowAny |
| `/api/auth/login/` | POST | 01 (skeleton) | AllowAny |
| `/api/auth/logout/` | POST | 01 (skeleton) | IsAuthenticated |
| `/api/auth/me/` | GET | 01 (skeleton) | IsAuthenticated |
| `/api/auth/register/` | POST | 02 | AllowAny |
| `/api/users/lecturers/` | GET | 02 | AllowAny (approved filter) |
| `/api/users/pending/` | GET | 02 | IsAdmin |
| `/api/users/<id>/approve/` | POST | 02 | IsAdmin |
| `/api/users/<id>/reject/` | POST | 02 | IsAdmin |
| `/api/symptoms/` | GET/POST | 03 | read: approved; write: IsAdmin |
| `/api/symptoms/<id>/` | PATCH/DELETE | 03 | IsAdmin |
| `/api/symptoms/bulk-update/` | POST | 03 | IsAdmin |
| `/api/submissions/` | GET/POST | 04 (POST), 05 (lecturer GET) | IsApproved + role |
| `/api/files/<uuid>/` | GET | 04 | IsAuthenticated + ownership |

## Frontend Route Map (scaffolded in Wave 0)

| Route | Component | Plan | Guard |
|-------|-----------|------|-------|
| `/login` | LoginPage | 01 | public |
| `/register` | RegisterRolePage | 02 | public |
| `/register/mahasiswa` | RegisterStudentPage | 02 | public |
| `/register/dosen` | RegisterLecturerPage | 02 | public |
| `/pending-approval` | PendingApprovalPage | 02 | authed + !approved |
| `/mahasiswa/` | StudentDashboard | 04 | role=student |
| `/mahasiswa/ajukan` | SubmissionForm | 04 | role=student |
| `/dosen/` | LecturerDashboard | 05 | role=lecturer |
| `/admin/katalog-gejala` | SymptomConfig | 03 | role=admin |
| `/admin/pengguna` | UserApproval | 02 | role=admin |

Wave 0 creates `router.tsx` with every route above pointing at a minimal placeholder component (`<div>{routeName}</div>`). Feature plans replace placeholders with real pages by editing only their own page files — `router.tsx` is not re-edited after Wave 0 except to swap a lazy import target, which feature plans own per-route.

## Seeded Data (Wave 0)

- Admin account via `python manage.py seed_admin` (D-25): `admin@temudosen.ac.id` / `ChangeMe123!`, `is_approved=True`, `is_staff=True`, `is_superuser=True`, `role=admin`.
- Kaprodi account: same command, `role=kaprodi`, `is_approved=True`.
- 6 default symptom categories seeded via data migration in Plan 03 (D-02).

## Build / Run Commands

```bash
# Backend (from backend/)
python -m venv .venv && .venv\Scripts\activate   # Windows
pip install -r requirements.txt -r requirements-dev.txt
python manage.py migrate
python manage.py seed_admin
python manage.py runserver            # :8000

# Frontend (from frontend/)
npm install
npm run dev                            # :5173, proxies /api → :8000

# Tests
pytest -x -q                           # backend (from backend/)
npx vitest run                         # frontend (from frontend/)
```

## Skeleton Acceptance (Wave 0 done)

1. `pytest -x -q` green (CSRF endpoint test, CustomUser model test pass).
2. `python manage.py seed_admin` creates the admin; `python manage.py migrate` runs cleanly on a fresh DB with zero `CircularDependencyError`.
3. From the browser at `http://localhost:5173/login`, the seeded admin logs in and is redirected to an authenticated placeholder route; `GET /api/auth/me/` returns the user with `role=admin`.
4. A logged-out request to `/api/auth/me/` returns 403.
