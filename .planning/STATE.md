---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Phases 1-2 Verified; 3/4/8 code-complete (unverified); 5/7 partial; 6 not started
last_updated: "2026-07-03T00:00:00.000Z"
progress:
  total_phases: 8
  completed_phases: 2
  total_plans: 5
  completed_plans: 5
  percent: 25
---

# State: TemuDosen

## Project Reference

See `.planning/PROJECT.md` for core value, constraints, and full requirements.

**Core value**: Turn ephemeral guidance conversations into a permanent logbook — automated STT → AI summary → one-tap approval, while cutting student wait time from ~120 min to <30 min.

## Current Position

Phase: 02 (Approval & Queue Placement) — IMPLEMENTED & VERIFIED
**Status**: Phase 2 shipped in commit 55aefb3 and retroactively verified (see 02-VERIFICATION.md) — ready to execute Phase 3

**Phase 2 Goal**: A lecturer can act on a pending request, and approval turns it into a triage-estimated, queued guidance slot

**Phase 2 Success Criteria** (what must be TRUE):

1. Lecturer can Approve, or Reject/Request-Revision with notes the student can see — DONE (ApproveSubmissionView / RejectSubmissionView)
2. On approval, system calculates estimated duration from symptom + admin-configured weight — DONE (estimated_minutes = sum of symptom weights)
3. On approval, student placed in lecturer's queue with a queue number + fixed estimated schedule slot — DONE (_calculate_schedule + Session)

**Test evidence**: `backend/apps/bimbingan/tests/` — 32 tests, all passing.

**Caveat**: Phase 2 was implemented before a formal GSD plan loop, so no `02-*-PLAN.md` exists; `02-VERIFICATION.md` is the closing artifact. The same commit also landed Phase 3/4/8 code — those phases remain OPEN.

**Progress**: Phase 2 of 8 formally verified (25%); see Code-Ahead-of-Process Audit below for the real implementation state of Phases 3–8.
`[==........]`

## Code-Ahead-of-Process Audit (2026-07-03)

Two team branches (`main`, with Farel's Phase 2 UI/consent work, and a teammate's untracked local copy) were merged into `master` and reconciled this session. That surfaced a lot of code for phases the roadmap still labels "deferred" — none of it went through a formal GSD plan/verification loop, so treat the checkmarks below as **code-presence**, not UAT-verified, except where a phase already has a `*-VERIFICATION.md`.

| Phase | Real status | Evidence |
|---|---|---|
| 1. Submission & Triage Foundation | ✅ Complete, verified | `01-05-PLAN.md` chain, tests passing |
| 2. Approval & Queue Placement | ✅ Complete, verified | `02-VERIFICATION.md`, 32 tests |
| 3. Live Queue Management & Quota | 🟢 Code-complete, **not formally verified** | `CancelStudentQueueView`, `DOSEN_DAILY_QUOTA_MINUTES` check in `ApproveSubmissionView`, 30s poll in `StudentQueue.tsx` — all 3 success criteria have code, no `03-VERIFICATION.md` yet |
| 4. Google Calendar Sync & Graceful Degradation | 🟢 Code-complete, **now has test coverage** | `services/calendar.py` (check_free_busy/create/update/delete), async fire-and-forget creation (NFR-01), `CALENDAR_ERROR` SystemLog on failure; `test_calendar.py` (13 tests, added this session) |
| 5. Session Execution with Recording & Consent | 🟡 **Partial** | `ConsentModal` + `Session.consent_given_at/consent_by_dosen/consent_by_mahasiswa` + `ts1` ("Mulai & Rekam") + T-15 notification + 30-min auto-cancel (`scheduler.py`) all implemented. **Missing**: no `ts2` field, no "Selesai" action anywhere, and no actual audio capture (no `MediaRecorder`/`getUserMedia` in frontend) — "recording" today is a consent flag + a start timestamp, not an audio file |
| 6. STT, AI Summarization & Logbook | ❌ **Not started** | Zero hits for whisper/STT/transcript/LLM in the codebase; no summary field on `Session`. Blocked on Phase 5's missing audio capture regardless |
| 7. Advisory Continuity & Campus Logbook Integration | 🟡 **Partial** | `ActionItem` model (description + is_completed) + `KaprodiComplianceView` (compliance rate per dosen/mahasiswa) implemented. **Missing**: Sekawan/KPTI campus API sync and the CSV/PDF fallback export (LOGBOOK-01/02/03) — no such code exists |
| 8. Admin Emergency Controls & Kaprodi Reporting | 🟢 Code-complete, **not formally verified** | `AdminEmergencyCancelView`, `AdminLogs.tsx` + admin stats endpoint, `KaprodiExportView` (CSV + PDF via reportlab), `KaprodiComplianceView` all implemented |

