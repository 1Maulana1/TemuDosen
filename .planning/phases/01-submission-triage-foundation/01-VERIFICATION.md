---
phase: 01-submission-triage-foundation
verified: 2026-06-25T12:00:00Z
status: human_needed
score: 6/6 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Login flow end-to-end (admin@temudosen.ac.id / ChangeMe123!)"
    expected: "Redirect to role-gated route; sessionid + csrftoken cookies set in DevTools"
    why_human: "Requires running browser + backend; user already reported 'approved'"
  - test: "PDF upload in browser (student, /mahasiswa/ajukan)"
    expected: "Valid PDF accepted with success chip; oversized and non-PDF rejected with exact error copy"
    why_human: "Requires live browser to test file picker + multipart POST"
  - test: "Admin symptom weight editing (/admin/katalog-gejala)"
    expected: "6 seeded rows visible; inline edit + Simpan Semua Perubahan persists new value on reload"
    why_human: "Requires running backend + browser to confirm persistence"
  - test: "Lecturer dashboard showing student submissions (/dosen)"
    expected: "Cards show NIM + symptom + StatusBadge; Lihat Draft opens PDF; no Setujui/Tolak buttons"
    why_human: "Requires registered student/lecturer with adviser relationship and a submitted request"
---

# Phase 01: Submission Triage Foundation — Verification Report

**Phase Goal:** A student can submit a guidance request (symptoms + draft PDF) that is validated and visible to their lecturer, with admin-configured symptom weights in place that later drive the triage calculation.
**Verified:** 2026-06-25
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Student can select an Academic Symptom and upload a draft PDF (max 5MB) — Submission model + SubmissionCreateSerializer | VERIFIED | `SubmissionCreateSerializer` exists with `symptom_ids` ListField (min_length=1) + `draft_file` FileField; 5MB limit in `validate_draft_file`; `Submission` + `SubmissionFile` models fully implemented |
| 2  | Submission missing file or symptom is rejected with specific error | VERIFIED | Exact Bahasa Indonesia error copy "Pilih minimal satu gejala akademik." and "Unggah file PDF draft sebelum melanjutkan." present in serializer; test_upload.py tests T-2 and T-3 assert exact copy + 400 status |
| 3  | Admin can set/update duration weight per symptom category, persists | VERIFIED | `SymptomCategory` model with `duration_minutes` (PositiveIntegerField); `SymptomCategoryViewSet` with `bulk_update` action (atomic transaction); `SymptomConfig.tsx` calls `bulkUpdateSymptoms`; seed migration `0002_seed_default_symptoms.py` uses RunPython get_or_create |
| 4  | Lecturer can view pending requests showing symptom + attachment link | VERIFIED | `LecturerSubmissionListView` filters `student__adviser=request.user` at ORM level; `LecturerSubmissionSerializer` exposes D-10 columns; `file_url` always points to `/api/files/<uuid>/`; `LecturerDashboard.tsx` shows symptom chips, StatusBadge, "Lihat Draft" button; empty state "Belum Ada Permintaan Masuk" present |
| 5  | AUTH_USER_MODEL set before first migration | VERIFIED | `AUTH_USER_MODEL = 'accounts.CustomUser'` at line 20 of `backend/config/settings/base.py` with explicit comment; `0001_initial.py` migration exists and imports the correct CustomUser schema; no CircularDependencyError risk |
| 6  | Seeded admin can log in through React UI, cookies present, role routing works | HUMAN_NEEDED | `seed_admin.py` command creates `admin@temudosen.ac.id` / `ChangeMe123!` with `get_or_create`; `main.tsx` awaits `getCSRFToken()` before render; `router.tsx` has `requireAuth`/`requireRole` loaders; user reported "approved" at human checkpoint — not programmatically verifiable |

