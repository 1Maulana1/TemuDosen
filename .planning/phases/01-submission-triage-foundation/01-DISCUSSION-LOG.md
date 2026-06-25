# Phase 1: Submission & Triage Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21
**Phase:** 1 — Submission & Triage Foundation
**Areas discussed:** Tech Stack (deferred), Auth & User Provisioning, PDF & File Storage
**Note:** Previous discussion (2026-06-15, PRD v1.0) covered Symptom Categories, Admin Config UI, Lecturer Review List, and PDF Handling — those decisions are still valid and carried forward in CONTEXT.md.

---

## Tech Stack

| Option | Description | Selected |
|--------|-------------|----------|
| Laravel (PHP) | Common in Indonesian university projects, Eloquent ORM, MySQL/PostgreSQL | |
| Next.js (TypeScript) | Full-stack React, Prisma ORM, strong for PWA + async queues | |
| Django (Python) | Batteries-included, DRF + React/Vue frontend | |
| We haven't decided yet | Defer based on team background/constraints | |

**User's choice:** Deferred — "skip this first and tell me again before go to another phase"
**Notes:** Must be decided before `/gsd-plan-phase 1`. Framework choice affects async pipeline (Phase 6 STT/LLM) and the session strategy already chosen (server-side sessions).

---

## Auth & User Provisioning

### Account creation method

| Option | Description | Selected |
|--------|-------------|----------|
| Admin creates all accounts manually | Admin registers students and lecturers via management panel | |
| Self-registration with campus email | Users register themselves with university email | ✓ |
| SSO / LDAP with campus system | Integrate with university identity provider | |

**User's choice:** Self-registration with campus email

---

### Role determination

| Option | Description | Selected |
|--------|-------------|----------|
| Email domain determines role | Domain suffix infers role (e.g., @mahasiswa vs @dosen) | |
| User selects role on signup, Admin approves | User picks role; Admin confirms before full access | ✓ |
| NIM/NIDN field determines role | Presence of NIM vs. NIDN field infers role | |

**User's choice:** User selects role on signup, Admin approves

---

### Session strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side sessions (cookie-based) | Session stored on server, browser holds session cookie | ✓ |
| JWT (stateless tokens) | Token issued on login, sent with each request | |

**User's choice:** Server-side sessions (cookie-based)

---

### Student–Lecturer relationship

| Option | Description | Selected |
|--------|-------------|----------|
| Student selects their lecturer during registration | Advisor dropdown on the signup form | ✓ |
| Admin assigns lecturer after account approval | Extra admin step before student can submit | |
| Student specifies lecturer on each submission | No permanent assignment | |

**User's choice:** Student selects their lecturer during registration
**Notes:** Dropdown should only show approved lecturer accounts.

---

### Email domain restriction

| Option | Description | Selected |
|--------|-------------|----------|
| Single domain for everyone | All users on same domain | |
| Split domains (student vs. staff) | Separate domains hint at role | |
| No domain restriction | Any email accepted | ✓ |

**User's choice:** No restriction — user did not know their university's email domain pattern
**Notes:** Admin approval is the sole gate for verifying role and identity.

---

### Student registration form fields

| Option | Description | Selected |
|--------|-------------|----------|
| NIM + Full name + Email + Password + Lecturer selection | Minimum needed | ✓ |
| NIM + Full name + Email + Password + Lecturer + Study program | Adds Prodi field for Kaprodi reporting | |

**User's choice:** NIM + Full name + Email + Password + Lecturer selection

---

### Lecturer registration form fields

| Option | Description | Selected |
|--------|-------------|----------|
| NIDN + Full name + Email + Password | Minimum needed | ✓ |
| NIDN + Full name + Email + Password + Study program | Adds Prodi field | |
| NIDN + Full name + Email + Password + Google Calendar OAuth | Calendar linked at registration | |

**User's choice:** NIDN + Full name + Email + Password
**Notes:** Google Calendar OAuth deferred to Phase 4.

---

### Post-registration state

| Option | Description | Selected |
|--------|-------------|----------|
| Account inactive — cannot log in | Login blocked until Admin approves | |
| Account active but access restricted | Can log in; sees pending-approval banner; can't act | ✓ |

**User's choice:** Account active but access restricted

---

### Admin & Kaprodi account creation

| Option | Description | Selected |
|--------|-------------|----------|
| Seeded in the database during deployment | Seed script creates initial Admin; Admin creates Kaprodi from panel | ✓ |
| Admin registers normally, then super-admin promotes | Requires direct DB access to bootstrap | |
| Registration with secret invite code | Anyone with code can register as Admin | |

**User's choice:** Seeded in the database during deployment

---

## PDF & File Storage

### Storage location

| Option | Description | Selected |
|--------|-------------|----------|
| Local filesystem (server disk) | Files in /storage/uploads on the server | ✓ |
| Self-hosted object storage (MinIO) | S3-compatible, more scalable for audio in Phase 5 | |
| Cloud object storage (S3, Supabase) | Cloud-hosted; conflicts with PRD privacy constraints on audio | |

**User's choice:** Local filesystem (server disk)

---

### Access control for files

| Option | Description | Selected |
|--------|-------------|----------|
| Serve files through app (access-controlled route) | Auth check before streaming file | |
| Public URL with hard-to-guess filename | UUID filename, no auth check on URL | ✓ |

**User's choice:** Public URL with hard-to-guess filename
**Notes:** ⚠ Conflicts with PRD constraint that file access is "restricted to the specific lecturer and student pair." Flagged in CONTEXT.md D-29 for planner to resolve.

---

### Encryption at rest

| Option | Description | Selected |
|--------|-------------|----------|
| Filesystem-level encryption (disk encryption) | LUKS or equivalent; satisfies PRD AES-256 requirement | ✓ |
| Per-file app-level encryption (AES-256 in app) | App encrypts each file before write, decrypts on serve | |

**User's choice:** Filesystem-level disk encryption

---

### Filename strategy

| Option | Description | Selected |
|--------|-------------|----------|
| UUID-based path (/storage/{uuid}.pdf) | Random UUID, mapped to submission in DB | ✓ |
| Structured path (/storage/{nim}/{year}/{id}.pdf) | Human-readable but leaks NIM in URL | |
| App-managed opaque ID | Never exposed in URLs | |

**User's choice:** UUID-based path

---

## Claude's Discretion

- PDF viewer implementation detail (iframe vs. embedded PDF.js) — choose for mobile PWA compatibility at 360px
- UI component library / design system — deferred to planner based on tech stack choice

## Deferred Ideas

- Tech stack selection (must decide before planning)
- Per-lecturer symptom weight overrides (Phase 2+)
- Bulk CSV import for admin symptom configuration (future)
- Google Calendar OAuth2 for Lecturer (Phase 4)
- Password reset flow (planner to include in Phase 1 auth scaffolding)
