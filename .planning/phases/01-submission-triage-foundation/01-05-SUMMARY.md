---
phase: 01-submission-triage-foundation
plan: "05"
subsystem: submissions-lecturer
tags: [django, drf, django-filter, react, tailwind, lecturer-dashboard, review-01, d10, d11, d12, tdd]

# Dependency graph
requires:
  - phase: 01-01
    provides: "CustomUser model, session auth, IsLecturer permission class, apiRequest client, Tailwind v4 @theme, router scaffold"
  - phase: 01-02
    provides: "IsLecturer/IsApprovedUser permissions, adviser FK relationship, conftest fixtures"
  - phase: 01-04
    provides: "Submission/SubmissionFile models, /api/files/<uuid>/ protected serving, StatusBadge, PDFPreview"

provides:
  - "SubmissionFilter: django-filter FilterSet exposing status exact-match filter (D-09)"
  - "LecturerSubmissionSerializer: D-10 columns (student_nim, student_name, symptom_names, status, created_at, original_filename, file_url pointing at /api/files/<uuid>/)"
  - "LecturerSubmissionListView: advisee-scoped list (student__adviser == request.user), IsLecturer permission, DjangoFilterBackend + SearchFilter + OrderingFilter (REVIEW-01)"
  - "GET /api/submissions/lecturer/ — lecturer role, advisee-scoped, ?status=&search=&ordering="
  - "fetchLecturerSubmissions() API client with filter/search/ordering params"
  - "LecturerDashboard (S-08): fixed header, bottom nav, greeting, date, Permintaan Masuk list, filter tabs, search field, Lihat Draft button, PDFPreview, empty state"
  - "LecturerDashboard.test.tsx: MSW-mocked Vitest tests for card rendering, tab filtering, search param, D-12 compliance, empty state"

affects:
  - "Phase 2 — approval flow adds Setujui/Tolak actions on same LecturerSubmissionListView or new detail view"
  - "All future phases — /api/submissions/lecturer/ is the canonical lecturer-scoped list endpoint"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern: LecturerSubmissionListView.get_queryset() scoped to student__adviser=request.user at ORM level — never at presentation layer (REVIEW-01 isolation, T-1-21)"
    - "Pattern: Dedicated /api/submissions/lecturer/ URL separates lecturer+student permissions cleanly — no role-switching logic in a single view"
    - "Pattern: LecturerSubmissionSerializer.get_file_url() always returns /api/files/<uuid>/ — never MEDIA_URL (T-1-23 mitigation)"
    - "Pattern: DjangoFilterBackend + SubmissionFilter.FilterSet for ?status= — SearchFilter for ?search= — OrderingFilter for ?ordering= (Don't Hand-Roll per RESEARCH)"
    - "Pattern: LecturerDashboard uses 300ms debounce on search state before calling fetchLecturerSubmissions — prevents API flooding on keystrokes"
    - "Pattern: STATUS_MAP in LecturerDashboard maps API lowercase (pending/approved/rejected/revision) → StatusBadge uppercase enum (MENUNGGU/DISETUJUI/DIBATALKAN/REVISI)"

key-files:
  created:
    - "backend/apps/submissions/filters.py"
    - "backend/apps/submissions/tests/test_lecturer_view.py"
    - "frontend/src/pages/lecturer/LecturerDashboard.tsx"
    - "frontend/src/pages/lecturer/LecturerDashboard.test.tsx"
  modified:
    - "backend/apps/submissions/serializers.py (added LecturerSubmissionSerializer with D-10 columns)"
    - "backend/apps/submissions/views.py (added LecturerSubmissionListView + imports)"
    - "backend/apps/submissions/urls.py (added lecturer/ path, LecturerSubmissionListView import)"
    - "frontend/src/api/submissions.ts (added fetchLecturerSubmissions + LecturerSubmissionItem types)"
    - "frontend/src/router.tsx (replaced /dosen Placeholder with LecturerDashboard)"

