# Requirements: TemuDosen

**Defined:** 2026-06-12
**Core Value:** Replace hours of physical hallway queuing with an accurate, triage-based time estimate and a dynamically managed queue — cutting average student waiting time from ~120 minutes to under 30.

## v1 Requirements

### Submission & Triage

- [ ] **TRIAGE-01**: Student can submit a guidance request by selecting "Academic Symptoms" from a dropdown and uploading a draft PDF (max 5MB)
- [ ] **TRIAGE-02**: System validates the draft file and symptom form together on submit, rejecting incomplete submissions with a clear error
- [ ] **TRIAGE-03**: System calculates an estimated guidance duration from weighted "Academic Symptoms" when the lecturer approves a request

### Lecturer Review

- [ ] **REVIEW-01**: Lecturer can view pending guidance requests, including the student's stated symptoms and draft attachment
- [ ] **REVIEW-02**: Lecturer can Approve a request, or Reject/Request-Revision with notes returned to the student

### Queue & Scheduling

- [ ] **QUEUE-01**: On approval, student is placed into the lecturer's queue with a queue number and a fixed estimated schedule
- [ ] **QUEUE-02**: Student can view real-time queue status (Waiting / Your Turn / etc.) and estimated guidance time
- [ ] **QUEUE-03**: Student can self-cancel their queue slot before status becomes "Your Turn"
- [ ] **QUEUE-04**: System enforces each lecturer's daily guidance-time quota, rejecting approvals that would push that day's total over the quota
- [ ] **QUEUE-05**: System checks the lecturer's Google Calendar free/busy and creates/updates/deletes a calendar event (for lecturer and student) on approval, cancellation, or reschedule
- [ ] **QUEUE-06**: If the Google Calendar integration fails, times out, or tokens expire, the queue keeps working on local data and the error is logged to the Admin Dashboard (graceful degradation)

### Session Execution

- [ ] **SESSION-01**: Student receives a notification (in-app/email) when their estimated turn is ~15 minutes away
- [ ] **SESSION-02**: Lecturer presses "Start Session" to record the actual session start timestamp
- [ ] **SESSION-03**: Lecturer presses "End Session" and must enter "Guidance Result Notes" to record the end timestamp
- [ ] **SESSION-04**: System auto-cancels a student's queue slot if "Start Session" hasn't occurred within 30 minutes of being called
- [ ] **SESSION-05**: Lecturer selects Offline/Online for the session and, if Online, attaches an external meeting link

### Admin & Configuration

- [ ] **ADMIN-01**: Admin configures per-"Symptom" duration weights at the start of each semester
- [ ] **ADMIN-02**: Admin can trigger an Emergency Cancel that clears a lecturer's remaining queue for the day
- [ ] **ADMIN-03**: Admin can view integration error logs (e.g. Google Calendar failures) on an Admin Dashboard

### Reporting

- [ ] **REPORT-01**: Kaprodi can view digitized guidance history (timestamps, durations, symptoms, notes) across all lecturers
- [ ] **REPORT-02**: Kaprodi can view each lecturer's workload (sessions completed, time spent) for accreditation reporting

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Communication

- **VIDEO-01**: In-app/native video conferencing integration (Zoom/Meet) instead of an external link field
- **NOTIF-01**: Dedicated native push-notification gateway (beyond in-app/email T-15 alerts)

### Academic Workflows

- **DEFENSE-01**: Scheduling for thesis defense exams involving multiple examiners simultaneously
- **PLAG-01**: Plagiarism-check integration (Turnitin/Grammarly) on uploaded drafts

### Platform

- **MOBILE-01**: Native mobile apps (Android/iOS)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Plagiarism checking (Turnitin/Grammarly) | Separate concern from scheduling/triage; no MVP value |
| In-app/native video conferencing | MVP only needs an external meeting link/URL field |
| Native push-notification gateway | T-15 alerts ship via in-app/email for MVP |
| Multi-examiner thesis defense scheduling | Different workflow (group vs. 1:1 advisor sessions) |
| Native mobile apps (Android/iOS) | Responsive PWA (360px+) covers target devices for MVP |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRIAGE-01 | TBD | Pending |
| TRIAGE-02 | TBD | Pending |
| TRIAGE-03 | TBD | Pending |
| REVIEW-01 | TBD | Pending |
| REVIEW-02 | TBD | Pending |
| QUEUE-01 | TBD | Pending |
| QUEUE-02 | TBD | Pending |
| QUEUE-03 | TBD | Pending |
| QUEUE-04 | TBD | Pending |
| QUEUE-05 | TBD | Pending |
| QUEUE-06 | TBD | Pending |
| SESSION-01 | TBD | Pending |
| SESSION-02 | TBD | Pending |
| SESSION-03 | TBD | Pending |
| SESSION-04 | TBD | Pending |
| SESSION-05 | TBD | Pending |
| ADMIN-01 | TBD | Pending |
| ADMIN-02 | TBD | Pending |
| ADMIN-03 | TBD | Pending |
| REPORT-01 | TBD | Pending |
| REPORT-02 | TBD | Pending |

**Coverage:**
- v1 requirements: 21 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 21 ⚠️ (will be resolved by roadmap creation)

---
*Requirements defined: 2026-06-12*
*Last updated: 2026-06-12 after initial definition*
