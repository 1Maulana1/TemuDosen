# TemuDosen

## What This Is

TemuDosen is a web-based (responsive PWA) platform for **documenting and sustaining continuity of academic/thesis guidance sessions** ("bimbingan"). It schedules sessions, records audio, transcribes via Speech-to-Text, generates AI summaries into a logbook, and tracks advice follow-up across sessions — so the content and continuity of guidance is captured, not just the calendar event. Lecturers tap one button to start recording, review and approve the AI-generated summary, and see per-student advice history at a glance. Students receive an official summary with a follow-up checklist after every session. Kaprodi gets data-driven evidence for accreditation.

## Core Value

Turn ephemeral guidance conversations into a permanent, searchable logbook — replacing scattered voice notes and manual logbook entry with an automated STT → AI summary → one-tap lecturer approval pipeline, while also cutting average student wait time from ~120 minutes to under 30.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Submission & Triage**
- [ ] Student submits a guidance request by selecting "Academic Symptoms" (dropdown) and uploading a draft PDF (max 5MB)
- [ ] System validates the submission (file presence/size + symptom form) and forwards it to the lecturer for review
- [ ] Lecturer can Approve, or Reject/Request-Revision with notes, a pending submission

**Queue & Scheduling**
- [ ] On Approval, system calculates estimated guidance duration from weighted symptoms and places the student in the lecturer's queue with a fixed estimated schedule
- [ ] Student sees queue number, estimated guidance time, and real-time status (Waiting / Your Turn / etc.)
- [ ] Student can self-cancel their queue slot before status becomes "Your Turn"
- [ ] System checks the lecturer's Google Calendar free/busy when building the schedule, and auto-creates/updates/deletes the calendar event on approval, cancellation, or rescheduling
- [ ] System notifies the student when their estimated turn is ~15 minutes away

**Session Execution with Recording**
- [ ] Explicit recording consent prompt shown to student and lecturer before session starts
- [ ] Lecturer presses single "Mulai & Rekam" button to simultaneously log session start timestamp (TS1) and begin audio recording
- [ ] Lecturer presses "Selesai" to simultaneously stop recording and log session end timestamp (TS2); manual notes are optional
- [ ] System auto-cancels a student's queue slot if no "Mulai & Rekam" occurs within 30 minutes of being called
- [ ] Lecturer selects Offline/Online for the session; if Online, the session runs via in-app embedded video conferencing *(revised in v2.3 — see below; was "attaches an external meeting link")*

**STT, AI Summarization & Logbook**
- [ ] System transcribes recorded session audio to text via self-hosted STT (faster-whisper large-v3-turbo), near-real-time asynchronous
- [ ] System generates a structured AI summary (advice points + improvement notes) from the transcript via LLM API (Gemini Flash / GPT-mini / Claude Haiku tier)
- [ ] Lecturer can review, edit, and approve the AI-generated summary and advice items before they are committed to the logbook
- [ ] Approved summary and advice items are stored, linked to the session and the student
- [ ] Student can view their approved transcript and session summary after each session
- [ ] If STT or LLM fails/times out, system provides a manual note editor and marks a log entry (graceful degradation)
- [ ] *(new in v2.3)* Online sessions embed in-app video via Jitsi (VideoProvider abstraction); both parties' audio (local + remote) is mixed into a single recording so the STT pipeline receives complete audio regardless of session mode

**Advisory Continuity**
- [ ] Student can mark individual advice items as "addressed" with a note/evidence before or during the next session request
- [ ] Lecturer can view the full advice history and follow-up status for each advisee student

**Campus Logbook Integration**
- [ ] System syncs approved summaries to the campus logbook system (Sekawan/KPTI) via API when available
- [ ] If campus API is unavailable, system exports summary as CSV/PDF for manual upload (fallback)

**Admin & Configuration**
- [ ] Admin configures per-"Symptom" duration weights at the start of each semester
- [ ] Admin can trigger an Emergency Cancel that clears a lecturer's remaining queue for the day
- [ ] Admin can view integration error logs (Google Calendar, STT/LLM, campus logbook) on an Admin Dashboard
- [ ] Admin configures campus logbook API credentials and integration settings
- [ ] Admin monitors STT/LLM service quota and failure logs

**Reporting**
- [ ] Kaprodi can view digitized guidance history (timestamps, durations, symptoms, summaries) across all lecturers
- [ ] Kaprodi can view each lecturer's workload (sessions completed, total time) for accreditation reporting
- [ ] Kaprodi can view advice follow-up compliance per lecturer/student

### Out of Scope

- Plagiarism checking (Turnitin/Grammarly) integration
- Native mobile apps (Android/iOS) — web-based responsive PWA (min 360px width)
- Multi-examiner thesis defense scheduling
- Speaker diarization (separating lecturer vs. student voices) — transcript is merged text
- Automated quality scoring of guidance by AI

### Deferred to Post July 15 (Phases 4–8)

