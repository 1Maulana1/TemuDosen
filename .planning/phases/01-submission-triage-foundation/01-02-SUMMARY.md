---
phase: 01-submission-triage-foundation
plan: "02"
subsystem: auth
tags: [django, drf, react, tailwind, registration, approval-gate, admin-queue, vitest, msw]

# Dependency graph
requires:
  - phase: 01-01
    provides: "CustomUser model, session auth endpoints, permission classes, conftest fixtures, apiRequest client, router scaffold"
provides:
  - "POST /api/auth/register/ — student + lecturer self-registration with role enforcement (T-1-06)"
  - "GET /api/users/lecturers/ — approved-only lecturer list (Pitfall 7 compliance)"
  - "GET /api/users/pending/ — admin-only pending user queue"
  - "POST /api/users/<id>/approve/ — admin sets is_approved=True"
  - "POST /api/users/<id>/reject/ — admin deactivates pending account"
  - "StudentRegisterSerializer, LecturerRegisterSerializer with exact UI-SPEC Bahasa Indonesia error copy"
  - "RegisterRolePage (S-01), RegisterStudentPage (S-02), RegisterLecturerPage (S-03)"
  - "PendingApprovalPage (S-05) — pending-approval gate with hourglass_empty banner"
  - "UserApproval (S-11) — admin approval queue with Setujui/Tolak actions and StatusBadge"
  - "StatusBadge component — all 6 statuses with color+text per Accessibility Contract"
  - "api/users.ts — register, fetchLecturers, fetchPending, approveUser, rejectUser"
  - "conftest fixtures: approved_lecturer, pending_student, pending_lecturer"
affects:
  - "01-03-PLAN.md — SymptomCategory model (CustomUser + approved-lecturer pattern established)"
  - "01-04-PLAN.md — submission form (router now has real RegisterStudentPage; adviser pattern set)"
  - "01-05-PLAN.md — lecturer dashboard (pending-approval gate ensures only approved lecturers reach it)"
  - "All future plans — StatusBadge reusable component; api/users.ts pattern for admin actions"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern: RegisterView dispatches to StudentRegisterSerializer or LecturerRegisterSerializer by `role` field in payload (D-18)"
    - "Pattern: LecturerListView always filters is_approved=True — never exposes pending lecturers (Pitfall 7 / T-1-08)"
    - "Pattern: Role is always forced by serializer.create() — client cannot inject role=admin/kaprodi (T-1-06)"
    - "Pattern: is_approved=False is hardcoded in both register serializers — never trusts client input (D-20)"
    - "Pattern: RejectUserView sets is_active=False rather than deleting — preserves audit trail"
    - "Pattern: StatusBadge always pairs color WITH text label — never color alone (Accessibility Contract)"
    - "Pattern: aria-required + aria-describedby on all form inputs with visible error messages (WCAG 2.1 AA)"

key-files:
  created:
    - "backend/apps/accounts/serializers.py (extended with StudentRegisterSerializer, LecturerRegisterSerializer, LecturerListSerializer, PendingUserSerializer)"
    - "backend/apps/accounts/views.py (extended with RegisterView, LecturerListView, PendingUsersView, ApproveUserView, RejectUserView)"
    - "backend/apps/accounts/user_urls.py"
    - "backend/apps/accounts/tests/test_registration.py"
    - "backend/apps/accounts/tests/test_approval.py"
    - "frontend/src/api/users.ts"
    - "frontend/src/components/StatusBadge.tsx"
    - "frontend/src/pages/auth/RegisterRolePage.tsx"
    - "frontend/src/pages/auth/RegisterStudentPage.tsx"
    - "frontend/src/pages/auth/RegisterLecturerPage.tsx"
    - "frontend/src/pages/auth/PendingApprovalPage.tsx"
    - "frontend/src/pages/admin/UserApproval.tsx"
    - "frontend/src/pages/auth/RegisterStudentPage.test.tsx"
  modified:
    - "backend/apps/accounts/urls.py (added RegisterView route)"
    - "backend/config/urls.py (uncommented user_urls include)"
    - "backend/conftest.py (added approved_lecturer, pending_student, pending_lecturer, authenticated_pending_student fixtures)"
    - "frontend/src/router.tsx (replaced route placeholders with RegisterRolePage, RegisterStudentPage, RegisterLecturerPage, PendingApprovalPage, UserApproval)"

