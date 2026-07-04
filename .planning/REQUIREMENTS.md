# Requirements: TemuDosen

**Defined:** 2026-06-12
**Updated:** 2026-07-05 (PRD v2.3 — in-app Jitsi video + dual-party audio capture promoted into Phase 6 scope)
**Core Value:** Turn ephemeral guidance conversations into a permanent logbook — automated STT → AI summary → one-tap approval, while cutting student wait time from ~120 min to <30 min.

## v1 Requirements

### Submission & Triage

- [x] **TRIAGE-01**: Student can submit a guidance request by selecting "Academic Symptoms" from a dropdown and uploading a draft PDF (max 5MB) — implemented in 01-04
- [x] **TRIAGE-02**: System validates the draft file and symptom form together on submit, rejecting incomplete submissions with a clear error — implemented in 01-04
- [ ] **TRIAGE-03**: System calculates an estimated guidance duration from weighted "Academic Symptoms" when the lecturer approves a request

### Lecturer Review

- [x] **REVIEW-01**: Lecturer can view pending guidance requests, including the student's stated symptoms and draft attachment — implemented in 01-05
- [ ] **REVIEW-02**: Lecturer can Approve a request, or Reject/Request-Revision with notes returned to the student

### Queue & Scheduling

- [ ] **QUEUE-01**: On approval, student is placed into the lecturer's queue with a queue number and a fixed estimated schedule
- [ ] **QUEUE-02**: Student can view real-time queue status (Waiting / Your Turn / etc.) and estimated guidance time
- [ ] **QUEUE-03**: Student can self-cancel their queue slot before status becomes "Your Turn"
- [ ] **QUEUE-04**: System enforces each lecturer's daily guidance-time quota, rejecting approvals that would push that day's total over the quota
- [ ] **QUEUE-05**: System checks the lecturer's Google Calendar free/busy and creates/updates/deletes a calendar event (for lecturer and student) on approval, cancellation, or reschedule
- [ ] **QUEUE-06**: If the Google Calendar integration fails, times out, or tokens expire, the queue keeps working on local data and the error is logged to the Admin Dashboard (graceful degradation)

### Session Execution (Updated v2.1 / v2.2)

- [ ] **SESSION-01**: Student receives a notification (in-app/email) when their estimated turn is ~15 minutes away
- [ ] **SESSION-02** *(revised)*: Before the session begins, an explicit recording consent prompt is shown; both parties must consent for recording to proceed; session can still run without recording if consent is declined
- [ ] **SESSION-03** *(revised)*: Lecturer presses a single "Mulai & Rekam" button that simultaneously records the session start timestamp (TS1) and begins audio recording
- [ ] **SESSION-04** *(revised)*: Lecturer presses "Selesai" to simultaneously stop recording and record the session end timestamp (TS2); manual result notes are optional (AI summary serves this role)
- [ ] **SESSION-05**: System auto-cancels a student's queue slot if "Mulai & Rekam" hasn't occurred within 30 minutes of being called
- [ ] **SESSION-06** *(superseded by VIDEO-01, Phase 6, PRD v2.3)*: Lecturer selects Offline/Online for the session; if Online, attaches an external meeting link — Phase 5 shipped this as-is; Phase 6 replaces the Online path with embedded Jitsi video (VIDEO-01) without reopening Phase 5

### STT & AI Summarization

- [ ] **STT-01**: System transcribes session audio to text via self-hosted STT (faster-whisper large-v3-turbo) asynchronously after session ends
- [ ] **STT-02**: Transcript is available for review within ≤2× audio duration for 90% of sessions; UI is not blocked during processing
- [ ] **STT-03**: System generates a structured AI summary (advice points + improvement notes) from the transcript via LLM API after transcript is ready
- [ ] **STT-04**: Lecturer can review, edit, and approve the AI-generated summary and advice items before they are committed to the logbook
- [ ] **STT-05**: Approved summary, transcript, and advice items are saved and linked to the session and the student
- [ ] **STT-06**: Student can view their approved transcript and summary after lecturer approval
- [ ] **STT-07**: If STT or LLM fails or times out, system provides a manual note editor as fallback and logs the failure to Admin Dashboard (graceful degradation)

### In-App Video Conferencing *(promoted from v2 Requirements, PRD v2.3 — folded into Phase 6)*

- [ ] **VIDEO-01** *(revised from v2 draft; was "Zoom/Meet")*: Online sessions run via in-app embedded video conferencing (Jitsi Meet External API) instead of an external meeting link. `meet.jit.si` is acceptable for MVP/demo; self-hosted/JaaS Jitsi is required before production (known limitation, tracked not blocking).
- [ ] **VIDEO-02** *(new)*: For online sessions, both parties' audio (lecturer local mic + student remote track) is mixed into a single recording via the Web Audio API, feeding the same `SessionRecording` → STT pipeline used for offline sessions. Highest-risk item in Phase 6 — plan must document a fallback (lecturer-mic-only recording) if the mixing approach proves infeasible before the deadline.

### Advisory Continuity

- [ ] **ADVICE-01**: Student can mark individual advice items as "addressed" (with optional note/evidence) before or when submitting the next session request
- [ ] **ADVICE-02**: Lecturer can view the complete advice history and follow-up status for each advisee student