**Bottom line**: the only phase with genuinely no work is **Phase 6**. Phases 3, 4, and 8 look done but lack formal verification artifacts. Phases 5 and 7 are real but incomplete — each is missing one specific, well-defined piece (audio capture / campus API sync).

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files | Completed |
|-------|------|----------|-------|-------|-----------|
| 01 | 01-01 Walking Skeleton | ~4h | 4 | 46 | 2026-06-25 |
| 01 | 01-02 Self-registration + approval gate | ~1.5h | 3 | 19 | 2026-06-25 |
| 01 | 01-03 SymptomCategory CRUD + admin weight config | ~1.5h | 3 | 12 | 2026-06-25 |
| 01 | 01-04 Submission form + PDF upload (student side) | ~3h | 3 | 19 | 2026-06-25 |
| 01 | 01-05 Lecturer review dashboard (REVIEW-01) | ~2h | 2 | 9 | 2026-06-25 |

## Accumulated Context

### Todos

- Requirements traceability table in REQUIREMENTS.md has phase numbers filled in as of 2026-06-21.
- Phase 1 context document (01-CONTEXT.md) was written against PRD v1.0 — review and update before starting Phase 1 plan.

### Decisions

- **2026-06-21**: PRD updated to v2.2. Core value shifted from queue management to documentation + advisory continuity. Roadmap expanded from 6 phases to 8. Phases 1–4 are structurally unchanged. Phase 5 revised to include recording + consent. Phases 6–7 are new (STT/AI pipeline; advisory continuity + campus logbook). Phase 8 expanded with advice-compliance reporting.
- **2026-07-03**: Merged a teammate's Phase 2 branch (`main`, consent flow + admin logs + resubmission + role-based login + UI redesign) into `master`, plus recovered two pieces of unmerged work (Google Calendar test suite, lecturer calendar-settings page) found in another teammate's untracked local copy. Auditing the merged result against the roadmap found Phases 3, 4, and 8 are essentially code-complete despite being labeled "deferred" — see Code-Ahead-of-Process Audit above. Phase 6 (STT/AI) remains the one phase with zero work.
- **2026-06-25**: Walking Skeleton (01-01) implemented. Auth strategy: Django server-side sessions + cookie (D-21). CustomUser: AbstractBaseUser + PermissionsMixin, USERNAME_FIELD=email. Tailwind v4 CSS @theme (no tailwind.config.js). React Router 7 createBrowserRouter + loaders. CSRF: GET /api/csrf/ on mount before render.
- **2026-06-25**: AbstractBaseUser chosen over AbstractUser — prevents username/first_name/last_name conflicts with NIM/NIDN. google_oauth_token added as JSONField(null=True) stub for Phase-4 forward-compat. Vite proxy /api→:8000 eliminates CORS+credentials complexity in dev.
- **2026-06-25**: Registration (01-02) — RejectUserView deactivates (is_active=False) rather than deletes for audit trail. RegisterView dispatches to StudentRegisterSerializer or LecturerRegisterSerializer by `role` field. LecturerListView is AllowAny (unauthenticated users need adviser dropdown before registering). validate_adviser_id checks role=lecturer AND is_approved=True server-side (Pitfall 7 guard even if client bypasses UI).
- **2026-06-25**: SymptomCategory (01-03) — SymptomCategoryViewSet.get_permissions() dispatches IsAdmin for write actions (create/update/partial_update/destroy/bulk_update) and IsApprovedUser for reads. Bulk-update validates all IDs exist before opening transaction (400 if any missing). Seed migration uses get_or_create so re-running migrate never overwrites admin edits (D-08). SymptomConfig S-10 tracks inline edits in local RowState[]; saves all via bulkUpdateSymptoms on "Simpan Semua Perubahan".
- **2026-06-25**: Submission + file serving (01-04) — validate_draft_file (size + magic bytes) runs BEFORE save_file — bad files never touch disk. serve_submission_file uses FileResponse + ownership check (student/adviser/admin/kaprodi), never MEDIA_URL (D-29). QueryDict.getlist('symptom_ids') extracts all repeated multipart keys. UserSerializer extended with nested AdviserSerializer so /me/ returns adviser info for S-07 adviser card (D-24). PDFPreview uses iframe src=/api/files/<uuid>/ — browser sends session cookie same-origin via Vite proxy.
- **2026-06-25**: Lecturer dashboard (01-05) — REVIEW-01 isolation: student__adviser=request.user at ORM level in get_queryset(). Dedicated /api/submissions/lecturer/ URL keeps IsLecturer permission separate from IsStudent. LecturerSubmissionSerializer.get_file_url() always returns /api/files/<uuid>/ (never MEDIA_URL — T-1-23 mitigation). No approve/reject in Phase 1 (D-12 — Phase 2 scope). SearchFilter on student__nim/student__full_name + DjangoFilterBackend for status + OrderingFilter for created_at (all parameterized via ORM — T-1-24 mitigation).

