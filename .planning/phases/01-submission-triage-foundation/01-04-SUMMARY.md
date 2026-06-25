---
phase: 01-submission-triage-foundation
plan: "04"
subsystem: submissions
tags: [django, drf, react, tailwind, pdf-upload, file-serving, symptom-chips, student-dashboard, d29, triage]

# Dependency graph
requires:
  - phase: 01-01
    provides: "CustomUser model, session auth, permission classes, apiRequest client, Tailwind v4 @theme, router scaffold"
  - phase: 01-02
    provides: "IsStudent/IsApprovedUser permissions, approved-lecturer adviser relationship, conftest fixtures"
  - phase: 01-03
    provides: "SymptomCategory model, GET /api/symptoms/ endpoint, fetchSymptoms() API client"

provides:
  - "Submission model: student FK, symptoms M2M, description, status (pending/approved/rejected/revision), created_at, updated_at"
  - "SubmissionFile model: submission OneToOne, uuid (UUID4), original_filename, file_path, file_size, uploaded_at"
  - "SubmissionCreateSerializer: symptom_ids ListField (min_length=1), description optional 500-char, draft_file with 5MB + magic-bytes PDF validation"
  - "SubmissionListSerializer: for dashboard list (id, status, symptoms, file_uuid, file_name, dates)"
  - "POST /api/submissions/ — student creates submission (IsStudent + IsApprovedUser required)"
  - "GET  /api/submissions/ — student lists own submissions"
  - "GET  /api/files/<uuid>/ — ownership-checked protected file serving (D-29)"
  - "api/submissions.ts: createSubmission (multipart FormData) + fetchMySubmissions"
  - "SymptomChips component: multi-select chip group per UI-SPEC states"
  - "UploadZone component: dashed zone, PDF pre-check, success card"
  - "PDFPreview component: iframe src=/api/files/<uuid>/ modal with close + download"
  - "StudentDashboard (S-06): header, bottom nav, greeting, shortcut card, submission list, PDF preview, empty state"
  - "SubmissionForm (S-07): step progress bar, adviser card, symptom chips, description, upload zone, duration estimate, sticky CTA"
  - "conftest: symptom_category, second_approved_student, pdf_file, submission_factory fixtures"
  - "UserSerializer extended with nested AdviserSerializer for /api/auth/me/ (D-24)"

affects:
  - "01-05-PLAN.md — lecturer dashboard reads same Submission/SubmissionFile models + /api/submissions/ endpoint filtered by adviser"
  - "Phase 2 — approval flow reads submission.status, updates Submission.status"
  - "All future plans — file serving route /api/files/<uuid>/ pattern established (D-29 auth-gated serving)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pattern: SubmissionCreateSerializer validates (size + magic bytes) BEFORE writing file to disk — bad files never touch MEDIA_ROOT"
    - "Pattern: serve_submission_file — IsAuthenticated + ownership check (student == owner OR adviser OR admin/kaprodi) before FileResponse (D-29)"
    - "Pattern: multipart QueryDict getlist('symptom_ids') — extracts all repeated form keys, not just last value"
    - "Pattern: UserSerializer with nested AdviserSerializer — student /me/ response includes adviser info (D-24)"
    - "Pattern: SymptomChips toggles aria-pressed + selected state class swap — no state stored in DOM, state in React useState"
    - "Pattern: PDFPreview uses /api/files/<uuid>/ iframe — browser sends session cookie same-origin (Vite proxy), never MEDIA_URL"
    - "Pattern: UploadZone client-side pre-check (MIME + size) is UX only; server is authoritative per Responsibility Map"
    - "Pattern: python-magic with fallback to %PDF- header check — guards Pitfall 5 (Windows libmagic DLL)"

key-files:
  created:
    - "backend/apps/submissions/serializers.py"
    - "backend/apps/submissions/views.py"
    - "backend/apps/submissions/urls.py"
    - "backend/apps/submissions/tests/__init__.py"
    - "backend/apps/submissions/tests/test_upload.py"
    - "backend/apps/submissions/tests/test_file_access.py"
    - "frontend/src/api/submissions.ts"
    - "frontend/src/components/SymptomChips.tsx"
    - "frontend/src/components/UploadZone.tsx"
    - "frontend/src/components/PDFPreview.tsx"
    - "frontend/src/pages/student/StudentDashboard.tsx"
    - "frontend/src/pages/student/SubmissionForm.tsx"
    - "frontend/src/pages/student/SubmissionForm.test.tsx"
  modified:
    - "backend/config/urls.py (uncommented api/submissions/ include; added api/files/ route)"
    - "backend/apps/submissions/admin.py (enhanced with search_fields, filter_horizontal, readonly_fields)"
    - "backend/conftest.py (added symptom_category, second_approved_student, pdf_file, submission_factory fixtures)"
    - "backend/apps/accounts/serializers.py (added AdviserSerializer, extended UserSerializer with adviser nested field)"
    - "frontend/src/router.tsx (replaced /mahasiswa + /mahasiswa/ajukan placeholders with StudentDashboard + SubmissionForm)"
    - "frontend/src/api/auth.ts (added AdviserInfo interface, adviser field to User)"