### Campus Logbook Integration

- [ ] **LOGBOOK-01**: System syncs approved summaries to the campus logbook API (Sekawan/KPTI) when the API is available
- [ ] **LOGBOOK-02**: If campus API is unavailable, system provides CSV/PDF export of the summary as a manual-upload fallback
- [ ] **LOGBOOK-03**: If campus logbook API call fails or times out, summary remains saved internally, is queued for retry, and error is logged to Admin Dashboard (graceful degradation)

### Admin & Configuration

- [x] **ADMIN-01**: Admin configures per-"Symptom" duration weights at the start of each semester
- [ ] **ADMIN-02**: Admin can trigger an Emergency Cancel that clears a lecturer's remaining queue for the day
- [ ] **ADMIN-03**: Admin can view integration error logs (Google Calendar failures) on an Admin Dashboard
- [ ] **ADMIN-04** *(new)*: Admin configures campus logbook API credentials and integration settings (Sekawan/KPTI)
- [ ] **ADMIN-05** *(new)*: Admin can monitor STT/LLM service quota usage and review failure logs

### Reporting

- [ ] **REPORT-01**: Kaprodi can view digitized guidance history (timestamps, durations, symptoms, summaries) across all lecturers
- [ ] **REPORT-02**: Kaprodi can view each lecturer's workload summary (sessions completed, total time) for accreditation reporting
- [ ] **REPORT-03** *(new)*: Kaprodi can view advice follow-up compliance rates per lecturer/student

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Communication

- **NOTIF-01**: Dedicated native push-notification gateway (beyond in-app/email T-15 alerts)

### Academic Workflows

- **DEFENSE-01**: Scheduling for thesis defense exams involving multiple examiners simultaneously
- **PLAG-01**: Plagiarism-check integration (Turnitin/Grammarly) on uploaded drafts

### Platform

- **MOBILE-01**: Native mobile apps (Android/iOS)

### AI Enhancements

- **DIAR-01**: Speaker diarization — automatic separation of lecturer vs. student speech in transcript
- **SCORE-01**: AI-based quality scoring of guidance sessions

## Out of Scope

| Feature | Reason |
|---------|--------|
| Plagiarism checking (Turnitin/Grammarly) | Separate concern from scheduling/documentation |
| Native push-notification gateway | T-15 alerts ship via in-app/email for MVP |
| Multi-examiner thesis defense scheduling | Different workflow (group vs. 1:1 advisor sessions) |
| Native mobile apps (Android/iOS) | Responsive PWA (360px+) covers target devices |
| Speaker diarization | Merged transcript is sufficient for MVP; diarization is complex and error-prone |
| AI quality scoring of sessions | Out of scope per PRD v2.2 explicit exclusion |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TRIAGE-01 | Phase 1 | Complete (01-04) |
| TRIAGE-02 | Phase 1 | Complete (01-04) |
| TRIAGE-03 | Phase 2 | Pending |
| REVIEW-01 | Phase 1 | Complete (01-05) |
| REVIEW-02 | Phase 2 | Pending |
| QUEUE-01 | Phase 2 | Pending |
| QUEUE-02 | Phase 3 | Pending |
| QUEUE-03 | Phase 3 | Pending |
| QUEUE-04 | Phase 3 | Pending |
| QUEUE-05 | Phase 4 | Pending |
| QUEUE-06 | Phase 4 | Pending |
| SESSION-01 | Phase 5 | Pending |
| SESSION-02 | Phase 5 | Pending |
| SESSION-03 | Phase 5 | Pending |
| SESSION-04 | Phase 5 | Pending |
| SESSION-05 | Phase 5 | Pending |
| SESSION-06 | Phase 5 | Pending |
| STT-01 | Phase 6 | Pending |
| STT-02 | Phase 6 | Pending |
| STT-03 | Phase 6 | Pending |
| STT-04 | Phase 6 | Pending |
| STT-05 | Phase 6 | Pending |
| STT-06 | Phase 6 | Pending |
| STT-07 | Phase 6 | Pending |
| VIDEO-01 | Phase 6 | Pending |
| VIDEO-02 | Phase 6 | Pending |
| ADVICE-01 | Phase 7 | Pending |
| ADVICE-02 | Phase 7 | Pending |
| LOGBOOK-01 | Phase 7 | Pending |
| LOGBOOK-02 | Phase 7 | Pending |
| LOGBOOK-03 | Phase 7 | Pending |
| ADMIN-01 | Phase 1 | Complete |
| ADMIN-02 | Phase 8 | Pending |
| ADMIN-03 | Phase 4 | Pending |
| ADMIN-04 | Phase 7 | Pending |
| ADMIN-05 | Phase 6 | Pending |
| REPORT-01 | Phase 8 | Pending |
| REPORT-02 | Phase 8 | Pending |
| REPORT-03 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 38 total
- Mapped to phases: 38
- Unmapped: 0

---
*Requirements defined: 2026-06-12*
*Last updated: 2026-07-05 after PRD v2.3 revision (VIDEO-01 promoted from v2 to v1/Phase 6; VIDEO-02 added; SESSION-06 marked superseded)*
