# TemuDosen

## What This Is

TemuDosen is a web-based (responsive PWA) scheduling and triage system for academic/thesis guidance sessions ("bimbingan") between university students and their lecturers (dosen pembimbing). Students submit a guidance request describing their "academic symptoms" (issue type) plus a draft document; the system calculates an estimated session duration from those symptoms, places the student in a dynamically managed queue, and syncs the scheduled slot to Google Calendar for both parties. Lecturers approve requests, run sessions with Start/End buttons that log real durations and result notes, and the Head of Study Program (Kaprodi) gets a digital record of guidance activity for workload tracking and accreditation reporting.

## Core Value

Replace hours of physical hallway queuing with an accurate, triage-based time estimate and a dynamically managed queue — cutting average student waiting time from ~120 minutes to under 30.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Student submits a guidance request by selecting "Academic Symptoms" (dropdown) and uploading a draft PDF (max 5MB)
- [ ] System validates the submission (file presence/size + symptom form) and forwards it to the lecturer for review
- [ ] Lecturer can Approve, or Reject/Request-Revision with notes, a pending submission
- [ ] On Approval, system calculates an estimated guidance duration from weighted "Academic Symptoms" and places the student into the lecturer's queue with a fixed estimated schedule
- [ ] Student sees their queue number, estimated guidance time, and real-time status (Waiting / Your Turn / etc.)
- [ ] Student can self-cancel their queue slot before status becomes "Your Turn"
- [ ] System checks the lecturer's Google Calendar free/busy when building the schedule, and auto-creates/updates/deletes the calendar event (for both lecturer and student) on approval, cancellation, or rescheduling
- [ ] System notifies the student when their estimated turn is ~15 minutes away
- [ ] Lecturer presses "Start Session" / "End Session" to log real start/end timestamps; ending a session requires entering "Guidance Result Notes"
- [ ] System auto-cancels a student's queue slot if no "Start Session" occurs within 30 minutes of being called
- [ ] Lecturer selects Offline/Online for the session and, if Online, attaches an external meeting link (no in-app video conferencing)
- [ ] Admin configures per-"Symptom" duration weights at the start of each semester (drives the triage calculation)
- [ ] Admin can trigger an Emergency Cancel that clears a lecturer's remaining queue for the day (e.g. sudden absence)
- [ ] System enforces each lecturer's daily guidance-time quota, rejecting new submissions for a date once that quota would be exceeded
- [ ] If the Google Calendar integration fails or times out, the system keeps the queue/triage core working locally and logs the error to an Admin Dashboard (graceful degradation)

### Out of Scope

- Plagiarism checking (Turnitin/Grammarly) integration — separate concern from scheduling/triage, no MVP value
- Native/in-app video conferencing (Zoom/Meet) — MVP only stores an external meeting link/URL field
- Dedicated push-notification gateway — T-15 alerts ship via simpler in-app/email notification for MVP; native push infra deferred
- Multi-examiner thesis defense scheduling — different workflow (group scheduling vs. 1:1 advisor sessions), future milestone
- Native mobile apps (Android/iOS) — web-based responsive PWA (min 360px width) covers target devices for MVP

## Context

- **Domain**: Indonesian higher-education academic/thesis advising ("bimbingan akademik/skripsi"). Source material is an existing PRD ("TemuDosen — Information System Development 2025/2026", v1.0, 2026-05-28, author Maulana Shiddiq A.).
- **Actors**: Student/mahasiswa (PK: NIM), Lecturer/dosen pembimbing (PK: NIDN), Admin (prodi staff — configures symptom weights, handles Emergency Cancel, monitors error logs), Kaprodi (Head of Study Program — read-only monitoring/reporting for accreditation).
- **Current process being replaced**: students write their name on a paper sheet taped to the lecturer's office door and wait, with no time estimate and no digital record of sessions.
- **Repo layout**: this project directory (`gsd-new-project/`) is nested inside an outer git repo at `E:\Proyek S4`; planning commits track to that outer repo.

## Constraints

- **Platform**: Web-based responsive PWA; must work down to 360px width without horizontal scrolling — Native mobile excluded from MVP
- **Accessibility**: Queue status text must meet WCAG 2.1 Level AA color contrast
- **Integration**: Google Calendar API (OAuth2) for free/busy checks and event create/update/delete — core to the scheduling flow
- **Security**: Lecturer Google OAuth2 access/refresh tokens must be encrypted at rest with AES-256 or stronger
- **Performance**: Queue dashboard loads in <3s for 95% of requests under peak load (target: 500 concurrent users); Calendar API calls run async and must not block page load
- **Availability**: 99.5%+ monthly uptime, excluding scheduled maintenance
- **Reliability**: Google Calendar failures/timeouts (>4s) or token expiry must trigger graceful degradation — queue keeps working locally, errors logged to Admin Dashboard
- **Data model**: Student (NIM PK) can have at most one "Waiting" session at a time; Lecturer (NIDN PK) has a Daily Quota (minutes) that cannot be negative; Guidance Session has Start/End Timestamp, Status, Google Event ID, Calendar Sync Status, and status transitions are one-way (no reverting)
- **Assumptions**: students have smartphones + internet; lecturers reliably press Start/End at the actual moments guidance occurs (queue math depends on this)
- **Timeline**: Backend/triage API complete + unit-tested by Week 4; UAT begins Week 6 with 5 lecturers onboarded; staging sign-off and go-live by Week 8 (all NFRs validated)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Web-based responsive PWA, not native mobile | Faster to ship; 360px-responsive web covers target devices | — Pending |
| Triage via Admin-configured "Symptom" duration weights (not ML) for MVP | Simple to implement and tune per semester; ML-based prediction can be a later iteration once real duration data exists | — Pending |
| Google Calendar as the scheduling backbone | Leverages a tool lecturers/students already use; avoids building a custom calendar UI | — Pending |
| Graceful degradation on Calendar API failure | Keeps the core queue/triage loop usable even if the external integration breaks (NFR-41) | — Pending |
| T-15 notifications via in-app/email, not a push gateway | Satisfies FR-S03 without building push infrastructure in MVP; dedicated push gateway explicitly out of scope | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-12 after initialization*
