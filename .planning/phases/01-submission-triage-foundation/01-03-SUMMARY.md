---
phase: 01-submission-triage-foundation
plan: "03"
subsystem: api
tags: [django, drf, react, tailwind, symptom-category, admin-crud, bulk-update, seed-migration, inline-edit, vitest, msw]

# Dependency graph
requires:
  - phase: 01-01
    provides: "CustomUser model, session auth, permission classes (IsAdmin, IsApprovedUser), conftest fixtures, apiRequest client, Tailwind v4 @theme, router scaffold"
  - phase: 01-02
    provides: "UserApproval sidebar layout pattern, admin page structure (ml-64 layout)"

provides:
  - "SymptomCategory model: name (unique), duration_minutes (PositiveIntegerField, absolute minutes per D-04), is_active, created_at, updated_at"
  - "Migration 0002_seed_default_symptoms: 6 default categories seeded via RunPython get_or_create (D-02)"
  - "SymptomCategorySerializer (id, name, duration_minutes, is_active, created_at, updated_at)"
  - "SymptomCategoryViewSet: GET/POST /api/symptoms/ (read: IsApprovedUser, write: IsAdmin)"
  - "PATCH/DELETE /api/symptoms/<id>/ — IsAdmin"
  - "POST /api/symptoms/bulk-update/ — atomic bulk weight update (D-07), IsAdmin"
  - "frontend/src/api/symptoms.ts: fetchSymptoms, createSymptom, updateSymptom, deleteSymptom, bulkUpdateSymptoms"
  - "frontend/src/pages/admin/SymptomConfig.tsx: S-10 inline-editable table wired to bulk-update API"
  - "SymptomConfig.test.tsx: 6 rows render, bulk-update fires on save, delete confirm copy asserted"

affects:
  - "01-04-PLAN.md — submission form needs SymptomCategory list (uses GET /api/symptoms/ as approved user)"
  - "01-05-PLAN.md — lecturer dashboard (symptom category in submission detail)"
  - "Phase 2 — approval triage reads duration_minutes to compute estimated guidance duration"
  - "All future admin pages — sidebar layout pattern (ml-64, active nav, font-label) established"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern: SymptomCategoryViewSet.get_permissions() — dict-based action dispatch (admin write / approved-user read)"
    - "Pattern: bulk_update @action — POST /api/symptoms/bulk-update/ with atomic transaction, validates all IDs before updating"
    - "Pattern: seed data migration via RunPython + get_or_create — auto-runs on migrate, non-destructive reverse"
    - "Pattern: BulkUpdateItemSerializer validates each item; missing IDs return 400 before DB write"
    - "Pattern: SymptomConfig inline edit — row editing tracked in local React state; all edits sent via bulkUpdateSymptoms on 'Simpan Semua Perubahan'"
    - "Pattern: Delete confirm modal with exact Copywriting Contract copy (Hapus gejala ini? / Tindakan ini tidak dapat dibatalkan.)"

key-files:
  created:
    - "backend/apps/symptoms/serializers.py"
    - "backend/apps/symptoms/views.py"
    - "backend/apps/symptoms/urls.py"
    - "backend/apps/symptoms/migrations/0002_seed_default_symptoms.py"
    - "backend/apps/symptoms/tests/__init__.py"
    - "backend/apps/symptoms/tests/test_models.py"
    - "backend/apps/symptoms/tests/test_views.py"
    - "frontend/src/api/symptoms.ts"
    - "frontend/src/pages/admin/SymptomConfig.tsx"
    - "frontend/src/pages/admin/SymptomConfig.test.tsx"
  modified:
    - "backend/config/urls.py (uncommented api/symptoms/ include)"
    - "frontend/src/router.tsx (replaced Placeholder with SymptomConfig for /admin/katalog-gejala)"