key-decisions:
  - "validate_draft_file rejects before save_file is called — oversized/wrong-MIME files never touch disk (CRITICAL per D-29/threat T-1-16/T-1-17)"
  - "python-magic with %PDF- fallback for Windows dev (Pitfall 5) — _MAGIC_AVAILABLE guard at module import time"
  - "serve_submission_file uses FileResponse(open(path, 'rb'), content_type='application/pdf') — no MEDIA_URL, D-29 compliant"
  - "Ownership check: student==owner OR adviser==user OR admin/kaprodi — implements T-1-15 and T-1-18"
  - "multipart QueryDict getlist() for symptom_ids — standard Django QueryDict returns last value only for repeated keys"
  - "AdviserSerializer nested in UserSerializer — /api/auth/me/ now returns adviser info so frontend can show read-only adviser card (D-24)"
  - "SymptomChips uses aria-pressed for accessibility — toggling pressed state is semantically correct for toggle buttons"
  - "UploadZone: success card shows '[filename] • [X.X MB] • Selesai diunggah' with remove button — exactly per Copywriting Contract"
  - "CTA 'Lanjutkan ke Jadwal' disabled (opacity-50 cursor-not-allowed) until both selectedSymptomIds.length > 0 AND selectedFile !== null"
  - "PDFPreview split-pane: iframe fills left, empty notes pane on lg: (desktop only) — D-16 Phase 1 placeholder for Phase 2 feedback"
  - "STATUS_MAP in StudentDashboard maps lowercase API values (pending/approved/rejected/revision) to StatusBadge enum values"

patterns-established:
  - "Pattern: Auth-gated file serving via /api/files/<uuid>/ — ownership check mandatory before FileResponse"
  - "Pattern: Multipart form POST with repeated key getlist() for array fields — all future multipart submissions follow this"
  - "Pattern: Magic-bytes validation in serializer (pre-disk) — all future file upload serializers follow this order"
  - "Pattern: Nested serializer for related info in /me/ response — follows as needed for other role-specific data"

requirements-completed: [TRIAGE-01, TRIAGE-02]

# Metrics
duration: "~3h"
completed: "2026-06-25"
---

# Phase 01 Plan 04: Submission Form + PDF Upload Summary

**Student submission vertical slice: Submission + SubmissionFile models with 5MB/magic-bytes validated upload, auth-gated /api/files/<uuid>/ ownership-checked serving (D-29), and student-facing SymptomChips+UploadZone+PDFPreview UI wired end-to-end — approved student can submit a guidance request and preview it on the dashboard**

## Performance

- **Duration:** ~3h
- **Started:** 2026-06-25T13:30:00Z
- **Completed:** 2026-06-25T16:30:00Z
- **Tasks:** 3 (2 auto TDD+feat + 1 checkpoint:human-verify, auto-approved per execution directive)
- **Files modified:** 19 (13 created, 6 modified)

## Accomplishments

**Backend:**
- `SubmissionCreateSerializer` validates in order: symptom_ids (min 1), draft_file required, file size <=5MB, magic-bytes MIME = application/pdf — all BEFORE any write to disk. `_MAGIC_AVAILABLE` guard handles Pitfall 5 (Windows libmagic DLL) with %PDF- header fallback.
- `serve_submission_file` (D-29): GET /api/files/<uuid>/ requires IsAuthenticated + ownership check (student==owner OR adviser OR admin/kaprodi). Returns `FileResponse` with `Content-Disposition: inline` for in-app preview. Never touches MEDIA_URL.
- QueryDict `getlist('symptom_ids')` extracts all repeated multipart values — not just the last one.
- `UserSerializer` extended with nested `AdviserSerializer` — /api/auth/me/ now returns adviser info so S-07 can show the read-only adviser card (D-24).
- All 6 upload and file-access test behaviors implemented and passing (test_upload.py + test_file_access.py).
- `conftest.py` extended with symptom_category, second_approved_student, pdf_file, submission_factory fixtures.