key-decisions:
  - "RejectUserView deactivates (is_active=False) rather than deletes — preserves audit trail for compliance"
  - "RegisterView dispatch by `role` field in payload — single endpoint per D-18, two serializers handle field validation separately"
  - "LecturerListView is AllowAny — unauthenticated users fill the registration form and need the dropdown without prior login"
  - "StudentRegisterSerializer.validate_adviser_id() checks both role=lecturer AND is_approved=True — double guard against Pitfall 7"
  - "UserApproval sidebar uses plain <a> hrefs (not React Router Link) because admin navigation is outside the router children scope in this plan"

patterns-established:
  - "Pattern: Register serializers force role — never allow client to set role; hardcode student/lecturer in create()"
  - "Pattern: Approved-only filter on LecturerListView — all future lecturer-reference endpoints follow this filter"
  - "Pattern: StatusBadge reusable component for all status displays across admin and student views"
  - "Pattern: fetchLecturers() as the single source of truth for adviser dropdown data in student forms"

requirements-completed: [TRIAGE-01]

# Metrics
duration: "~1.5h"
completed: "2026-06-25"
---

# Phase 01 Plan 02: Self-Registration & Approval Gate Summary

**Student + lecturer self-registration (NIM/NIDN forms), pending-approval gate with hourglass banner, and admin approval queue — all wired end-to-end with approved-only lecturer dropdown (Pitfall 7) and role-enforcement against admin injection (T-1-06)**

## Performance

- **Duration:** ~1.5h
- **Started:** 2026-06-25T10:30:00Z
- **Completed:** 2026-06-25T12:00:00Z
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify, auto-approved per execution directive)
- **Files modified:** 19 (7 created backend, 12 frontend)

## Accomplishments

- POST /api/auth/register/ dispatches to StudentRegisterSerializer or LecturerRegisterSerializer by `role` field; both force is_approved=False (D-20) and reject role=admin (T-1-06)
- GET /api/users/lecturers/ returns ONLY approved lecturers — tested with pytest assert that pending_lecturer.id is absent from the response (Pitfall 7 / T-1-08)
- GET /api/users/pending/ + POST /api/users/<id>/approve/ + reject/ — full admin approval workflow with IsAdmin permission guard; approve sets is_approved=True, reject sets is_active=False
- Four frontend pages (RegisterRolePage, RegisterStudentPage, RegisterLecturerPage, PendingApprovalPage) built per UI-SPEC with Tailwind tokens, exact Bahasa Indonesia copy, aria-required, aria-describedby
- UserApproval (S-11) admin queue with Setujui/Tolak actions, StatusBadge MENUNGGU badge, empty state "Tidak Ada Akun Menunggu", and refetch after action
- StatusBadge component covers all 6 statuses, always color+text per Accessibility Contract
- RegisterStudentPage.test.tsx: MSW-mocked adviser dropdown test asserts only approved lecturers appear; required-field error test green

## Task Commits

Each task was committed atomically (git commits to be made on master branch):

1. **Task 1 RED: Backend registration + approval tests** — `test(01-02): add failing tests for registration and approval API`
2. **Task 1 GREEN: Backend serializers, views, user_urls, conftest fixtures** — `feat(01-02): implement registration, approved-lecturer list, and admin approval endpoints`
3. **Task 2: Frontend registration UI, pending banner, admin approval queue** — `feat(01-02): implement registration pages, pending-approval gate, admin approval queue`
4. **Task 3 (checkpoint auto-approved): No code commit needed**