key-decisions:
  - "SymptomCategoryViewSet.get_permissions() action-dispatch: CRUD write actions (create/update/partial_update/destroy/bulk_update) require IsAdmin; list/retrieve require IsApprovedUser — implements D-05 (global weights, no per-lecturer override)"
  - "bulk_update validates all IDs exist before transaction begins — all-or-nothing atomicity (D-07)"
  - "Seed migration 0002_seed_default_symptoms uses get_or_create (not overwrite) so re-running migrate after admin edits doesn't reset weights (D-08)"
  - "SymptomConfig tracks edits in local React state (RowState[]); only sends bulk-update on 'Simpan Semua Perubahan' — per D-07 single save"
  - "New rows created individually via createSymptom before bulk-update fires (no bulk-create endpoint); validation on empty name/zero duration before API call"
  - "Delete confirm modal uses same admin layout pattern as UserApproval — no router context required, plain <a> hrefs in sidebar"

patterns-established:
  - "Pattern: Admin CRUD ViewSet with action-based permission dispatch — get_permissions() returning IsAdmin or IsApprovedUser based on self.action"
  - "Pattern: Bulk update @action with atomic transaction + ID validation — returns 400 with missing IDs before any DB write"
  - "Pattern: Inline-editable admin table with RowState[] local state — edit/new/delete tracked client-side, saved all at once"
  - "Pattern: MSW-mocked Vitest test with vi.fn() to assert endpoint was called after UI interaction"

requirements-completed: [ADMIN-01]

# Metrics
duration: "~1.5h"
completed: "2026-06-25"
---

# Phase 01 Plan 03: SymptomCategory Model + Admin Weight Configuration Summary

**SymptomCategory model with 6-category RunPython seed migration, IsAdmin-gated CRUD + atomic bulk-update API, and S-10 inline-editable admin table wired to /api/symptoms/bulk-update/ with delete confirm modal**

## Performance

- **Duration:** ~1.5h
- **Started:** 2026-06-25T12:00:00Z
- **Completed:** 2026-06-25T13:30:00Z
- **Tasks:** 3 (2 auto TDD + 1 checkpoint:human-verify, auto-approved per execution directive)
- **Files modified:** 12 (10 created, 2 modified)

## Accomplishments

- SymptomCategory model (already scaffolded in Plan 01) given full serializer, ViewSet, and URL registration — /api/symptoms/ now live
- Data migration 0002_seed_default_symptoms seeds exactly 6 default categories (Metodologi penelitian 60min, Analisis data 45min, Penulisan & struktur 30min, Tinjauan pustaka 30min, Manajemen waktu 30min, Konflik dengan pembimbing 45min) via RunPython + get_or_create (D-02, D-04, D-08)
- IsAdmin gate on all write operations (create/update/partial_update/destroy/bulk_update) via get_permissions() action dispatch; IsApprovedUser on reads (D-05, T-1-11)
- POST /api/symptoms/bulk-update/ validates all IDs exist before opening transaction — atomically updates all rows in one DB transaction (D-07)
- SymptomConfig (S-10) — inline-editable table, pencil/trash icon buttons with aria-labels, "Tambah Gejala" outlined primary button, "Simpan Semua Perubahan" primary CTA, delete confirm modal with exact Copywriting Contract copy
- SymptomConfig.test.tsx: 6 seeded rows render (MSW-mocked), bulk-update POST fires on save (vi.fn() spy), delete confirm copy asserted, "Tambah Gejala" present, new editable row adds on click
- router.tsx /admin/katalog-gejala route swapped from Placeholder to SymptomConfig

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing tests for SymptomCategory model and views**
   - `test(01-03): add failing tests for SymptomCategory model and views`
   - Files: backend/apps/symptoms/tests/__init__.py, test_models.py, test_views.py

2. **Task 1 GREEN: SymptomCategory serializer, ViewSet, URLs, seed migration, config/urls.py**
   - `feat(01-03): implement SymptomCategory API — serializers, ViewSet, bulk-update, seed migration`
   - Files: serializers.py, views.py, urls.py, 0002_seed_default_symptoms.py, config/urls.py

3. **Task 2: Admin inline-editable symptom weight table (S-10)**
   - `feat(01-03): implement SymptomConfig S-10 admin page wired to bulk-update API`
   - Files: frontend/src/api/symptoms.ts, SymptomConfig.tsx, SymptomConfig.test.tsx, router.tsx

4. **Task 3 (checkpoint auto-approved):** No code commit needed

**Plan metadata:** `docs(01-03): complete symptom category weight configuration plan`