**Frontend:**
- `api/submissions.ts`: createSubmission (raw fetch multipart — does NOT force Content-Type, lets browser set boundary + correct MIME) + fetchMySubmissions.
- `SymptomChips`: multi-select chip group with aria-pressed, selected/unselected states per UI-SPEC Interaction States table.
- `UploadZone`: dashed drop zone with drag-over state, client-side size/MIME pre-check, success card showing "[filename] • [X.X MB] • Selesai diunggah", remove button.
- `PDFPreview`: full-screen modal, iframe src=/api/files/<uuid>/ (auth cookie sent automatically via same-origin Vite proxy), close button, Unduh PDF download link, empty notes right-pane (D-16 Phase 2 extension point).
- `SubmissionForm` (S-07): all spec elements — fixed header + step progress bar "Langkah 1 dari 2" 50% fill, adviser card (D-24), SymptomChips with error, description textarea with char counter, UploadZone, Estimasi Durasi dark bento card, sticky CTA "Lanjutkan ke Jadwal" disabled until symptom + file present.
- `StudentDashboard` (S-06): TemuDosen wordmark header, bottom nav (Beranda|Ajukan|Riwayat|Profil), greeting, "Ajukan Bimbingan Baru" shortcut card, submission list with StatusBadge + symptom names + date + "Pratinjau" button, empty state "Belum Ada Pengajuan" with exact copy + "Ajukan Sekarang" CTA.
- `SubmissionForm.test.tsx`: 6 Vitest tests — CTA disabled without symptom/file, enabled after both, error messages on form submit.
- `router.tsx`: /mahasiswa and /mahasiswa/ajukan placeholders replaced with StudentDashboard and SubmissionForm.

## Task Commits

1. **Task 1 RED: Failing tests for submission upload + file access**
   - `test(01-04): add failing tests for submission upload and D-29 file access`
   - Files: backend/apps/submissions/tests/__init__.py, test_upload.py, test_file_access.py

2. **Task 1 GREEN: Submission models, serializer, views, URLs, admin, conftest, accounts serializer**
   - `feat(01-04): implement Submission/SubmissionFile models, validated upload, protected file serving`
   - Files: serializers.py, views.py, urls.py, admin.py, config/urls.py, conftest.py, accounts/serializers.py

3. **Task 2: Student submission form + My Submissions dashboard**
   - `feat(01-04): implement SubmissionForm S-07, StudentDashboard S-06, UploadZone, SymptomChips, PDFPreview`
   - Files: api/submissions.ts, SymptomChips.tsx, UploadZone.tsx, PDFPreview.tsx, StudentDashboard.tsx, SubmissionForm.tsx, SubmissionForm.test.tsx, router.tsx, api/auth.ts

4. **Task 3 (checkpoint auto-approved):** No code commit needed

**Plan metadata:** `docs(01-04): complete submission form and PDF upload plan`

## Files Created/Modified

**Backend — submissions app:**
- `backend/apps/submissions/serializers.py` — SubmissionCreateSerializer (symptom_ids ListField min_length=1, draft_file 5MB + magic bytes, validate-before-save_file), SubmissionListSerializer, SubmissionFileSerializer
- `backend/apps/submissions/views.py` — SubmissionListCreateView (POST/GET, IsStudent), serve_submission_file (IsAuthenticated + ownership: owner/adviser/admin/kaprodi, FileResponse inline)
- `backend/apps/submissions/urls.py` — SubmissionListCreateView + file_urlpatterns (exported for config/urls.py to mount at /api/files/)
- `backend/apps/submissions/tests/__init__.py` — empty module marker
- `backend/apps/submissions/tests/test_upload.py` — 7 tests: valid submission 201, file on disk, missing symptom 400 exact copy, missing file 400 exact copy, oversized 400 + no file on disk, wrong MIME 400 + no file on disk, unauthenticated 403, unapproved 403
- `backend/apps/submissions/tests/test_file_access.py` — 6 tests: unauthenticated 403, non-owner 403, owner 200 application/pdf, adviser 200, admin 200, nonexistent UUID 404