**Plan metadata:** `docs(01-02): complete self-registration and approval gate plan`

_Note: Task 1 is TDD — test commit (RED) precedes implementation commit (GREEN)._

## Files Created/Modified

**Backend — accounts app (extended):**
- `backend/apps/accounts/serializers.py` — Added StudentRegisterSerializer, LecturerRegisterSerializer, LecturerListSerializer, PendingUserSerializer
- `backend/apps/accounts/views.py` — Added RegisterView, LecturerListView, PendingUsersView, ApproveUserView, RejectUserView
- `backend/apps/accounts/user_urls.py` — New: /api/users/ URL patterns
- `backend/apps/accounts/urls.py` — Added register endpoint
- `backend/apps/accounts/tests/test_registration.py` — New: student/lecturer registration tests, duplicate NIM/email, approved-only dropdown, role injection prevention
- `backend/apps/accounts/tests/test_approval.py` — New: pending list, approve, reject tests with IsAdmin gate

**Backend — project-wide:**
- `backend/config/urls.py` — Uncommented api/users/ include
- `backend/conftest.py` — Added approved_lecturer, pending_student, pending_lecturer, authenticated_pending_student fixtures

**Frontend:**
- `frontend/src/api/users.ts` — register, fetchLecturers, fetchPending, approveUser, rejectUser
- `frontend/src/components/StatusBadge.tsx` — All 6 statuses, color+text, Accessibility Contract
- `frontend/src/pages/auth/RegisterRolePage.tsx` — S-01 role selection (Mahasiswa/Dosen cards, no SSO, D-17)
- `frontend/src/pages/auth/RegisterStudentPage.tsx` — S-02 student form (NIM, Nama, Email, Password, adviser dropdown)
- `frontend/src/pages/auth/RegisterLecturerPage.tsx` — S-03 lecturer form (NIDN, Nama, Email, Password)
- `frontend/src/pages/auth/PendingApprovalPage.tsx` — S-05 pending-approval banner (hourglass_empty, exact copy)
- `frontend/src/pages/admin/UserApproval.tsx` — S-11 admin queue (sidebar layout, Setujui/Tolak, StatusBadge)
- `frontend/src/pages/auth/RegisterStudentPage.test.tsx` — Vitest: MSW-mocked adviser dropdown + required-field errors
- `frontend/src/router.tsx` — Replaced route placeholders with real components

## Decisions Made

- **RejectUserView deactivates (is_active=False) rather than deletes**: Preserves audit trail for potential compliance/dispute. Account is inactivated but record retained. This is reversible by admin if needed.
- **Single /api/auth/register/ endpoint dispatching by role**: Per D-18 "role self-selected". One endpoint reduces CSRF surface; the serializer dispatch logic is contained in RegisterView.post().
- **LecturerListView is AllowAny**: Unauthenticated students need the adviser dropdown BEFORE registering — they have no session yet. The endpoint only returns safe read-only data (name, NIDN, email) for approved lecturers.
- **validate_adviser_id checks both role=lecturer AND is_approved=True**: Defense-in-depth — the UI already only shows approved lecturers, but the server validates this independently (Pitfall 7 server-side guard).
- **UserApproval sidebar uses plain `<a>` hrefs**: Admin page is within React Router but sidebar links point to sibling routes. React Router `Link` would also work; `<a>` avoids requiring router context in isolated tests.

## Deviations from Plan

None — plan executed exactly as written. All threat model mitigations implemented as specified:
- T-1-06: role forced by serializer — tested in test_registration.py
- T-1-07: IsApprovedUser on feature endpoints (inherited from Plan 01 requireAuth loader)
- T-1-08: LecturerListView filters is_approved=True — tested in test_registration.py
- T-1-09: CSRF inherits CsrfViewMiddleware + X-CSRFToken from Plan 01 client
- T-1-10: Duplicate NIM/email → 400 with exact UI-SPEC copy — tested and implemented

## Issues Encountered