- Google Calendar sync (Phase 4)
- Session recording with consent and "Mulai & Rekam" button (Phase 5)
- STT transcription, AI logbook summarization, and in-app Jitsi video for online sessions (Phase 6, video scope expanded in v2.3)
- Advisory continuity and campus logbook sync (Phase 7)
- Admin emergency controls and Kaprodi reporting (Phase 8)

## Context

- **Domain**: Indonesian higher-education academic/thesis advising ("bimbingan akademik/skripsi"). PRD v2.3, July 2026, Kelompok 1.
- **Actors**: Student/mahasiswa (PK: NIM), Lecturer/dosen pembimbing (PK: NIDN), Admin (prodi staff), Kaprodi (Head of Study Program — read-only monitoring/reporting).
- **Current process being replaced**: students write their name on paper at the lecturer's door, wait without a time estimate, and have no official record of what was discussed.
- **PRD revision trigger**: Lecturer review session (15 June 2026) challenged the v1 proposition — "just scheduling is no better than Google Calendar." Core value shifted to documentation and advisory continuity.
- **Repo layout**: this project directory (`TemuDosen/`) is nested inside an outer git repo at `E:\Proyek S4`.

## Constraints

- **Platform**: Web-based responsive PWA; must work down to 360px width — Native mobile excluded
- **Accessibility**: Queue status text must meet WCAG 2.1 Level AA color contrast
- **Recording UI**: "Mulai & Rekam" and "Selesai" buttons must be large and reachable at 360px
- **Integration**: Google Calendar API (OAuth2) for free/busy and event management; campus logbook API (Sekawan/KPTI) for logbook sync when available
- **Security**: OAuth2 tokens encrypted at rest AES-256; audio recordings and transcripts stored encrypted AES-256, access restricted to the specific lecturer and student pair
- **Performance**: Queue dashboard <3s at 95th percentile (500 concurrent users); STT processing ≤2× audio duration for 90% of sessions (async, does not block UI)
- **Availability**: 99.5%+ monthly uptime excluding scheduled maintenance
- **Reliability**: Google Calendar, STT/LLM, and campus logbook failures each have independent graceful degradation — core queue always works, errors logged to Admin Dashboard
- **Consent**: Recording consent must be captured and stored before audio is recorded (NFR-08)
- **STT stack**: faster-whisper large-v3-turbo self-hosted (audio stays on-server); LLM via API tier (only transcript text leaves server)
- **Cost**: STT and LLM processing is async-queued; LLM API usage bounded to budget
- **Data model**: Student ≤1 "Waiting" session at a time; Lecturer daily quota cannot go negative; Session status transitions are one-way; one active Transcript per session; Advice item status only advances
- **Video** *(new in v2.3)*: Online sessions run through a `VideoProvider` abstraction; Jitsi (Jitsi Meet External API) is the first/only implementation. `meet.jit.si` (public, hosted) is acceptable for MVP/demo only — self-hosted or JaaS Jitsi is required before production use

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Hybrid STT/LLM: self-host STT, cloud LLM API | Audio (most sensitive) stays on-server via faster-whisper; only transcript text sent to LLM API — balances privacy, cost, and build speed | Adopted in v2.2 |
| Human-in-the-loop for AI summaries | STT WER on informal speech is non-trivial; mandatory lecturer approval before logbook entry prevents incorrect data | Adopted in v2.2 |
| "Mulai & Rekam" as a single button | Reduces friction to near-zero: sit down, click once, done. Separate Record button was a UX problem | Adopted in v2.1 |
| Manual notes optional when AI summary is available | Removes the friction of forced manual entry when AI has already produced a draft | Adopted in v2.1 |
| Campus logbook integration as Should-have with CSV/PDF fallback | Campus API (Sekawan/KPTI) may not be available in project timeline; layered adapter + fallback export ensures demo works without external dependency | Adopted in v2.2 |
| Web-based responsive PWA, not native mobile | Faster to ship; 360px-responsive web covers target devices for MVP | Adopted in v1.0 |
| Admin-configured symptom weights (not ML) for triage | Simple to tune per semester; ML iteration can follow once real duration data exists | Adopted in v1.0 |
| Google Calendar as scheduling backbone | Lecturers/students already use it; avoids building a custom calendar UI | Adopted in v1.0 |
| In-app video conferencing via Jitsi (`VideoProvider` abstraction), reversing the v2.2 "external link only" non-goal | Online sessions need embedded video so both parties' audio can be captured in one recording for STT; Jitsi Meet External API needs no new backend infra to embed | Adopted in v2.3 |
| `meet.jit.si` (public instance) accepted for MVP/demo only | No SLA/security guarantees for production student-counseling sessions on the public instance; self-host or JaaS required before go-live | Adopted in v2.3 — revisit before production |

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
*Last updated: 2026-07-05 after PRD v2.3 revision (in-app video conferencing via Jitsi folded into Phase 6 scope, replacing the v2.2 external-meeting-link-only non-goal)*