**Backend — project-wide:**
- `backend/config/urls.py` — Uncommented submissions include; added file_urlpatterns mounted at /api/files/
- `backend/apps/submissions/admin.py` — Enhanced SubmissionAdmin (search_fields, filter_horizontal) + SubmissionFileAdmin (readonly uuid)
- `backend/conftest.py` — Added symptom_category, second_approved_student, pdf_file, submission_factory fixtures
- `backend/apps/accounts/serializers.py` — Added AdviserSerializer, extended UserSerializer with adviser nested field (D-24)

**Frontend:**
- `frontend/src/api/submissions.ts` — createSubmission (raw fetch multipart FormData, no Content-Type override), fetchMySubmissions, TypeScript interfaces SubmissionSummary/CreateSubmissionResult
- `frontend/src/components/SymptomChips.tsx` — Multi-select chip group: aria-pressed, selected/unselected Tailwind states, error prop with aria-live
- `frontend/src/components/UploadZone.tsx` — Dashed upload zone: drag-drop, client-side PDF/size pre-check, success card "[filename] • [X.X MB] • Selesai diunggah", remove button
- `frontend/src/components/PDFPreview.tsx` — Full-screen modal: iframe /api/files/<uuid>/, close button, Unduh PDF anchor, empty notes pane (D-16)
- `frontend/src/pages/student/StudentDashboard.tsx` — S-06 dashboard: header, bottom nav, greeting, shortcut card, submission list with StatusBadge/Pratinjau, empty state "Belum Ada Pengajuan"
- `frontend/src/pages/student/SubmissionForm.tsx` — S-07 form: step progress, adviser card, SymptomChips, textarea 500 char, UploadZone, Estimasi Durasi bento, "Lanjutkan ke Jadwal" sticky CTA
- `frontend/src/pages/student/SubmissionForm.test.tsx` — 6 Vitest tests: CTA disabled states, enabled state, validation error copy
- `frontend/src/router.tsx` — /mahasiswa → StudentDashboard, /mahasiswa/ajukan → SubmissionForm
- `frontend/src/api/auth.ts` — AdviserInfo interface, adviser field on User type

## Decisions Made

- **validate-before-save_file order**: The serializer runs `validate_draft_file` (size + magic bytes check) BEFORE `create()` calls `save_file()`. This guarantees bad files are never written to disk — the CRITICAL security requirement for D-13, T-1-16, T-1-17.
- **python-magic fallback**: `_MAGIC_AVAILABLE` flag at import time — if libmagic fails to load (Windows without python-magic-bin), falls back to `file_head.startswith(b'%PDF-')` manual check. Production Linux must have libmagic1 installed.
- **QueryDict getlist('symptom_ids')**: Django's QueryDict.get() returns only the last value for repeated keys in multipart data. `getlist()` returns all values. This is required for the ListField to receive all selected symptom IDs.
- **UserSerializer + AdviserSerializer**: Extended /api/auth/me/ to include the nested adviser object — the SubmissionForm needs to display the pre-assigned adviser card (D-24) without a separate API call.
- **STATUS_MAP in StudentDashboard**: API returns lowercase status values ('pending', 'approved', 'rejected', 'revision'); StatusBadge expects uppercase enum strings ('MENUNGGU', 'DISETUJUI', etc.). Map at the boundary.
- **PDFPreview uses iframe not PDF.js**: iframe src=/api/files/<uuid>/ sends the session cookie automatically via same-origin Vite proxy. Mobile PWA at 360px renders natively. PDF.js would require extra bundle size and complexity with no benefit here (D-14 clause: "choose whatever renders consistently at 360px").
- **Empty right pane in PDFPreview**: D-16 specifies split-pane layout for Phase 1 student view; feedback pane is empty and hidden on mobile (lg: breakpoint only). Phase 2 extends this for lecturer feedback.

## Deviations from Plan

### Auto-added Missing Critical Functionality

**1. [Rule 2 - Missing] Added AdviserSerializer nested in UserSerializer**
- **Found during:** Task 1 GREEN — SubmissionForm needs to read adviser info from /api/auth/me/ to show the read-only adviser card (D-24)
- **Issue:** UserSerializer did not include the `adviser` field; frontend would need a separate API call or would show no adviser
- **Fix:** Added `AdviserSerializer` (id, full_name, nidn, email) and nested it in UserSerializer
- **Files modified:** backend/apps/accounts/serializers.py, frontend/src/api/auth.ts
- **Justification:** D-24 requires the adviser card to show the pre-assigned lecturer — this is correctness, not a feature addition

## Threat Surface Scan

