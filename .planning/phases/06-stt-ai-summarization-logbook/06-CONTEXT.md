# Phase 6: STT, AI Summarization & Logbook - Context

**Gathered:** 2026-07-05 (updated 2026-07-05 — closed OQ#1-4, #6, #7; cancelled D-16 dual-audio mixing per research finding, D-17 lecturer-mic-only is now the default)
**Status:** Ready for planning — 1 open question remains (see bottom of `<decisions>`)

<domain>
## Phase Boundary

Every completed session with a recording automatically produces an editable, lecturer-approved logbook entry via an async STT → LLM summary pipeline, with graceful fallback to manual notes if the pipeline fails or times out. Admin can monitor STT/LLM job health and quota.

**Expanded in PRD v2.3 (this discussion):** Online sessions now run through in-app embedded video (Jitsi) instead of an external meeting link, and both parties' audio is mixed into a single recording so the STT pipeline sees complete audio regardless of session mode. This reverses a v2.2 non-goal — see `PROJECT.md` Key Decisions and the note in `<specifics>` below for the amendment record.

</domain>

<decisions>
## Implementation Decisions

### STT Engine (STT-01, STT-02)
- **D-01 (revised — closes OQ#3):** Self-hosted faster-whisper, **CPU-only** deployment. `STT_MODEL_SIZE="small"` (env-configurable; upgrade to `"medium"` if accuracy proves insufficient), `compute_type="int8"` (quantized for CPU throughput), `language="id"` (Indonesian, skip language auto-detect). Free — no per-request cost. This supersedes the earlier `large-v3-turbo` default: CPU-only hosting is confirmed, so model size is tuned down to realistically hit the ≤2× duration NFR rather than assuming GPU throughput.
- **D-02:** `SessionRecording` currently has no stored audio duration — needed for the ≤2× duration NFR and for computing the timeout (D-08). Planner must add a duration field (populate at upload time client-side, or compute server-side via a probe) — this did not exist before Phase 6.

### LLM Summarization (STT-03)
- **D-03:** Claude API (`api.anthropic.com`) generates the structured summary. Output is JSON: `advice_points[]` + `improvement_notes[]`. Filler words are left in the raw transcript and cleaned up only at this summarization stage, not during transcription. Uses the **Batch API** (50% cost discount, fits the already-async pipeline) plus **prompt caching** to keep cost down.
- **D-04 (resolved — closes OQ#1, OQ#2):**
  - **Default model: `claude-haiku-4-5`.** Rationale: structured summarization from a clean transcript is a relatively light task; Haiku is sufficient quality at a small fraction of Sonnet's cost (~Rp 100–300/session, <Rp 100,000/semester at ~500 sessions).
  - **Upgrade path: `claude-sonnet-5`** — switch to it only if quality evaluation (see AI-SPEC.md eval strategy) shows Haiku's summaries are insufficient.
  - Model is **configurable via an env var** (e.g. `LLM_MODEL`) so it can change without a code change.
  - Confirmed: `claude-sonnet-4-6` (the originally-requested id) is **not a valid current model id** — must not be used.
  - **`ANTHROPIC_API_KEY` is assumed NOT YET present** in the environment. Add a placeholder in `settings/base.py` and `.env.example`, matching the existing `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` pattern. The real key will be provisioned from `console.anthropic.com` at deploy time.
  - **New: `STT_LLM_ENABLED` feature flag (default `False`).** If the key is absent or the flag is off, the entire STT→LLM pipeline is skipped and every session falls back to the manual-notes editor (graceful degradation, STT-07) — this is the mechanism that makes "no key yet" a safe default rather than a failure state.

### Storage (STT-05, STT-06)
- **D-05:** New standalone model `SessionLogbook` (OneToOne/FK to `Session`) — do **not** add these fields directly to `Session`, which is already overloaded as the queue/scheduling record. Fields: `transcript` (text), `summary_raw` (JSON from LLM), `summary_edited` (lecturer's edited version), `status`, `approved_at`, `approved_by`, `source_mode` (`offline`/`online` — new, needed once online sessions exist via Jitsi).

### Async Architecture (STT-02, STT-07)
- **D-06 (revised):** Two chained Celery tasks: `transcribe_session` → (on success) triggers `summarize_session`. Status state machine: `pending → transcribing → summarizing → ready_for_review → approved` / `failed`. Non-blocking; frontend polls or refreshes status. **Triggered directly from `CompleteSessionView` via `.delay()`** when the "Selesai" upload completes — no separate polling job watches for done-but-unprocessed sessions.
- **D-07 (resolved — closes OQ#6):** **This is new infrastructure for the project.** Every existing background job (`check_h15_notifications`, `check_auto_cancel` in `apps/bimbingan/scheduler.py`) runs on APScheduler with zero broker — no Celery, Redis, or worker process exists anywhere in this codebase or `requirements.txt` today. **Broker: Redis** (confirmed — lighter than RabbitMQ for this scale) + a Celery worker process deployed alongside Django. Confirmed choice — proceed, treating broker + worker deployment as first-class scope, not an afterthought.

### Fallback & Timeout (STT-07)
- **D-08 (revised — per AI-SPEC.md §7):** Timeout is **split by stage**, not one universal value:
  - **STT stage:** 2× audio duration, minimum 5 minutes (depends on D-02's duration field existing). faster-whisper on CPU is roughly proportional to audio length (D-01), so a duration-scaled SLA is meaningful here.
  - **LLM/Batch stage:** a separate, audio-length-**independent** `LLM_BATCH_TIMEOUT_MINUTES` env var, default **180 minutes**. The Anthropic Batch API's completion window (typically <1h, formally ≤24h) has no relationship to session audio length, so applying the STT timeout formula here would abandon healthy, still-processing batches to manual notes far too often — undermining the whole point of the automated pipeline. `poll_summary_batch`'s Celery retry ceiling must be raised to match this value (not the ~1h default that falls out of a naive retry count).
  - On timeout or failure at either stage: `SessionLogbook.status = failed`, a `SystemLog` entry is written (matching the existing `H15_NOTIFICATION` / `AUTO_CANCEL` event-type pattern, distinguishing `event_type` by cause — e.g. `STT_TIMEOUT` vs `LLM_TIMEOUT` vs `LLM_FAILED` — so the two clocks are never conflated in monitoring), and the lecturer sees a manual note editor.
  - **Alert threshold:** page/notify if LLM-timeout-caused fallbacks exceed ~5% of sessions over a rolling window (signals the 180min ceiling is too tight or Anthropic's batch queue is degraded) — tracked separately from genuine `LLM_FAILED`/`LLM_VALIDATION_FAILED` fallbacks, which alert at a lower ~2% bar since those indicate a real quality/integration break, not just slowness.
- **D-09 (resolved — closes OQ#4):** Retry/timeout uses **Celery's native retry mechanism** (e.g. `autoretry_for` + `retry_backoff`) rather than a custom app-level retry flag — so yes, there is at least one automatic retry before falling back to manual notes, not straight-to-manual on first failure. Exact retry count/backoff timing is Claude's Discretion (moved below) as an implementation detail within Celery's native mechanism.

### Monitoring & Quota (ADMIN-05)
- **D-10:** Admin Dashboard shows STT/LLM job counts (success/failed) and a failure-log list, reusing the generic `SystemLog` model (`level`/`event_type`/`message`/`context`) — filter by `event_type` (e.g. `STT_FAILED`, `LLM_FAILED`) rather than adding new dedicated fields. Note: despite the ROADMAP text describing Phase 8's Admin Dashboard as already covering "STT/LLM quota," the actual `AdminDashboard.tsx` and backend have no STT/LLM-specific code today (verified — zero matches) — this is genuinely new work in Phase 6, not a Phase 8 leftover to wire up.
- **D-11:** Since Claude API is a paid service, show a token/cost usage estimate. Exact calculation method (per-session vs aggregate, real-time vs batched) is **open — see Open Questions**.

### In-App Video — Jitsi (VIDEO-01, new in v2.3)
- **D-12 (retained, clarified 2026-07-05):** Online sessions embed video via the **Jitsi Meet External API** — `@jitsi/react-sdk`'s `JitsiMeeting` component (preferred, avoids hand-rolling iframe mount/unmount) or `external_api.js`/`JitsiMeetExternalAPI` directly — using **`meet.jit.si`** (public instance) for MVP/demo. Functions purely as in-app video conferencing (a Zoom-like embed), nothing more. **Known limitation, not a blocker:** `meet.jit.si` has no SLA/security guarantee — self-hosted or JaaS Jitsi is required before production use. Recorded explicitly in `PROJECT.md` v2.3 Key Decisions. **Unchanged by the D-16 cancellation below** — the video-call embedding itself is unaffected by the audio-capture finding.
- **D-13:** Introduce a `VideoProvider` abstraction with Jitsi as the (only) implementation. No prior `VideoProvider`/`Daily.co` code exists anywhere in this repo (verified by search, and independently reconfirmed by `06-RESEARCH.md`) — this is a fresh introduction, not a replacement of existing code. **Closes the earlier open question** — no external PRD/design doc exists to ingest; proceed as a fresh design.
- **D-14:** The STT pipeline (`transcribe_session` → `summarize_session`) must stay **agnostic to video provider**. It only ever consumes whatever ends up in `SessionRecording` — Jitsi-embedding logic must not leak into the transcription/summarization tasks. This is a hard architectural boundary, not a preference.

### Online Session Audio Capture (VIDEO-02, revised 2026-07-05 per `06-RESEARCH.md` findings)
- **D-15:** Today, online sessions (per Phase 5 D-09) capture only the lecturer's local mic via `MediaRecorder` — the student's voice is never in the recording. This was acceptable when "online" just meant an external meeting link; it remains the accepted behavior for Phase 6 too (see D-16/D-17 below) — the gap is not closed this phase.
- **D-16 — CANCELLED (conscious decision, not a failure):** The original plan (mix lecturer local mic + student remote Jitsi audio into one stream via the Web Audio API) is **not implementable** against the Jitsi stack locked in D-12. `06-RESEARCH.md` (digests `3fd44d7`/`2d241ed`, three independent official Jitsi sources) confirmed the Jitsi Meet External API runs the call inside a cross-origin `<iframe>` and exposes **only metadata events** (`audioMuteStatusChanged`, `dominantSpeakerChanged`, etc.) — never a `MediaStreamTrack`/`MediaStream` for the remote participant. This is a structural cross-origin-iframe limitation, not a config flag or a hard-but-possible engineering problem. Recorded here as a deliberate cancellation so no future session re-attempts this against the same stack without first reading this note.
- **D-17 (revised — now the DEFAULT behavior, not a fallback):** Online sessions record **lecturer-mic-only audio** via the existing `useMediaRecorder` flow, identical to today's Phase 5 behavior — not a contingency path, the actual shipped Phase 6 behavior for VIDEO-02. The transcript for an online session contains the lecturer's voice plus whatever the student's audio picked up through the lecturer's speaker/room mic (lower fidelity, but the logbook pipeline still runs end-to-end). This limitation is accepted explicitly, not silently.
- **D-18:** Offline sessions are unaffected — single mic, single room, unchanged from Phase 5.
- **D-19 (new):** Full dual-party audio capture is **deferred past Phase 6** — out of scope for the July milestone. The technical path is known (`lib-jitsi-meet` directly — no iframe, raw WebRTC/XMPP signaling, `JitsiTrack.getOriginalStream()` for real remote-track access — requiring a self-hosted or JaaS Jitsi backend, since `meet.jit.si` isn't designed for arbitrary third-party connections at that protocol layer) but is a materially larger integration than D-12's locked iframe approach, and doesn't fit this phase's timeline alongside Celery + Redis + faster-whisper + the LLM pipeline + the Jitsi embed itself. Tracked as a future-roadmap deferred idea, not lost.

### Claude's Discretion
- Exact JSON schema beyond `advice_points[]` / `improvement_notes[]` (e.g., ordering, per-item metadata).
- Exact Celery retry count / backoff timing within the native-retry mechanism confirmed in D-09.
- Exact Admin Dashboard layout for job counts / failure log filters.
- Whether `SessionLogbook.status` values match the state machine in D-06 verbatim or need additional transitional states — planner's call within the state machine's intent.

### Open Questions — Must Confirm Before Planning

**Resolved this session (2026-07-05):** ~~OQ#1 (Claude model)~~, ~~OQ#2 (API key provisioning)~~, ~~OQ#3 (CPU/GPU + model size)~~, ~~OQ#4 (retry policy)~~, ~~OQ#6 (Celery broker choice)~~ — see D-01, D-04, D-07, D-09 above.

**Resolved 2026-07-05 (research pass, `06-RESEARCH.md`):** ~~OQ#7 (VideoProvider abstraction reference, D-13)~~ — confirmed no prior art exists anywhere; proceed as a fresh design. ~~D-16 dual-audio go/no-go~~ — cancelled per the finding above; D-17 (lecturer-mic-only) is now the shipped behavior, D-19 tracks the deferred full-mixing path.

1. **Token/cost estimate display (D-11):** per-session cost, aggregate monthly spend, or both? Real-time computed or batched/cached?

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project & Requirements
- `.planning/PROJECT.md` — v2.3 (amended in this discussion): Key Decisions table now includes the Jitsi/VideoProvider decision and the `meet.jit.si`-not-for-prod caveat; Constraints section has a new **Video** line; STT/LLM hybrid privacy decision (self-host STT, cloud LLM) is the reason Option B (third-party STT API) was rejected
- `.planning/REQUIREMENTS.md` — STT-01 through STT-07, ADMIN-05 (original Phase 6 scope); **VIDEO-01** (promoted from v2 Requirements, revised to reference Jitsi instead of "Zoom/Meet") and **VIDEO-02** (new) — both added to Phase 6 in this discussion; SESSION-06 annotated as superseded-not-reopened
- `.planning/ROADMAP.md` — Phase 6 section: goal, requirements list, and success criteria all updated in this discussion to include the video/dual-audio scope (success criteria 7–8)
- `.planning/phases/05-session-execution-with-recording-consent/05-CONTEXT.md` — D-09/D-10 (local-mic-only `MediaRecorder` capture, WebM/Opus, single-file upload on "Selesai") is the existing behavior Phase 6 extends for online sessions (D-15 through D-17)

### Existing Code — Session & Recording
- `backend/apps/bimbingan/models.py` — `Session` model (do not add Phase 6 fields here — see D-05); `SessionRecording` model (`uuid`, `original_filename`, `file_path`, `file_size`, `mime_type`, `uploaded_at` — no duration field yet, see D-02); `SystemLog` model (`level`, `event_type`, `message`, `context` — reuse for D-10, do not create a new logging model)
- `backend/apps/bimbingan/scheduler.py` — existing APScheduler jobs (`check_h15_notifications`, `check_auto_cancel`) — the only prior async-job pattern in this codebase; Celery (D-06/D-07) is new infrastructure, not an extension of this file
- `backend/apps/bimbingan/services/calendar.py`, `services/notification.py` — existing external-API service pattern (Google Calendar OAuth + Fernet-encrypted token storage) — a reference for how external API credentials/services are structured in this codebase, though the LLM/STT integration will follow its own pattern per D-03/D-12
- `backend/requirements.txt` — confirms no Celery, Redis, or any LLM/STT SDK is installed yet; all of Phase 6's dependencies are new additions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SystemLog` model — reuse for all STT/LLM/Jitsi failure logging (D-10), matching the existing event-type-based audit pattern rather than inventing new log tables
- File upload pattern from `SessionRecording` (Phase 5) / `SubmissionFile` (Phase 1) — UUID-based filenames, not directly exposed via `MEDIA_URL` — the transcript/summary storage in `SessionLogbook` should follow the same "never a guessable direct URL" discipline for the encrypted-at-rest constraint in `PROJECT.md`

### Established Patterns
- Backend: DRF `APIView` classes per action, `IsLecturer`/`IsAdmin` permission classes, ownership checked via `request.user` against `student.adviser`
- All existing background/scheduled work runs in-process via APScheduler (`apps.py::ready()` starts it) — Celery introduces the first genuinely separate worker process in this project

### Integration Points
- Phase 6's STT pipeline consumes whatever `SessionRecording` contains — it must not care whether that recording came from an offline single-mic capture (Phase 5, unchanged) or an online single-mic capture via the same `useMediaRecorder` flow (D-17 — lecturer-mic-only is the shipped online behavior, not a mixed-track recording)
- `AdminDashboard.tsx` (Phase 8, already shipped) shows generic error logs today; Phase 6 adds STT/LLM-specific job counts and failure filtering to it, not a new dashboard page

</code_context>

<specifics>
## Specific Ideas

- "Session sudah dobel sebagai queue" — the user was explicit that `Session` must not become a dumping ground for logbook fields; a dedicated `SessionLogbook` model is a hard requirement, not just a suggestion.
- The Jitsi/dual-audio scope was added mid-discussion as a deliberate PRD v2.3 amendment, not scope creep slipped in accidentally — the user explicitly walked through the charter-amendment discipline (amend `PROJECT.md` first, then expand `REQUIREMENTS.md`/`ROADMAP.md`, then plan) before agreeing to fold it into Phase 6 rather than spinning up a separate phase.

</specifics>

<deferred>
## Deferred Ideas

- **Production-grade Jitsi hosting** (self-hosted or JaaS, replacing public `meet.jit.si`) — explicitly deferred past MVP/demo; tracked in `PROJECT.md` v2.3 Key Decisions so it isn't forgotten before go-live.
- **Full dual-party audio capture for online sessions (D-19, added 2026-07-05):** the originally-planned Web Audio API mixing (D-16) is cancelled — cross-origin iframe limitation, not a timeline call. The real path is a `lib-jitsi-meet`-based rebuild (no iframe, direct WebRTC/XMPP signaling, self-hosted/JaaS Jitsi backend) — tracked as a future-roadmap idea, not attempted in Phase 6. Phase 6 ships lecturer-mic-only audio for online sessions (D-17) instead.
- Speaker diarization, AI quality scoring of guidance sessions — already out of scope per `PROJECT.md`/`REQUIREMENTS.md`, unaffected by this discussion.

</deferred>

---

*Phase: 6-STT, AI Summarization & Logbook*
*Context gathered: 2026-07-05*