**Score:** 5/6 truths verified programmatically; 1 requires human confirmation (already approved by user).

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/apps/accounts/models.py` | CustomUser (AbstractBaseUser) with role, nim, nidn, is_approved, adviser, google_oauth_token | VERIFIED | All fields present: email, full_name, role (TextChoices), nim, nidn, is_approved, is_active, is_staff, google_oauth_token (JSONField null), adviser (self-FK), created_at; AbstractBaseUser + PermissionsMixin correctly used |
| `backend/config/settings/base.py` | AUTH_USER_MODEL, DRF SessionAuthentication, CORS, session/CSRF cookie config, MEDIA_ROOT, upload size limits | VERIFIED | All settings present: AUTH_USER_MODEL, REST_FRAMEWORK SessionAuthentication, SESSION_COOKIE_HTTPONLY, CSRF_COOKIE_HTTPONLY=False, MEDIA_ROOT, DATA_UPLOAD_MAX_MEMORY_SIZE=6MB |
| `backend/core/views.py` | csrf_cookie GET endpoint | VERIFIED | `get_token(request)` called; AllowAny + empty authentication_classes; returns 200 |
| `frontend/src/api/client.ts` | apiRequest wrapper with credentials:'include' + X-CSRFToken injection | VERIFIED | `credentials: 'include'` on every fetch; `X-CSRFToken` injected for POST/PUT/PATCH/DELETE via `getCsrfToken()` |
| `frontend/src/router.tsx` | createBrowserRouter with all Phase-1 routes + requireAuth/requireRole loaders | VERIFIED | `createBrowserRouter` present; `/mahasiswa`, `/dosen`, `/admin`, `/login`, `/register`, `/pending-approval` all wired; `requireAuth` redirects unauthenticated + unapproved; `requireRole(role)` wraps per-section |
| `backend/apps/accounts/management/commands/seed_admin.py` | seed_admin management command (D-25) | VERIFIED | `get_or_create` used for both admin and kaprodi; idempotent; passwords set via `set_password` |
| `backend/apps/submissions/models.py` | Submission + SubmissionFile models (UUID filenames, status, symptoms M2M) | VERIFIED | Submission: student FK, symptoms M2M, description, status (TextChoices), created_at, updated_at; SubmissionFile: OneToOne, uuid (UUID4), original_filename, file_path, file_size, uploaded_at |
| `backend/apps/submissions/serializers.py` | SubmissionCreateSerializer with 5MB + magic-bytes PDF validation | VERIFIED | `_MAGIC_AVAILABLE` guard; `validate_draft_file` checks size then magic bytes before any disk write; exact Bahasa Indonesia error copy matches UI-SPEC |
| `backend/apps/submissions/views.py` | Submission create/list + protected serve_submission_file (D-29 ownership check) | VERIFIED | `FileResponse` returned; `PermissionDenied` raised for non-owner/non-adviser/non-admin; never uses MEDIA_URL; `LecturerSubmissionListView` with `student__adviser` filter |
| `backend/apps/submissions/filters.py` | SubmissionFilter (status filter) + search/ordering config | VERIFIED | `django_filters.FilterSet` subclass with `status` exact filter; SearchFilter/OrderingFilter on view |
| `backend/apps/symptoms/models.py` | SymptomCategory model with duration_minutes (absolute) and is_active | VERIFIED | `duration_minutes` (PositiveIntegerField), `is_active` (BooleanField default True), `name` (unique), timestamps |
| `backend/apps/symptoms/migrations/0002_seed_default_symptoms.py` | Data migration seeding 6 default categories (D-02) | VERIFIED | `RunPython(seed_symptoms, unseed_symptoms)`; all 6 categories with correct names and durations; `get_or_create` for idempotency |
| `backend/apps/symptoms/views.py` | SymptomCategory ViewSet — admin write, approved-user read, bulk-update action | VERIFIED | `get_permissions()` checks action in `_ADMIN_WRITE_ACTIONS`; `@action(detail=False, methods=['post'], url_path='bulk-update')` with `transaction.atomic()` |
| `frontend/src/pages/admin/SymptomConfig.tsx` | Inline-editable symptom weight table (S-10, D-06, D-07) | VERIFIED | "Simpan Semua Perubahan" at line 446; calls `bulkUpdateSymptoms`; "Tambah Gejala" button; delete confirm modal with "Hapus gejala ini?" / "Tindakan ini tidak dapat dibatalkan." |
| `frontend/src/pages/lecturer/LecturerDashboard.tsx` | Lecturer pending-requests dashboard S-08 (view-only, filter/search/sort) | VERIFIED | "Lihat Draft" button present; "Belum Ada Permintaan Masuk" empty state; "Cari NIM atau nama..." search placeholder; status filter tabs; calls `fetchLecturerSubmissions`; NO Setujui/Tolak buttons |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `frontend/src/main.tsx` | `/api/csrf/` | `getCSRFToken()` awaited before render | WIRED | `await getCSRFToken()` in `bootstrap()` before `createRoot().render()` |
| `frontend/src/api/client.ts` | Django session | fetch credentials:include + X-CSRFToken header | WIRED | `credentials: 'include'` on all requests; `X-CSRFToken: getCsrfToken()` on unsafe methods |
| `backend/config/settings/base.py` | `accounts.CustomUser` | `AUTH_USER_MODEL` | WIRED | Line 20: `AUTH_USER_MODEL = 'accounts.CustomUser'` |
| `frontend/src/pages/student/SubmissionForm.tsx` | `/api/submissions/` | multipart POST on submit | WIRED | `createSubmission` uses raw fetch with FormData; `submissions.ts` POSTs to `/api/submissions/` |
| `backend/apps/submissions/views.py` | SubmissionFile ownership | `serve_submission_file` checks student==request.user or adviser | WIRED | `is_owner`, `is_adviser`, `is_admin_or_kaprodi` checks before `FileResponse` |
| `frontend/src/components/PDFPreview.tsx` | `/api/files/<uuid>/` | iframe src with auth cookie | WIRED | `LecturerDashboard.tsx` passes `fileUuid` to `PDFPreview`; `PDFPreview` renders iframe pointed at `/api/files/<uuid>/` |
| `frontend/src/pages/admin/SymptomConfig.tsx` | `/api/symptoms/bulk-update/` | POST on Simpan Semua click | WIRED | `bulkUpdateSymptoms` called in save handler; `api/symptoms.ts` wraps the bulk-update endpoint |
| `frontend/src/pages/lecturer/LecturerDashboard.tsx` | `/api/submissions/lecturer/` | fetch with filter/search/sort query params | WIRED | `fetchLecturerSubmissions(params)` called in `loadSubmissions`; params.status and params.search mapped to URLSearchParams |
| `backend/apps/submissions/views.py` | `Submission.student.adviser` | queryset filtered to `student__adviser == request.user` | WIRED | `Submission.objects.filter(student__adviser=self.request.user)` in `LecturerSubmissionListView.get_queryset()` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `LecturerDashboard.tsx` | `submissions` (state) | `fetchLecturerSubmissions()` → GET `/api/submissions/lecturer/` → `LecturerSubmissionListView.get_queryset()` → DB query `Submission.objects.filter(student__adviser=...)` | Yes — real DB query via Django ORM | FLOWING |
| `StudentDashboard.tsx` | `submissions` (state) | `fetchMySubmissions()` → GET `/api/submissions/` → `SubmissionListCreateView.get()` → `Submission.objects.filter(student=request.user)` | Yes — real DB query | FLOWING |
| `SymptomConfig.tsx` | `rows` (state) | `fetchSymptoms()` → GET `/api/symptoms/` → `SymptomCategoryViewSet.list()` → DB query + seeded data | Yes — real DB query; seeded by 0002 migration | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: Cannot run server-dependent checks without starting services. Key static evidence confirmed instead:

| Behavior | Evidence | Status |
|----------|----------|--------|
| POST /api/submissions/ validates symptom_ids min_length=1 | `SubmissionCreateSerializer.symptom_ids` has `min_length=1`; `test_upload.py` T-2 asserts 400 + exact copy | PASS (static) |
| POST /api/submissions/ validates 5MB limit before disk write | `validate_draft_file` checks `file.size > max_size` before `save_file` is called; `test_upload.py` T-4 asserts no file on disk | PASS (static) |
| GET /api/files/<uuid>/ returns 403 for non-owner | `PermissionDenied` raised in `serve_submission_file` if not owner/adviser/admin; `test_file_access.py` T-6 tests assert | PASS (static) |
| Seed migration runs 6 categories | `DEFAULT_SYMPTOMS` list has exactly 6 entries; `get_or_create` used | PASS (static) |

---

### Probe Execution

Step 7c: No probe scripts defined (`scripts/*/tests/probe-*.sh` not present). SKIPPED.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| TRIAGE-01 | 01-01, 01-02, 01-04 | Student selects symptoms + uploads draft PDF (max 5MB) | SATISFIED | `SubmissionCreateSerializer` validates symptom_ids (min 1) + draft_file (5MB + magic bytes); `SubmissionForm.tsx` wired to POST /api/submissions/ |
| TRIAGE-02 | 01-04 | System validates draft file and symptom form together on submit | SATISFIED | Combined validation in `SubmissionCreateSerializer`; exact error copy present; test_upload.py T-2/T-3/T-4/T-5 confirm all 4 rejection cases |
| REVIEW-01 | 01-05 | Lecturer can view pending guidance requests with symptoms + attachment | SATISFIED | `LecturerSubmissionListView` advisee-scoped; D-10 columns in serializer; `LecturerDashboard.tsx` shows symptom chips + "Lihat Draft"; test_lecturer_view.py 10 tests cover isolation + columns + filter/search |
| ADMIN-01 | 01-03 | Admin configures per-Symptom duration weights | SATISFIED | `SymptomCategoryViewSet` admin-only writes; `bulk_update` action; `SymptomConfig.tsx` inline-editable table; 6 seeded categories via migration |

All 4 requirement IDs declared across plans are accounted for and satisfied.

---

### Anti-Patterns Found

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| `backend/apps/submissions/serializers.py` lines 23-29 | `_MAGIC_AVAILABLE = False` fallback when libmagic unavailable | INFO | Intentional Pitfall 5 workaround; %PDF- header fallback is a known deviation acceptable for dev; production requires libmagic1 installed (documented in comments) |

No TBD/FIXME/XXX markers found across any modified Python or TypeScript files. No stub implementations (empty returns, placeholder renders) found in any artifact that renders dynamic data. No `return null` in any data-rendering path.

---

### Human Verification Required

The following items require the application to be running. The login flow was already manually approved by the user at the Plan 01 human checkpoint.

#### 1. End-to-end Login Flow (Already Approved)

**Test:** Start backend + frontend, open http://localhost:5173/login, log in as admin@temudosen.ac.id / ChangeMe123!
**Expected:** Redirect to role-gated route; sessionid + csrftoken cookies visible in DevTools; GET /api/auth/me/ returns `role: "admin"`
**Why human:** Cookie presence and role routing require a running browser session
**Note:** User reported "approved" at the Plan 01 human checkpoint. Captured here for completeness.

#### 2. PDF Upload in Browser

**Test:** Log in as an approved student, open /mahasiswa/ajukan, try uploading: (a) a valid <=5MB PDF, (b) a >5MB file, (c) a non-PDF file
**Expected:** (a) Success chip "Selesai diunggah"; (b) error "Ukuran file melebihi batas 5MB..."; (c) error "Hanya file PDF yang diizinkan."
**Why human:** File picker + multipart boundary requires a live browser

#### 3. Admin Symptom Weight Editing

**Test:** Log in as admin, open /admin/katalog-gejala, verify 6 seeded rows, edit a duration value, click "Simpan Semua Perubahan", reload page
**Expected:** All 6 categories present with correct names; changed duration persists after reload
**Why human:** Requires verifying DB persistence through a browser interaction cycle

#### 4. Lecturer Dashboard Showing Student Submissions

**Test:** Register a student assigned to a lecturer; student submits a request; log in as the lecturer, open /dosen
**Expected:** Submission card shows student NIM, name, symptom chip, StatusBadge "Menunggu", "Lihat Draft" button; NO Setujui/Tolak buttons; PDF renders in preview
**Why human:** Requires populated test data and a running session to verify card rendering + PDF iframe

---

### Gaps Summary

No gaps identified. All 6 must-haves are either programmatically VERIFIED or covered by an already-approved human checkpoint. All 4 requirement IDs (TRIAGE-01, TRIAGE-02, REVIEW-01, ADMIN-01) are fully implemented with substantive, wired artifacts. All key links are confirmed live in the codebase. No anti-pattern blockers.

The `status: human_needed` designation reflects the 4 human verification items above — of which item 1 (login flow) was already approved manually. Items 2-4 are standard end-to-end smoke tests that cannot be automated without a running server.

---

*Verified: 2026-06-25*
*Verifier: Claude (gsd-verifier)*
