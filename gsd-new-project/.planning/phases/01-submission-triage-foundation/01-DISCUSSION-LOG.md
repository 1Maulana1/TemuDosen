# Phase 1 Discussion Log

**Phase:** 01 — Submission & Triage Foundation  
**Date:** 2026-06-15  
**Facilitator:** Claude (GSD discuss-phase workflow)

## Discussion Summary

User selected all four gray areas for deep discussion: Symptom Categories, Admin Config UI, Lecturer Review List, PDF Handling.

## Area 1: Symptom Categories

| Question | Options | User Selection | Notes |
|----------|---------|-----------------|-------|
| Fixed vs admin-defined? | Fixed by you / Admin-defined | Admin-defined | Flexibility to adjust symptom categories per semester |
| How many categories? | ~5-6 / Broader taxonomy | ~5-6 categories | Keeps the list manageable |
| Which categories? | Academic-focused (my suggestion) / Other | Academic-focused | Agreed: Thesis methodology, Data analysis, Writing & structure, Literature review, Time management, Supervisor conflict |

**Decision**: Admin-defined symptom categories (default 6) with UI in Phase 1 to add/edit/delete.

## Area 2: Admin Symptom Configuration UI

| Question | Options | User Selection | Notes |
|----------|---------|-----------------|-------|
| How input weights? | Inline editable table / Modal per symptom | Inline editable table | Simpler, faster bulk editing |
| Absolute or relative? | Minutes (absolute) / Relative weights | Minutes (absolute) | Clearer for admin, easier for queue calculation |
| Global or per-lecturer? | Global weights / Per-lecturer weights | Global weights | Consistency across program; per-lecturer deferred |

**Decision**: Inline-editable table, absolute minutes, global for all lecturers. Save once; weights persist per semester.

## Area 3: Lecturer Review List

| Question | Options | User Selection | Notes |
|----------|---------|-----------------|-------|
| Which statuses? | Pending only / + Rejected & Revisions / + Approved | All statuses | Full audit trail for lecturer reference |
| Which columns? | Minimal / + Name & Status / + File & Preview | All columns (NIM, Name, Symptom, Status, Date, File) | Rich context for lecturer decision-making |
| Filter/search/sort? | Status filter / Search by student / Sort options | All navigation options | Full list management |

**Decision**: Show all statuses (Pending, Rejected, Approved). Columns: NIM, Name, Symptom, Status, Date, File. Support status filter, student search, and sort by date/symptom.

## Area 4: PDF Handling

| Question | Options | User Selection | Notes |
|----------|---------|-----------------|-------|
| Lecturer PDF view? | In-app preview / Download only | In-app preview | Integrated workflow |
| Student PDF view? | Student dashboard / Notifications only | Student dashboard with split-pane | User provided design guidance: split layout (PDF + notes) for review |
| PDF storage? | Server storage / Cloud storage | Server storage | Simpler for MVP, no external cloud dependency |

**Decision**: In-app preview for both. Student "My Submissions" dashboard. Split-pane UI (PDF left, notes right) as standard pattern. Server-side storage. Forward-looking design for Phase 2.

## Deferred Ideas

- **Per-lecturer symptom weight overrides** — Noted for Phase 2+ consideration (admin complexity vs. benefit trade-off)
- **Bulk CSV import** — Future admin tools enhancement
- **Full-text PDF search** — Future phase

## Canonical References Added

- `.planning/PROJECT.md` — TemuDosen project context
- `.planning/REQUIREMENTS.md` — Requirements (21 total, TRIAGE-01/02, ADMIN-01, REVIEW-01 in Phase 1)
- `.planning/ROADMAP.md` — 6-phase structure

---
*Discussion completed: 2026-06-15*  
*Next step: `/gsd-plan-phase 1`*