### Blockers

(None)

## Session Continuity

**Last updated**: 2026-07-03
**Next step**: Either (a) formally verify Phases 3/4/8 (write the `0N-VERIFICATION.md` closing artifacts — code is already there), or (b) start Phase 5's missing piece (audio capture + `ts2`/"Selesai") since it blocks Phase 6 entirely. Phase 6 (STT/AI Summarization) has zero work and is the true next greenfield phase once Phase 5 is closed out.
**Stopped at**: Phase 2 retroactively verified — added `apps/bimbingan/tests/` (32 passing) and `02-VERIFICATION.md`; updated STATE + ROADMAP. Since then (2026-07-03): merged Phase 2 UI/consent branch, recovered Google Calendar test suite + LecturerSettings page, fixed a stale test split (LecturerDashboard vs LecturerRequests), and ran a full code-vs-roadmap audit (see above).

**Out-of-sequence note (2026-07-02)**: At user request, `05-CONTEXT.md` was captured for Phase 5 (Session Execution with Recording & Consent) ahead of Phase 3/4 — exploratory only, no plan/execution yet. Roadmap execution order (Phase 3 next) is unchanged; Phase 5 is still deferred post-July-15 per the 2026-06-21 roadmap decision. Scout during discussion found SESSION-01, SESSION-05, SESSION-06 already fully implemented (same commit 55aefb3), and SESSION-03 partially implemented (`ts1` + status transition, no consent/recording yet). See `.planning/phases/05-session-execution-with-recording-consent/05-CONTEXT.md`.

### Known pre-existing issue (not Phase 2)

- `apps/submissions/tests/test_upload.py::test_missing_file_returns_400_with_exact_copy` fails: when `draft_file` is sent as `null` (not absent), DRF returns the `null` error code instead of the custom `required` copy. Fix = add a `'null'` key to `draft_file` error_messages in `apps/submissions/serializers.py`. Phase 1 / Person B area.