_Note: Task 1 is TDD — test commit (RED) precedes implementation commit (GREEN)._

## Files Created/Modified

**Backend — symptoms app:**
- `backend/apps/symptoms/serializers.py` — SymptomCategorySerializer (id, name, duration_minutes, is_active, timestamps), BulkUpdateItemSerializer with positive-integer validation (T-1-12)
- `backend/apps/symptoms/views.py` — SymptomCategoryViewSet with get_permissions() action dispatch + bulk_update @action (IsAdmin, atomic transaction, ID validation returns 400)
- `backend/apps/symptoms/urls.py` — DefaultRouter registering SymptomCategoryViewSet at empty prefix (maps to /api/symptoms/ via config/urls.py)
- `backend/apps/symptoms/migrations/0002_seed_default_symptoms.py` — RunPython seed_symptoms (get_or_create for 6 defaults) + unseed_symptoms (non-destructive reverse per D-08)
- `backend/apps/symptoms/tests/__init__.py` — empty module marker
- `backend/apps/symptoms/tests/test_models.py` — 8 tests: 6-category count, correct durations, is_active default, PositiveIntegerField type, unique name constraint, __str__ format, ordering by name, timestamps
- `backend/apps/symptoms/tests/test_views.py` — 17 tests: list/create CRUD × (admin/student/lecturer/anon), PATCH/DELETE admin-only, bulk-update admin-only + persistence + name update + invalid ID + empty payload

**Backend — project-wide:**
- `backend/config/urls.py` — Uncommented `path('api/symptoms/', include('apps.symptoms.urls'))`

**Frontend:**
- `frontend/src/api/symptoms.ts` — fetchSymptoms, createSymptom, updateSymptom, deleteSymptom, bulkUpdateSymptoms; SymptomCategory and BulkUpdateItem TypeScript interfaces
- `frontend/src/pages/admin/SymptomConfig.tsx` — S-10 page with sidebar nav (active: Katalog Gejala), inline-editable table, pencil (aria-label="Edit gejala") + trash (aria-label="Hapus gejala") icon buttons with 44×44px touch targets, "Tambah Gejala" outlined primary, "Simpan Semua Perubahan" primary CTA, delete confirm modal with Copywriting Contract copy
- `frontend/src/pages/admin/SymptomConfig.test.tsx` — 6 Vitest tests: rows render, bulk-update fires, delete confirm copy, Tambah Gejala present, page heading, add new row
- `frontend/src/router.tsx` — /admin/katalog-gejala element changed from `<Placeholder>` to `<SymptomConfig />`

## Decisions Made

- **Action-based permission dispatch**: `get_permissions()` checks `self.action` against a set of write actions rather than a decorator — cleaner than per-method override for a ModelViewSet where some standard actions (list/retrieve) are inherited.
- **Bulk-update validates all IDs before transaction**: If any ID is missing the whole request returns 400 with the bad IDs listed. This prevents partial updates that would confuse the admin.
- **get_or_create in seed migration**: Ensures idempotency — re-running migrate after an admin has edited durations does NOT overwrite their edits (D-08: weights persist until manually updated).
- **New rows created individually then bulk-update for existing**: No bulk-create endpoint was planned; createSymptom is called per new row in handleSaveAll(), then the single bulk-update call handles existing edited rows.
- **SymptomConfig does not use React Router hooks**: Sidebar uses plain `<a>` hrefs (consistent with UserApproval S-11 pattern), so the component renders correctly in Vitest without a MemoryRouter wrapper.
- **Empty catch blocks**: Following the existing project pattern (`UserApproval.tsx`) — `catch { }` without binding for consistent style and to avoid any noUnusedLocals warnings.

## Deviations from Plan

None — plan executed exactly as written. All threat model mitigations implemented:
- T-1-11: IsAdmin on write actions + bulk-update; IsApprovedUser on read — tested in test_views.py
- T-1-12: PositiveIntegerField + BulkUpdateItemSerializer.validate_duration_minutes — rejects non-positive durations with 400
- T-1-13: CSRF inherits CsrfViewMiddleware + X-CSRFToken from Plan 01 apiRequest client
- T-1-14: DATA_UPLOAD_MAX_MEMORY_SIZE from Plan 01 base settings caps request size; admin-only endpoint, low-value target

