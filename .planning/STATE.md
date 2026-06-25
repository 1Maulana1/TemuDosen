---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Executing Phase 01
last_updated: "2026-06-25T13:30:00.000Z"
progress:
  total_phases: 8
  completed_phases: 0
  total_plans: 5
  completed_plans: 3
  percent: 12
---

# State: TemuDosen

## Project Reference

See `.planning/PROJECT.md` for core value, constraints, and full requirements.

**Core value**: Turn ephemeral guidance conversations into a permanent logbook — automated STT → AI summary → one-tap approval, while cutting student wait time from ~120 min to <30 min.

## Current Position

Phase: 01 (Submission & Triage Foundation) — EXECUTING
Plan: 4 of 5 — NEXT (01-04 Submission form + PDF upload)
**Phase**: 1 - Submission & Triage Foundation
**Plan**: 01-04 Submission form + PDF upload (student side)
**Status**: Ready to execute

**Phase 1 Goal**: A student can submit a guidance request (symptoms + draft PDF) that is validated and visible to their lecturer, with the admin-configured symptom weights in place that later drive the triage calculation

**Phase 1 Success Criteria** (what must be TRUE):

1. Student can select an "Academic Symptom" from a dropdown and upload a draft PDF (max 5MB) to submit a guidance request
2. A submission missing the file or symptom selection is rejected with a clear, specific error instead of being silently accepted
3. Admin can set/update a duration weight (in minutes) for each "Academic Symptom" category, and these weights persist for use in approval
4. Lecturer can view a list of pending guidance requests, each showing the student's stated symptom and a link/preview to the draft attachment

**Progress**: Phase 1 of 8 (12% complete — 3/5 plans done)
`[===.......]`

## Performance Metrics

| Phase | Plan | Duration | Tasks | Files | Completed |
|-------|------|----------|-------|-------|-----------|
| 01 | 01-01 Walking Skeleton | ~4h | 4 | 46 | 2026-06-25 |
| 01 | 01-02 Self-registration + approval gate | ~1.5h | 3 | 19 | 2026-06-25 |
| 01 | 01-03 SymptomCategory CRUD + admin weight config | ~1.5h | 3 | 12 | 2026-06-25 |

## Accumulated Context

### Todos

- Requirements traceability table in REQUIREMENTS.md has phase numbers filled in as of 2026-06-21.
- Phase 1 context document (01-CONTEXT.md) was written against PRD v1.0 — review and update before starting Phase 1 plan.

### Decisions

- **2026-06-21**: PRD updated to v2.2. Core value shifted from queue management to documentation + advisory continuity. Roadmap expanded from 6 phases to 8. Phases 1–4 are structurally unchanged. Phase 5 revised to include recording + consent. Phases 6–7 are new (STT/AI pipeline; advisory continuity + campus logbook). Phase 8 expanded with advice-compliance reporting.
- **2026-06-25**: Walking Skeleton (01-01) implemented. Auth strategy: Django server-side sessions + cookie (D-21). CustomUser: AbstractBaseUser + PermissionsMixin, USERNAME_FIELD=email. Tailwind v4 CSS @theme (no tailwind.config.js). React Router 7 createBrowserRouter + loaders. CSRF: GET /api/csrf/ on mount before render.
- **2026-06-25**: AbstractBaseUser chosen over AbstractUser — prevents username/first_name/last_name conflicts with NIM/NIDN. google_oauth_token added as JSONField(null=True) stub for Phase-4 forward-compat. Vite proxy /api→:8000 eliminates CORS+credentials complexity in dev.
- **2026-06-25**: Registration (01-02) — RejectUserView deactivates (is_active=False) rather than deletes for audit trail. RegisterView dispatches to StudentRegisterSerializer or LecturerRegisterSerializer by `role` field. LecturerListView is AllowAny (unauthenticated users need adviser dropdown before registering). validate_adviser_id checks role=lecturer AND is_approved=True server-side (Pitfall 7 guard even if client bypasses UI).
- **2026-06-25**: SymptomCategory (01-03) — SymptomCategoryViewSet.get_permissions() dispatches IsAdmin for write actions (create/update/partial_update/destroy/bulk_update) and IsApprovedUser for reads. Bulk-update validates all IDs exist before opening transaction (400 if any missing). Seed migration uses get_or_create so re-running migrate never overwrites admin edits (D-08). SymptomConfig S-10 tracks inline edits in local RowState[]; saves all via bulkUpdateSymptoms on "Simpan Semua Perubahan".

### Blockers

(None)

## Session Continuity

**Last updated**: 2026-06-25
**Next step**: Execute plan 01-04 — Student submission form (symptom selection + PDF upload, max 5MB)
**Stopped at**: Plan 01-03 COMPLETE (checkpoint auto-approved; SUMMARY written)