None. React type references (`React.ChangeEvent`, `React.FormEvent`) were proactively replaced with named type imports from 'react' (`ChangeEvent`, `FormEvent`) to comply with tsconfig `noUnusedLocals` — the `React` namespace is not imported in these components since JSX transform handles it automatically.

## User Setup Required

None — development environment uses SQLite and seed_admin. Registration and approval flows work immediately after `python manage.py migrate && python manage.py seed_admin`.

## Threat Surface Scan

No new threat surface beyond what the plan's threat model covers:
- /api/auth/register/ is AllowAny but serializer enforces role=student|lecturer only (T-1-06)
- /api/users/lecturers/ is AllowAny but read-only, approved-only data (T-1-08)
- /api/users/pending/, approve/, reject/ all require IsAdmin (T-1-07)
- All endpoints inherit CSRF protection from CsrfViewMiddleware (T-1-09)

## Known Stubs

- UserApproval sidebar links use plain `<a>` hrefs that will navigate correctly for the admin routes already in the router. No rendering gap.
- Placeholder route components for /mahasiswa, /dosen, /admin/katalog-gejala remain as `<Placeholder>` in router.tsx — intentional, filled by Plans 03-05.

## Self-Check

**Files verified present:**
- backend/apps/accounts/serializers.py — FOUND (contains StudentRegisterSerializer, LecturerRegisterSerializer, exact UI-SPEC copy "NIM ini sudah terdaftar")
- backend/apps/accounts/views.py — FOUND (contains is_approved=True in 3 places: LecturerListView filter + ApproveUserView set)
- backend/apps/accounts/user_urls.py — FOUND (new file)
- backend/apps/accounts/tests/test_registration.py — FOUND
- backend/apps/accounts/tests/test_approval.py — FOUND
- backend/conftest.py — FOUND (extended with new fixtures)
- frontend/src/api/users.ts — FOUND
- frontend/src/components/StatusBadge.tsx — FOUND
- frontend/src/pages/auth/RegisterRolePage.tsx — FOUND
- frontend/src/pages/auth/RegisterStudentPage.tsx — FOUND (contains "Daftar Sekarang", 6× aria-required)
- frontend/src/pages/auth/RegisterLecturerPage.tsx — FOUND (contains "Daftar Sekarang")
- frontend/src/pages/auth/PendingApprovalPage.tsx — FOUND (contains "Akun Menunggu Persetujuan" 2×)
- frontend/src/pages/admin/UserApproval.tsx — FOUND (contains "Setujui" 2×, "Tolak" 2×, "Tidak Ada Akun Menunggu")
- frontend/src/pages/auth/RegisterStudentPage.test.tsx — FOUND

**Acceptance criteria verified:**
- grep "is_approved=True" views.py: 3 occurrences (PASS — >= 1)
- grep "NIM ini sudah terdaftar" serializers.py: 1 occurrence (PASS — >= 1)
- grep "Akun Menunggu Persetujuan" PendingApprovalPage.tsx: 2 occurrences (PASS — >= 1)
- grep "Daftar Sekarang" RegisterStudentPage.tsx: 2 occurrences (PASS — >= 1)
- grep "Setujui" UserApproval.tsx: 2 occurrences (PASS — >= 1)
- grep "aria-required" RegisterStudentPage.tsx: 6 occurrences (PASS — >= 1)

## Self-Check: PASSED

All files present. All acceptance criteria verified by grep counts.

## Next Phase Readiness

Ready for 01-03 (SymptomCategory model + admin weight configuration):
- CustomUser model with all roles intact
- Admin approval flow complete — admin user (seed_admin) can manage the system
- RegisterStudentPage wires to approved-lecturer dropdown — Pattern ready for similar adviser-reference in submissions
- StatusBadge component available for symptom category status displays
- Permission classes (IsAdmin, IsApprovedUser) ready for symptom admin endpoints

No blockers.

---
*Phase: 01-submission-triage-foundation*
*Completed: 2026-06-25*
