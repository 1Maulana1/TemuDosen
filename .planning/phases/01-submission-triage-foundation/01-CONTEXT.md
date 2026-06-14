# Phase 1 Context: Submission & Triage Foundation

**Date:** 2026-06-15  
**Phase:** 1 — Submission & Triage Foundation  
**Goal:** A student can submit a guidance request (symptoms + draft PDF) that is validated and visible to their lecturer, with the admin-configured symptom weights in place that later drive the triage calculation

## Domain

Phase 1 delivers the intake mechanism: **Student submission form** (symptoms dropdown + PDF upload) → **Admin triage configuration panel** (symptom weight table) → **Lecturer review list** (pending/rejected/approved submissions). This is the foundation that later phases build queue estimation and scheduling on top of.

## Locked Requirements (from ROADMAP.md)

- **TRIAGE-01**: Student can submit a guidance request by selecting "Academic Symptoms" from a dropdown and uploading a draft PDF (max 5MB)
- **TRIAGE-02**: System validates the draft file and symptom form together on submit, rejecting incomplete submissions with a clear error
- **ADMIN-01**: Admin can set/update a duration weight (in minutes) for each "Academic Symptom" category, and these weights persist for use in approval
- **REVIEW-01**: Lecturer can view a list of pending guidance requests, including the student's stated symptoms and draft attachment

## Implementation Decisions

### Symptom Categories
- **Decision**: Admin-defined per semester (not predefined in code)
- **Default set**: 6 categories provided during setup:
  1. Thesis methodology
  2. Data analysis
  3. Writing & structure
  4. Literature review
  5. Time management
  6. Supervisor conflict
- **Scope**: Phase 1 builds the admin UI to add/edit/delete categories. Lecturers see the dropdown in student submission form; students select from this list.

### Admin Symptom Configuration UI
- **Decision**: Inline-editable table (Symptom name | Duration in minutes)
- **Weight format**: Absolute minutes (e.g., 30, 45, 60), not relative weights
- **Scope**: Global for all lecturers (no per-lecturer overrides in Phase 1)
- **Persistence**: Admin saves the table once; weights persist until next semester or manual update
- **UI pattern**: Single page with Edit mode — click to modify row, save all changes at once

### Lecturer Review List
- **Decision**: Shows all submission statuses (Pending, Rejected/Revision-Requested, Approved)
- **Columns**:
  - Student NIM (unique ID)
  - Student name
  - Symptom (category selected)
  - Submission status (Pending / Rejected / Revision-Requested / Approved)
  - Submitted date/time
  - File name + Preview button
- **Navigation**:
  - Filter by status (tabs or dropdown)
  - Search by student NIM or name
  - Sort by submission date (oldest/newest) or symptom type
- **Lecturer interactions** (Phase 1 scope): View submission details, preview PDF. Approval/rejection flow deferred to Phase 2.

### PDF Handling
- **Student submission**: Max 5MB, PDF format only. Stored on server (database blob or file storage).
- **Lecturer access**: In-app preview (iframe/viewer) when clicking "Preview" in the review list
- **Student access**: Dashboard ("My Submissions") showing their own pending/rejected/approved submissions with preview and download
- **UI pattern** (forward-looking): Split-pane layout (PDF on left, notes/feedback on right) will be standard for lecturer + student review. Implement in Phase 1 for student view; extend to Phase 2 for lecturer feedback entry.

## Code Context & Reusable Assets

### Database / ORM
(To be scouted during research phase)

### Components
(To be scouted during research phase)

## Canonical References

- `.planning/PROJECT.md` — Project context (TemuDosen, academic guidance system)
- `.planning/REQUIREMENTS.md` — Full requirements list (21 total)
- `.planning/ROADMAP.md` — Phase structure (6 phases, dependencies, success criteria)

## Deferred Ideas

- Per-lecturer symptom weight overrides — captured for Phase 2+ consideration
- Bulk CSV import for admin symptoms — noted for future admin tools phase
- Real-time PDF full-text search in submissions — noted for future enhancements

---
*Context captured: 2026-06-15 | Next: `/gsd-plan-phase 1`*