All threats from the plan's threat model were mitigated:
- T-1-15 (Information Disclosure — direct media access): Mitigated by /api/files/<uuid>/ ownership check; MEDIA_URL not used as file serving path
- T-1-16 (Tampering — malicious non-PDF): Mitigated by magic-bytes check in validate_draft_file
- T-1-17 (DoS — oversized upload): Mitigated by 5MB serializer limit + DATA_UPLOAD_MAX_MEMORY_SIZE=6MB transport cap
- T-1-18 (IDOR via UUID): Mitigated by UUID non-guessable AND server-side ownership check still enforced
- T-1-19 (Elevation — unapproved creating submissions): Mitigated by IsStudent (implies IsApprovedUser + role=student)
- T-1-20 (Spoofing — CSRF): Inherits CsrfViewMiddleware + X-CSRFToken from Plan 01 client pattern

No new threat surface introduced beyond what the plan's threat model covers.

## Known Stubs

None — all data flows are wired:
- StudentDashboard fetches from GET /api/submissions/ (real endpoint)
- SubmissionForm posts to POST /api/submissions/ (real endpoint)
- PDFPreview loads from /api/files/<uuid>/ (real endpoint, ownership-checked)
- SymptomChips data from GET /api/symptoms/ (real endpoint from Plan 03)

The notes/feedback right pane in PDFPreview is intentionally empty in Phase 1 per D-16; it is NOT a rendering stub (it doesn't affect the plan's goal of showing a PDF preview).

## Self-Check

**Files verified present:**
- backend/apps/submissions/serializers.py — FOUND (contains magic, SubmissionCreateSerializer, save_file)
- backend/apps/submissions/views.py — FOUND (contains FileResponse, PermissionDenied, serve_submission_file)
- backend/apps/submissions/urls.py — FOUND (file_urlpatterns exported)
- backend/apps/submissions/tests/test_upload.py — FOUND (7 test methods)
- backend/apps/submissions/tests/test_file_access.py — FOUND (6 test methods)
- backend/config/urls.py — FOUND (api/submissions/ + api/files/ included)
- backend/conftest.py — FOUND (submission_factory, pdf_file fixtures added)
- backend/apps/accounts/serializers.py — FOUND (AdviserSerializer + UserSerializer with adviser)
- frontend/src/api/submissions.ts — FOUND (createSubmission multipart, fetchMySubmissions)
- frontend/src/components/SymptomChips.tsx — FOUND (aria-pressed, selected/unselected states)
- frontend/src/components/UploadZone.tsx — FOUND (Selesai diunggah copy, PDF pre-check)
- frontend/src/components/PDFPreview.tsx — FOUND (/api/files/ iframe, Unduh PDF)
- frontend/src/pages/student/StudentDashboard.tsx — FOUND (Belum Ada Pengajuan, Pratinjau, bottom nav)
- frontend/src/pages/student/SubmissionForm.tsx — FOUND (Lanjutkan ke Jadwal, Pilih minimal satu gejala akademik.)
- frontend/src/pages/student/SubmissionForm.test.tsx — FOUND (6 tests)
- frontend/src/router.tsx — FOUND (StudentDashboard + SubmissionForm imported and wired)

**Acceptance criteria verified:**
- grep "FileResponse" views.py: 4 occurrences (PASS — >= 1)
- grep "PermissionDenied" views.py: 1 occurrence (PASS — >= 1)
- grep "MEDIA_URL" views.py: 2 occurrences (in comments only — no actual file serving via MEDIA_URL; PASS)
- grep "magic" serializers.py: 8+ occurrences (PASS — >= 1)
- grep "Lanjutkan ke Jadwal" SubmissionForm.tsx: 2 occurrences (PASS — >= 1)
- grep "Pilih minimal satu gejala akademik" SubmissionForm.tsx: 2 occurrences (PASS — >= 1)
- grep "/api/files/" PDFPreview.tsx: 3 occurrences (PASS — >= 1)
- grep "Belum Ada Pengajuan" StudentDashboard.tsx: 2 occurrences (PASS — >= 1)

## Self-Check: PASSED

All files present. All acceptance criteria verified.

## Next Phase Readiness

Ready for 01-05 (Lecturer review dashboard):
- GET /api/submissions/ endpoint available — needs filtering by adviser (not just student)
- Submission + SubmissionFile models are live and migrated
- /api/files/<uuid>/ protected serving already supports lecturer access (adviser ownership check)
- StatusBadge component handles all submission statuses
- Phase 2 approval flow reads submission.status and updates it

No blockers.

---
*Phase: 01-submission-triage-foundation*
*Completed: 2026-06-25*
