---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
last_updated: "2026-06-12T01:52:10.315Z"
---

# State: TemuDosen

## Project Reference

See `.planning/PROJECT.md` for core value, constraints, and full requirements.

**Core value**: Replace hours of physical hallway queuing with an accurate, triage-based time estimate and a dynamically managed queue — cutting average student waiting time from ~120 minutes to under 30.

## Current Position

**Phase**: 1 - Submission & Triage Foundation
**Plan**: TBD
**Status**: Not started

**Phase 1 Goal**: A student can submit a guidance request (symptoms + draft PDF) that is validated and visible to their lecturer, with the admin-configured symptom weights in place that later drive the triage calculation

**Phase 1 Success Criteria** (what must be TRUE):

1. Student can select an "Academic Symptom" from a dropdown and upload a draft PDF (max 5MB) to submit a guidance request
2. A submission missing the file or symptom selection is rejected with a clear, specific error instead of being silently accepted
3. Admin can set/update a duration weight (in minutes) for each "Academic Symptom" category, and these weights persist for use in approval
4. Lecturer can view a list of pending guidance requests, each showing the student's stated symptom and a link/preview to the draft attachment

**Progress**: Phase 1 of 6 (0% complete)
`[..........]`

## Accumulated Context

### Todos

- Requirements traceability table in REQUIREMENTS.md still needs phase numbers filled in (currently TBD) — do this before/during Phase 1 planning.

### Decisions

(None yet)

### Blockers

(None)

## Session Continuity

**Last updated**: 2026-06-12
**Next step**: `/gsd-plan-phase 1`