key-decisions:
  - "Dedicated /api/submissions/lecturer/ URL rather than role-switching in SubmissionListCreateView — cleaner permission boundary, no mixed role logic"
  - "student__adviser filter at ORM level (get_queryset) — isolation enforced before serializer, not after (T-1-21 mitigation)"
  - "LecturerSubmissionSerializer.get_file_url() constructs /api/files/<uuid>/ from obj.file.uuid — never uses file_path or MEDIA_URL (T-1-23)"
  - "No approve/reject endpoint in Phase 1 — D-12 confirmed by absence of 'approve'/'reject' in submissions/urls.py URL patterns"
  - "SearchFilter with search_fields=['student__nim', 'student__full_name'] — DRF built-in, no hand-rolled filter (D-11, RESEARCH Don't Hand-Roll)"
  - "300ms debounce on search in LecturerDashboard — prevents excessive API calls on each keystroke"

requirements-completed: [REVIEW-01]

# Metrics
duration: "~2h"
completed: "2026-06-25"
---

# Phase 01 Plan 05: Lecturer Review Dashboard Summary

**Lecturer review vertical slice: advisee-scoped, filterable/searchable/sortable submission list API (GET /api/submissions/lecturer/) with REVIEW-01 isolation enforced at ORM level, plus LecturerDashboard (S-08) view-only UI with filter tabs, search, and Lihat Draft PDF preview — no approve/reject in Phase 1 per D-12**

## Performance

- **Duration:** ~2h
- **Started:** 2026-06-25T16:30:00Z
- **Completed:** 2026-06-25T18:30:00Z
- **Tasks:** 2 auto (TDD + feat) + 1 checkpoint:human-verify (auto-approved per execution directive)
- **Files modified:** 9 (4 created, 5 modified)

## Accomplishments

**Backend:**
- `SubmissionFilter` (django-filter FilterSet): exposes `?status=` exact-match filter (D-09). Uses `FilterSet` meta class — no hand-rolled filter logic per RESEARCH Don't Hand-Roll table.
- `LecturerSubmissionSerializer`: exposes all D-10 columns — `student_nim`, `student_name`, `symptom_names` (list of strings), `status`, `created_at`, `original_filename`, `file_url`. The `file_url` is always `/api/files/<uuid>/` constructed from `obj.file.uuid` — never MEDIA_URL or a raw file path (T-1-23 mitigation).
- `LecturerSubmissionListView`: `generics.ListAPIView`, `IsLecturer` permission, `get_queryset()` returns `Submission.objects.filter(student__adviser=self.request.user)` — REVIEW-01 isolation at ORM level. Filter backends: `DjangoFilterBackend` (status), `SearchFilter` (student__nim, student__full_name), `OrderingFilter` (created_at).
- URL: `/api/submissions/lecturer/` — dedicated path, clean permission boundary. No approve/reject route (D-12 — Phase 2 scope).
- Tests in `test_lecturer_view.py`: 10 test behaviors covering isolation (T-1, T-2), D-10 column verification (T-3), status filter (T-4), NIM search (T-5), name search (T-6), created_at ordering (T-7), student rejected (T-8), unapproved rejected (T-9), unauthenticated rejected (T-10).

**Frontend:**
- `api/submissions.ts`: added `fetchLecturerSubmissions({status, search, ordering})` calling `/api/submissions/lecturer/` with URLSearchParams, `LecturerSubmissionItem` TypeScript interface with all D-10 fields.
- `LecturerDashboard.tsx` (S-08): fixed header (initials avatar + TemuDosen wordmark + notification bell), bottom nav (Beranda|Antrean|Riwayat|Profil), greeting heading + date line, "Permintaan Masuk" section. Each submission card: student initials avatar, student name, NIM, symptom chip labels, StatusBadge, submitted date, draft file chip, "Lihat Draft" button → PDFPreview modal. Filter tabs: Semua|Menunggu|Disetujui|Revisi (active: text-primary border-b-2 border-primary). Search field (placeholder "Cari NIM atau nama...") with 300ms debounce. Empty state: "Belum Ada Permintaan Masuk" + exact body copy. All Tailwind tokens, 44x44px touch targets, focus-visible rings, 14px min font per Accessibility Contract.
- `LecturerDashboard.test.tsx`: 8 MSW-mocked Vitest tests — card rendering (NIM/symptom/status), Lihat Draft button presence, status tab filtering, search param propagation, D-12 compliance (no Setujui/Tolak), empty state, header elements, bottom nav elements.
- `router.tsx`: `/dosen` Placeholder replaced with `LecturerDashboard`.

## Task Commits