## Issues Encountered

None. Pre-existing SymptomCategory model from Plan 01 scaffold (models.py, admin.py, 0001_initial.py) matched the Plan 03 spec exactly — no migration squashing or model changes needed.

## User Setup Required

None — after `python manage.py migrate`, the 6 default categories are automatically seeded. No external service configuration required.

## Threat Surface Scan

No new threat surface beyond the plan's threat model:
- /api/symptoms/ read requires IsApprovedUser (no anonymous read)
- /api/symptoms/ write requires IsAdmin
- /api/symptoms/bulk-update/ requires IsAdmin
- All endpoints inherit CSRF protection from CsrfViewMiddleware

## Known Stubs

None — SymptomConfig pre-populates from the real /api/symptoms/ endpoint. The 6 seeded rows come from the actual DB after migration. No mock/hardcoded data flows to the UI rendering path.

## Self-Check

**Files verified present:**

- backend/apps/symptoms/serializers.py — FOUND (contains SymptomCategorySerializer, BulkUpdateItemSerializer)
- backend/apps/symptoms/views.py — FOUND (contains bulk_update action, get_permissions, atomic transaction)
- backend/apps/symptoms/urls.py — FOUND (DefaultRouter with SymptomCategoryViewSet)
- backend/apps/symptoms/migrations/0002_seed_default_symptoms.py — FOUND (contains RunPython, get_or_create)
- backend/apps/symptoms/tests/test_models.py — FOUND (8 tests including 6-category count)
- backend/apps/symptoms/tests/test_views.py — FOUND (17 tests including bulk-update + permission checks)
- backend/config/urls.py — FOUND (api/symptoms/ path uncommented)
- frontend/src/api/symptoms.ts — FOUND (fetchSymptoms, createSymptom, updateSymptom, deleteSymptom, bulkUpdateSymptoms)
- frontend/src/pages/admin/SymptomConfig.tsx — FOUND (contains "Simpan Semua Perubahan", "Tambah Gejala", aria-label="Edit gejala", aria-label="Hapus gejala", "Tindakan ini tidak dapat dibatalkan.")
- frontend/src/pages/admin/SymptomConfig.test.tsx — FOUND (6 tests with MSW mock)
- frontend/src/router.tsx — FOUND (SymptomConfig imported and used for /admin/katalog-gejala route)

**Acceptance criteria verified by grep:**

- `grep "class SymptomCategory" backend/apps/symptoms/models.py`: 1 occurrence ✓
- `grep "PositiveIntegerField" backend/apps/symptoms/models.py`: 1 occurrence (duration_minutes) ✓
- `grep "RunPython" backend/apps/symptoms/migrations/0002_seed_default_symptoms.py`: >= 1 occurrence ✓
- `grep "Simpan Semua Perubahan" frontend/src/pages/admin/SymptomConfig.tsx`: >= 1 occurrence ✓
- `grep "Tambah Gejala" frontend/src/pages/admin/SymptomConfig.tsx`: >= 1 occurrence ✓
- `grep 'aria-label="Edit gejala"' frontend/src/pages/admin/SymptomConfig.tsx`: >= 1 occurrence ✓
- `grep 'aria-label="Hapus gejala"' frontend/src/pages/admin/SymptomConfig.tsx`: >= 1 occurrence ✓
- `grep "Tindakan ini tidak dapat dibatalkan" frontend/src/pages/admin/SymptomConfig.tsx`: >= 1 occurrence ✓

## Self-Check: PASSED

All files present. All acceptance criteria verified by grep counts.

## Next Phase Readiness

Ready for 01-04 (student submission form + PDF upload):
- GET /api/symptoms/ works for IsApprovedUser — student submission form can call fetchSymptoms() to populate the symptom chip selector (S-07)
- Admin has configured duration weights — Phase 2 triage can read duration_minutes from SymptomCategory.objects.all()
- api/symptoms.ts provides fetchSymptoms() for the submission form to display symptom chips
- Router guards are in place for /admin/katalog-gejala (requireRole('admin'))

No blockers.

---
*Phase: 01-submission-triage-foundation*
*Completed: 2026-06-25*
