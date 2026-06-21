# Phase 1: Submission & Triage Foundation - Context

**Gathered:** 2026-06-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the intake mechanism: **Student submission form** (symptoms dropdown + PDF upload) → **Admin triage configuration panel** (symptom weight table) → **Lecturer review list** (pending submissions visible with symptom + draft attachment). This foundation is what Phases 2–8 build queue estimation, scheduling, recording, and reporting on top of.

No approval or rejection actions in Phase 1 — lecturer can only *view* submissions. Approval flows are Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Symptom Categories
- **D-01:** Admin-defined per semester — not hardcoded in the application
- **D-02:** 6 default categories seeded at setup: Thesis methodology, Data analysis, Writing & structure, Literature review, Time management, Supervisor conflict
- **D-03:** Admin can add, edit, and delete symptom categories via the admin panel
- **D-04:** Duration weights are stored as absolute minutes (e.g., 30, 45, 60) — not relative weights
- **D-05:** Weights are global across all lecturers — no per-lecturer overrides in Phase 1

### Admin Symptom Configuration UI
- **D-06:** Inline-editable table layout (Symptom name | Duration in minutes)
- **D-07:** Single-page with Edit mode — click row to modify, save all changes at once
- **D-08:** Weights persist until Admin manually updates them (no auto-reset per semester)

### Lecturer Review List
- **D-09:** Displays all submission statuses: Pending, Rejected/Revision-Requested, Approved
- **D-10:** Columns: Student NIM, Student name, Symptom category, Submission status, Submitted date/time, File name + Preview button
- **D-11:** Filtering by status (tabs or dropdown), search by NIM or name, sort by submission date or symptom
- **D-12:** Phase 1 scope: view + PDF preview only. Approve/reject actions deferred to Phase 2.

### PDF Handling
- **D-13:** Max 5MB, PDF format only
- **D-14:** In-app preview via iframe/viewer when lecturer clicks "Preview"
- **D-15:** Student can view their own submissions (dashboard "My Submissions") with preview and download
- **D-16:** Split-pane layout (PDF left, notes/feedback right) — implement for student view in Phase 1; extend to lecturer feedback in Phase 2

### Auth & User Provisioning
- **D-17:** Self-registration — users sign up with campus email; no SSO or admin-created accounts for regular users
- **D-18:** Role is self-selected on the registration form (Student or Lecturer); Admin approves all new accounts before full access is granted
- **D-19:** No email domain restriction enforced by the app — admin approval is the sole gate for role verification
- **D-20:** After registration, accounts are **active but access-restricted** — user can log in but sees a "pending approval" banner and cannot submit or take any action until approved
- **D-21:** Session strategy: **server-side sessions with cookie-based auth** (not JWT)
- **D-22:** Student registration form collects: NIM, full name, email, password, **lecturer selection** (dropdown of registered and approved lecturers)
- **D-23:** Lecturer registration form collects: NIDN, full name, email, password
- **D-24:** **Student–Lecturer advising relationship is set at registration** — student picks their thesis advisor from the dropdown; Admin can reassign later
- **D-25:** **Admin and Kaprodi accounts are seeded during deployment** (e.g., via a database seed script with a default admin email + temporary password). Admin can then create or promote the Kaprodi account from the admin panel.

### File Storage
- **D-26:** Files stored on the **local filesystem** (server disk), e.g., `/storage/uploads/`
- **D-27:** Filenames use **UUID-based paths** (e.g., `/storage/{uuid}.pdf`) — no guessable filename, mapped to submission record in DB
- **D-28:** **Disk-level encryption** (e.g., LUKS on Linux) satisfies the PRD AES-256 at-rest requirement — no per-file app-level encryption
- **D-29 ⚠ RISK:** Files are served via direct URL with UUID filename (no server-side auth check on the file route). This conflicts with the PRD constraint that access is "restricted to the specific lecturer and student pair." **Planner should evaluate whether to serve files through an access-controlled app route instead** — the PRD's security requirement (NFR) points toward a protected route.

### Claude's Discretion
- PDF viewer implementation detail (iframe vs. embedded PDF.js) — choose whatever renders consistently on mobile PWA at 360px width
- Exact UI component library / design system — not specified; planner decides based on tech stack

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — Core value, constraints, key decisions, actor definitions (Student/NIM, Lecturer/NIDN, Admin, Kaprodi), security NFRs (AES-256, access control)
- `.planning/REQUIREMENTS.md` — Full 36 requirements (v1 + v2 deferred); Phase 1 requirements: TRIAGE-01, TRIAGE-02, REVIEW-01, ADMIN-01
- `.planning/ROADMAP.md` — 8-phase structure, Phase 1 goal, success criteria, and dependencies

### Security Constraints (from PROJECT.md)
- PRD constraint: OAuth2 tokens and audio recordings encrypted AES-256 at rest, access restricted to the specific lecturer and student pair
- NFR-08: Recording consent must be captured and stored before audio is recorded (Phase 5 concern, but data model must accommodate it)
- File access decision (D-29) is flagged as a potential security gap — planner should resolve

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — this is a greenfield project. No existing components, hooks, or utilities.

### Established Patterns
- None yet. Phase 1 establishes the baseline patterns for all subsequent phases.

### Integration Points
- Phase 2 reads the symptom weights set by Admin in Phase 1 to calculate estimated guidance duration on approval
- Phase 4 will need the lecturer's Google Calendar credentials — the data model established in Phase 1 (Lecturer entity) must have a field for storing OAuth2 tokens (can be null until Phase 4)

</code_context>

<specifics>
## Specific Ideas

- The lecturer dropdown on the student registration form should only show **approved** lecturer accounts (not pending ones)
- Admin approval queue should show both Student and Lecturer pending registrations in the same view (role column distinguishes them)
- "Supervisor conflict" is one of the 6 default symptom categories — this is a sensitive category; no special handling required in Phase 1 but planner should be aware

</specifics>

<deferred>
## Deferred Ideas

- **Tech stack — partially decided:** Backend is **Python (Django or FastAPI)** — confirmed. Frontend framework (Django templates+HTMX vs React vs Vue) is **deferred**; user will decide on project resume. **Do not start planning until frontend is chosen** — ask: "For the frontend: Django templates + HTMX, Django REST + React, or Django REST + Vue 3?"
- **Per-lecturer symptom weight overrides** — captured for Phase 2+ consideration
- **Bulk CSV import for admin symptom configuration** — noted for a future admin tools phase
- **Google Calendar OAuth2 connection flow for Lecturer** — deferred to Phase 4
- **Password reset flow** — not discussed; planner should include standard reset-by-email in Phase 1 auth scaffolding

</deferred>

---

*Phase: 1 — Submission & Triage Foundation*
*Context gathered: 2026-06-21*