**Task 1 RED — Failing tests for lecturer submission list:**
- `test(01-05): add failing tests for lecturer submission list (REVIEW-01 isolation, D-10, D-11)`
- Files: `backend/apps/submissions/tests/test_lecturer_view.py`

**Task 1 GREEN — Lecturer API implementation:**
- `feat(01-05): implement LecturerSubmissionListView, SubmissionFilter, LecturerSubmissionSerializer`
- Files: `backend/apps/submissions/filters.py`, `backend/apps/submissions/serializers.py`, `backend/apps/submissions/views.py`, `backend/apps/submissions/urls.py`

**Task 2 — Lecturer dashboard frontend:**
- `feat(01-05): implement LecturerDashboard S-08, fetchLecturerSubmissions, Vitest tests`
- Files: `frontend/src/api/submissions.ts`, `frontend/src/pages/lecturer/LecturerDashboard.tsx`, `frontend/src/pages/lecturer/LecturerDashboard.test.tsx`, `frontend/src/router.tsx`

**Plan metadata:** `docs(01-05): complete lecturer review dashboard plan`

## Files Created/Modified

**Backend — submissions app:**
- `backend/apps/submissions/filters.py` — SubmissionFilter (FilterSet, status exact match)
- `backend/apps/submissions/serializers.py` — Added LecturerSubmissionSerializer (student_nim, student_name, symptom_names, status, created_at, original_filename, file_url via /api/files/<uuid>/)
- `backend/apps/submissions/views.py` — Added LecturerSubmissionListView (generics.ListAPIView, IsLecturer, student__adviser filter, DjangoFilterBackend + SearchFilter + OrderingFilter)
- `backend/apps/submissions/urls.py` — Added lecturer/ path for LecturerSubmissionListView; no approve/reject routes (D-12)
- `backend/apps/submissions/tests/test_lecturer_view.py` — 10 test behaviors: T-1 isolation, T-2 cross-lecturer isolation, T-3 D-10 columns, T-4 status filter, T-5 NIM search, T-6 name search, T-7 ordering, T-8 student 403, T-9 unapproved 403, T-10 unauthenticated

**Frontend:**
- `frontend/src/api/submissions.ts` — Added fetchLecturerSubmissions + LecturerSubmissionItem + FetchLecturerSubmissionsParams types
- `frontend/src/pages/lecturer/LecturerDashboard.tsx` — S-08 lecturer dashboard: header, bottom nav (Beranda|Antrean|Riwayat|Profil), greeting, date, Permintaan Masuk list, filter tabs, search, submission cards with Lihat Draft, PDFPreview, empty state
- `frontend/src/pages/lecturer/LecturerDashboard.test.tsx` — 8 MSW-mocked Vitest tests
- `frontend/src/router.tsx` — /dosen → LecturerDashboard (replaces Placeholder)

## Decisions Made

- **Dedicated /api/submissions/lecturer/ URL**: Keeping the lecturer endpoint separate from the student endpoint (`/api/submissions/`) avoids mixing `IsStudent` and `IsLecturer` permissions in one view. Each role has a clean URL and view class.
- **ORM-level isolation**: `get_queryset()` filters `student__adviser=request.user` at the ORM level — never at serializer or presentation layer. Even if the serializer were modified, the queryset isolation prevents any data leakage.
- **LecturerSubmissionSerializer.get_file_url()**: Always constructs `/api/files/<uuid>/` from the UUID. Never uses `file_path` (absolute OS path) or `MEDIA_URL` (would bypass auth). The Plan 04 file-serving view re-checks ownership on every access (D-29 defense-in-depth).
- **No approve/reject in Phase 1**: D-12 confirmed. The `lecturer/` URL only registers a `LecturerSubmissionListView` (ListAPIView). Phase 2 will add detail view with status-update actions.
- **Search via DRF SearchFilter**: Uses `search_fields = ['student__nim', 'student__full_name']` — DRF handles the `__icontains` lookup automatically. No hand-rolled LIKE queries (T-1-24 mitigation — parameterized via ORM).
- **300ms debounce on search**: Prevents API request per keystroke while still feeling responsive.
- **STATUS_MAP in LecturerDashboard**: Maps API lowercase status values to StatusBadge's uppercase enum strings — same pattern as StudentDashboard for consistency.

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

