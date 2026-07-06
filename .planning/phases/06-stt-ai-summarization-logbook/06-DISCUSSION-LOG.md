# Phase 6: STT, AI Summarization & Logbook - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-05
**Phase:** 6-STT, AI Summarization & Logbook
**Areas discussed:** STT engine, in-app video (Jitsi) scope, async job architecture, LLM summarization, storage model, fallback/timeout, quota monitoring

---

## STT Engine (STT-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Self-hosted faster-whisper large-v3-turbo | Matches locked PROJECT.md v2.2 decision; audio never leaves the server | ✓ |
| OpenAI Whisper API | Easier/more accurate, but paid and sends student-counseling audio to a third party — reverses the locked privacy decision | |

**User's choice:** Self-hosted faster-whisper (recommended option).
**Notes:** Claude flagged that PROJECT.md v2.2 already adopted "Hybrid STT/LLM: self-host STT, cloud LLM API" — switching to a third-party STT API would have silently reversed that. User confirmed keeping it.

---

## In-App Video Conferencing Scope (Jitsi)

| Option | Description | Selected |
|--------|-------------|----------|
| Defer entirely | Keep Phase 6 to pure STT/LLM/logbook; note Jitsi as a future-phase idea | |
| Real scope change — amend PROJECT.md, separate phase | Bump PROJECT.md to v2.3, insert a new phase for Jitsi + dual-audio capture, separate from Phase 6 | |
| Bundle into Phase 6 directly | Add Jitsi + dual-audio capture as in-scope work inside Phase 6 | ✓ |

**User's choice:** Bundle into Phase 6 — but only after amending the charter first (PROJECT.md v2.2 → v2.3), per the user's explicit "audit-first" discipline: don't add a feature the charter forbids without updating the charter.
**Notes:** Claude found that PROJECT.md v2.2 explicitly listed "Native/in-app video conferencing" as a non-goal, and that REQUIREMENTS.md already had a dormant v2/deferred **VIDEO-01** ("In-app/native video conferencing integration (Zoom/Meet)") that matched this exactly. Claude also flagged that no "PRD v2.3" or `VideoProvider`/`Daily.co` code exists anywhere in the repo, despite the user's phrasing implying prior art — user did not have an external doc to share; treated as a fresh design.

Charter amendment performed in this session:
- `PROJECT.md`: non-goal removed, Active requirements updated, two new Key Decisions rows added (Jitsi/VideoProvider adoption; `meet.jit.si`-not-for-prod caveat), version bumped v2.2 → v2.3.
- `REQUIREMENTS.md`: VIDEO-01 promoted from v2/deferred to v1/Phase 6 (revised to reference Jitsi, not Zoom/Meet); new VIDEO-02 added for dual-party audio capture; Out of Scope table and Traceability table updated; SESSION-06 annotated as superseded-not-reopened (Phase 5 stays closed).
- `ROADMAP.md`: Phase 6 goal, requirements list, and success criteria (added #7, #8) updated.

## Async Job Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing APScheduler pattern | No new infra; matches scheduler.py's existing style | |
| Introduce Celery + broker | New infra (Redis/RabbitMQ + worker process); better suited to longer-running, retryable jobs | ✓ |

**User's choice:** Introduce Celery + broker.
**Notes:** Claude flagged that zero Celery/broker infrastructure exists anywhere in this codebase today — every existing background job runs on APScheduler with no separate worker process. User accepted this as new, first-class infrastructure scope for Phase 6 rather than reverting to APScheduler.

---

## LLM Summarization, Storage, Fallback, Monitoring

These areas were provided directly by the user as structured decisions (not run through individual AskUserQuestion turns) and captured as-is in CONTEXT.md `<decisions>`, with unresolved brackets carried into the Open Questions list:

- LLM: Claude API, structured JSON (`advice_points[]` + `improvement_notes[]`); exact model + API key provisioning left open.
- Storage: new `SessionLogbook` model (not fields on `Session`); `source_mode` field added given online sessions now exist.
- Timeout: 2× audio duration, minimum 5 minutes (given as an example — not yet reconfirmed as final).
- Retry policy on failure: retry-once vs straight-to-manual left open.
- Quota monitoring: job counts + failure logs via existing `SystemLog` model; token/cost estimate display method left open.
- Dual-party audio capture (mix local + remote via Web Audio API, with mic-only fallback) flagged by the user as the single highest-risk item in this phase.

## Claude's Discretion

- Exact JSON schema fields beyond `advice_points[]` / `improvement_notes[]`.
- Retry backoff implementation details (once retry policy is confirmed).
- Admin Dashboard layout for job counts / failure filters.
- `SessionLogbook.status` transitional-state granularity within the agreed state machine.

## Deferred Ideas

- Production-grade Jitsi hosting (self-hosted/JaaS) — explicitly deferred past MVP/demo, tracked in PROJECT.md v2.3 so it isn't forgotten before go-live.