All threats from the plan's threat model were mitigated:
- T-1-21 (Information Disclosure — lecturer reads another lecturer's students): Mitigated by `student__adviser=request.user` ORM filter in `get_queryset()`. Test T-2 asserts isolation.
- T-1-22 (Elevation of Privilege — student/unapproved hits lecturer list): Mitigated by `IsLecturer` (implies `IsApprovedUser` + `role=lecturer`). Tests T-8, T-9, T-10 assert 403.
- T-1-23 (Information Disclosure — file_url exposes guessable/public path): Mitigated by `get_file_url()` returning `/api/files/<uuid>/` — never a media path or OS file path.
- T-1-24 (Information Disclosure — search/filter query injection): Mitigated by DRF SearchFilter + django-filter SubmissionFilter — all parameterized via ORM.

No new threat surface introduced beyond what the plan's threat model covers.

## Known Stubs

None — all data flows are wired:
- LecturerDashboard fetches from GET /api/submissions/lecturer/ (real endpoint)
- Filter tabs drive `?status=` param to the real endpoint
- Search field drives `?search=` param to the real endpoint
- "Lihat Draft" opens PDFPreview with /api/files/<uuid>/ (real endpoint, ownership-checked from Plan 04)
- Bottom nav Antrean/Riwayat/Profil tabs are navigation stubs (Phase 2+) — they are not rendering stubs that block the plan's goal (the plan only requires the Beranda/Permintaan Masuk view).

## Self-Check

**Files verified present:**
- backend/apps/submissions/filters.py — CREATED (contains FilterSet, SubmissionFilter, status exact filter)
- backend/apps/submissions/serializers.py — MODIFIED (contains LecturerSubmissionSerializer, /api/files/ in get_file_url)
- backend/apps/submissions/views.py — MODIFIED (contains student__adviser, LecturerSubmissionListView, IsLecturer)
- backend/apps/submissions/urls.py — MODIFIED (contains lecturer/ path, no approve/reject routes)
- backend/apps/submissions/tests/test_lecturer_view.py — CREATED (10 test behaviors, LECTURER_URL = /api/submissions/lecturer/)
- frontend/src/api/submissions.ts — MODIFIED (contains fetchLecturerSubmissions, LecturerSubmissionItem)
- frontend/src/pages/lecturer/LecturerDashboard.tsx — CREATED (contains Lihat Draft, Belum Ada Permintaan Masuk, Cari NIM atau nama)
- frontend/src/pages/lecturer/LecturerDashboard.test.tsx — CREATED (8 tests)
- frontend/src/router.tsx — MODIFIED (LecturerDashboard imported and wired at /dosen)

**Acceptance criteria verified:**
- grep "student__adviser" views.py: 5 occurrences (PASS — >= 1)
- grep "FilterSet" filters.py: 4 occurrences (PASS — >= 1)
- grep "/api/files/" serializers.py: 6 occurrences (PASS — >= 1)
- grep "Lihat Draft" LecturerDashboard.tsx: 4 occurrences (PASS — >= 1)
- grep "Belum Ada Permintaan Masuk" LecturerDashboard.tsx: 2 occurrences (PASS — >= 1)
- grep "Cari NIM atau nama" LecturerDashboard.tsx: 2 occurrences (PASS — >= 1)
- No Setujui/Tolak/Approve/Reject ACTION buttons in LecturerDashboard.tsx — only JSDoc comments (PASS)
- No approve/reject URL patterns in submissions/urls.py — only comments (PASS)

## Self-Check: PASSED

All files present. All acceptance criteria verified.

## Phase 1 Completion

Plan 01-05 is the FINAL plan of Phase 1. Phase 1 success criteria are now complete:

1. Student can select an "Academic Symptom" from a dropdown and upload a draft PDF — DONE (01-04)
2. A submission missing the file or symptom selection is rejected with a clear error — DONE (01-04)
3. Admin can set/update a duration weight for each "Academic Symptom" category — DONE (01-03)
4. Lecturer can view a list of pending guidance requests with symptom + draft attachment link — DONE (01-05)

**Phase 1 is complete. Ready for Phase 2 (Approval flow + lecturer actions).**

---
*Phase: 01-submission-triage-foundation*
*Completed: 2026-06-25*
