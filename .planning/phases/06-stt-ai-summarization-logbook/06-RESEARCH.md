# Phase 6: STT, AI Summarization & Logbook - Research

**Researched:** 2026-07-05
**Domain:** Self-hosted CPU speech-to-text (faster-whisper) + Jitsi Meet embedded video/dual-audio capture + Celery/Redis async infrastructure for a Django 5 + DRF backend. (The Anthropic/LLM summarization side is already fully covered by `06-AI-SPEC.md` — not duplicated here.)
**Confidence:** MEDIUM-HIGH — faster-whisper and Celery/Django patterns verified against official docs/repos and PyPI registry this session; the Jitsi dual-audio question (VIDEO-02) resolves to a **hard documented constraint**, not a tuning question — see Pitfall/Pattern sections below.

> **No MCP research tools (context7, exa, tavily, firecrawl) were available in this session** — `.planning/config.json` has all provider flags (`exa_search`, `brave_search`, `firecrawl`, `tavily_search`) set to `false`, matching the tool_strategy fallback path. All findings below were obtained via `WebSearch`/`WebFetch` against official docs/repos/registries, or verified directly via `pip index versions` / `npm view`. Claim tags reflect this: `[VERIFIED: <registry>]` for tool-confirmed package facts, `[CITED: <url>]` for official-doc/repo content fetched this session, `[ASSUMED]` for anything not independently checked this session.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**STT Engine (STT-01, STT-02)**
- **D-01 (revised):** Self-hosted faster-whisper, CPU-only deployment. `STT_MODEL_SIZE="small"` (env-configurable; upgrade to `"medium"` if accuracy proves insufficient), `compute_type="int8"` (quantized for CPU throughput), `language="id"` (Indonesian, skip language auto-detect). Free — no per-request cost. Supersedes the earlier `large-v3-turbo` default.
- **D-02:** `SessionRecording` has no stored audio duration field — needed for the ≤2× duration NFR and the timeout (D-08). Planner must add a duration field.

**LLM Summarization (STT-03)** — see AI-SPEC.md, not re-researched here (D-03, D-04).

**Storage (STT-05, STT-06)**
- **D-05:** New standalone model `SessionLogbook` (OneToOne/FK to `Session`) — do NOT add these fields to `Session`. Fields: `transcript`, `summary_raw`, `summary_edited`, `status`, `approved_at`, `approved_by`, `source_mode` (`offline`/`online`).

**Async Architecture (STT-02, STT-07)**
- **D-06 (revised):** Two chained Celery tasks: `transcribe_session` → (on success) triggers `summarize_session`. State machine: `pending → transcribing → summarizing → ready_for_review → approved` / `failed`. Triggered directly from `CompleteSessionView` via `.delay()` — no separate polling job.
- **D-07 (resolved):** This is new infrastructure — zero Celery/Redis/worker anywhere in this codebase today. **Broker: Redis** + a Celery worker process deployed alongside Django. Confirmed, not an afterthought.

**Fallback & Timeout (STT-07)**
- **D-08 (revised):** Split by stage — STT stage: 2× audio duration, minimum 5 minutes. LLM/Batch stage: separate `LLM_BATCH_TIMEOUT_MINUTES` env var, default 180 minutes, decoupled from audio length. `poll_summary_batch`'s Celery retry ceiling must match 180min, not a ~1h default. On timeout/failure: `SessionLogbook.status = failed`, `SystemLog` entry with distinguishing `event_type` (`STT_TIMEOUT` vs `LLM_TIMEOUT` vs `LLM_FAILED`).
- **D-09 (resolved):** Retry/timeout uses Celery's native retry mechanism (`autoretry_for` + `retry_backoff`), not a custom app-level flag. At least one automatic retry before falling back to manual notes.

**Monitoring & Quota (ADMIN-05)**
- **D-10:** Admin Dashboard shows STT/LLM job counts and failure-log list, reusing `SystemLog` (`level`/`event_type`/`message`/`context`), filtered by `event_type` — not new dedicated fields. Genuinely new work, not a Phase 8 leftover.
- **D-11:** Show token/cost usage estimate (Claude API is paid). Exact calculation method is open — see Open Questions.

**In-App Video — Jitsi (VIDEO-01, new in v2.3)**
- **D-12:** Online sessions embed video via the Jitsi Meet External API (`external_api.js` + `JitsiMeetExternalAPI`), using `meet.jit.si` (public instance) for MVP/demo. Known limitation, not a blocker: no SLA/security guarantee — self-hosted/JaaS required before production. Recorded in `PROJECT.md` v2.3.
- **D-13:** Introduce a `VideoProvider` abstraction with Jitsi as the (only) implementation. No prior `VideoProvider`/Daily.co code exists anywhere in this repo (verified by search) — fresh introduction.
- **D-14:** The STT pipeline (`transcribe_session` → `summarize_session`) must stay agnostic to video provider. It only ever consumes whatever ends up in `SessionRecording` — Jitsi-embedding and audio-mixing logic must not leak into transcription/summarization tasks. Hard architectural boundary.

**Dual-Party Audio Capture for Online Sessions (VIDEO-02, new in v2.3) — ⚠ HIGHEST RISK ITEM**
- **D-15:** Today, online sessions (Phase 5 D-09) capture only the lecturer's local mic via `MediaRecorder` — the student's voice is never in the recording.
- **D-16:** Planned approach: mix the lecturer's local mic track and the student's remote Jitsi audio track into a single stream via the Web Audio API (`AudioContext` + `MediaStreamAudioSourceNode`s merged into one destination), then record that merged stream exactly as today's `MediaRecorder` flow does.
- **D-17:** Explicit fallback if mixing proves too complex to land in time: record the lecturer's mic only (today's existing online behavior) — an incomplete-but-functional transcript beats no session-completion path at all. The plan MUST surface this as an explicit risk/fallback decision point, not silently attempt-and-hope.
- **D-18:** Offline sessions are unaffected — single mic, single room, unchanged from Phase 5.

> **Research finding directly bearing on D-16/D-17 — flagged prominently in this document's Architecture Patterns and Pitfalls sections below: the Jitsi Meet External API (the mechanism locked in D-12) does NOT expose the remote participant's raw `MediaStreamTrack`/`MediaStream` to the embedding page. This is a documented, structural constraint, not a tuning problem. The planner should treat D-17's fallback as the PRIMARY path, not a contingency, unless the team is willing to replace the External API/iframe approach with `lib-jitsi-meet` (a materially larger integration effort) — see Pitfall 8 and Pattern 3 below.**

### Claude's Discretion
- Exact JSON schema beyond `advice_points[]`/`improvement_notes[]` (AI-SPEC territory).
- Exact Celery retry count/backoff timing within the native-retry mechanism confirmed in D-09.
- Exact Admin Dashboard layout for job counts/failure log filters.
- Whether `SessionLogbook.status` values match the D-06 state machine verbatim or need additional transitional states.
- **New from this research pass:** exact Celery queue topology (single worker/queue vs. separate `stt`/`llm` queues), exact worker pool type and concurrency per deployment target (Docker Linux vs. local Windows dev), and whether to bake the faster-whisper model into the Docker image at build time vs. runtime download (see Pitfall 2 and Pattern 2).

### Deferred Ideas (OUT OF SCOPE)
- Production-grade Jitsi hosting (self-hosted or JaaS, replacing public `meet.jit.si`) — explicitly deferred past MVP/demo.
- Speaker diarization, AI quality scoring of guidance sessions — already out of scope.

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STT-01 | System transcribes session audio to text via self-hosted STT (faster-whisper) asynchronously after session ends | `faster-whisper` 1.2.1 `WhisperModel` API, CPU/int8 pattern, Celery task wrapper — Standard Stack, Pattern 1/2, Code Examples |
| STT-02 | Transcript available within ≤2× audio duration for 90% of sessions; UI not blocked | CPU throughput benchmark (small+int8: ~7.6× realtime single-threaded on an 8-thread desktop CPU) gives wide safety margin under the 2× ceiling; async Celery task never blocks the request/response cycle — Common Pitfalls #1/#2, Standard Stack |
| STT-03 | System generates structured AI summary from transcript via LLM API | Covered by AI-SPEC.md — not re-researched |
| STT-04 | Lecturer can review/edit/approve AI summary before logbook commit | Covered by AI-SPEC.md |
| STT-05 | Approved summary/transcript/advice items saved and linked to session/student | `SessionLogbook` model design — Architecture Patterns, Don't Hand-Roll |
| STT-06 | Student can view approved transcript/summary | Existing auth-gated file-serving pattern (Phase 1) extends to logbook read endpoints — Architecture Patterns |
| STT-07 | STT/LLM failure/timeout → manual note editor fallback, logged to Admin Dashboard | Celery `autoretry_for`/`retry_backoff` pattern, `SystemLog` reuse, split-stage timeout — Pattern 4, Common Pitfalls #4 |
| ADMIN-05 | Admin monitors STT/LLM job counts and failure logs | `SystemLog` `event_type` filtering — Architecture Patterns, Don't Hand-Roll |
| VIDEO-01 | Online sessions run via in-app embedded Jitsi video instead of external link | `JitsiMeetExternalAPI` constructor/lifecycle, `@jitsi/react-sdk` — Standard Stack, Pattern 3, Code Examples |
| VIDEO-02 | Both parties' audio mixed into one recording via Web Audio API for online sessions | **Critical finding:** External API provides no raw remote-track access — Architecture Patterns (Pattern 3), Common Pitfalls #8, Assumptions Log |

</phase_requirements>

---

## Summary

This phase bolts three genuinely new pieces of infrastructure onto a Django 5 + DRF + APScheduler codebase that today has zero async task queue, zero self-hosted ML inference, and zero embedded video: (1) **faster-whisper** running CPU-only inference inside a Celery task, (2) **Celery + Redis** as the project's first real background-worker infrastructure (APScheduler stays for the existing H-15/auto-cancel jobs; Celery is additive, not a replacement), and (3) the **Jitsi Meet External API** embedded in the React frontend for VIDEO-01, paired with a Web Audio API dual-track mixing approach for VIDEO-02 that this research shows is **not achievable using the External API alone** — VIDEO-02's D-16 approach and D-17 fallback need to be reordered before planning proceeds.

faster-whisper is straightforward and low-risk: `pip install faster-whisper` pulls in `ctranslate2`, `onnxruntime`, `huggingface-hub`, `tokenizers`, `av`, and `tqdm` as its only dependencies [VERIFIED: pypi.org/project/faster-whisper — 1.2.1]; no system FFmpeg install is needed because `av` (PyAV) bundles it [CITED: github.com/SYSTRAN/faster-whisper]. A `small` + `int8` model transcribed a 13-minute audio file in 1m42s on an 8-thread desktop CPU using ~1.5GB RAM in the project's own published benchmark [CITED: github.com/SYSTRAN/faster-whisper] — roughly 7.6× realtime, which clears the ≤2× duration NFR with a very wide margin even accounting for a slower production CPU. The two things that need explicit engineering attention are: the model must be loaded once per Celery worker **process** (via a `worker_process_init` signal handler), not per task and not before Celery's fork happens, to avoid a documented hang/deadlock failure mode reported by faster-whisper users running under Celery's prefork pool [CITED: github.com/SYSTRAN/faster-whisper/issues/907]; and the ~484MB model weights download from Hugging Face Hub on first load and must be cached in a persistent volume (or baked into the Docker image at build time), or every container restart silently re-downloads 484MB.

Celery + Redis is new but entirely conventional: a `celery.py` app object wired via `config_from_object('django.conf:settings', namespace='CELERY')`, a `redis` service block added to `docker-compose.yml` alongside the existing `db`/`web` pattern, and a `celery-worker` service that runs `celery -A config worker`. The AI-SPEC.md's `submit_summary_batch` → `poll_summary_batch` split (rather than an in-task blocking wait loop) is independently confirmed by this research as the correct pattern — Celery's own documentation warns that `eta`/`countdown` scheduling is fine for short delays (their own `unlock_chord` polling helper uses exactly this `self.retry(countdown=interval)` pattern) but is explicitly *not* recommended for scheduling far into the future in one shot, which validates re-queuing every 60s rather than a single long countdown.

The Jitsi piece is where this research surfaces the phase's real risk, sharper than "highest risk, plan for it" — it is now a **known, documented API limitation**. The Jitsi Meet External API (`external_api.js`/`JitsiMeetExternalAPI`, and the `@jitsi/react-sdk` wrapper around it) runs the actual meeting inside a cross-origin `<iframe>` pointed at `meet.jit.si`. Every audio-related event the External API exposes (`audioMuteStatusChanged`, `audioAvailabilityChanged`, `dominantSpeakerChanged`, `micError`) carries only metadata (booleans, participant IDs, error strings) — none of them, nor any documented function, hands back a `MediaStreamTrack` or `MediaStream` object for the remote participant [CITED: jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe-events]. This is a structural consequence of iframe cross-origin isolation, not a missing feature Jitsi could expose with a config flag: the embedding page's JavaScript cannot reach into `meet.jit.si`'s DOM/WebRTC objects any more than it could reach into any other cross-origin site's iframe. Raw track access (`getOriginalStream()` returning the underlying `MediaStream`) exists only in `lib-jitsi-meet`, the lower-level library that talks directly to a Jitsi videobridge without an iframe boundary [CITED: github.com/jitsi/lib-jitsi-meet, jiyeyuran/lib-jitsi-meet/doc/API.md] — a fundamentally different, larger integration (no iframe, direct WebRTC signaling, and it would still require a self-hosted or JaaS deployment, since `meet.jit.si` does not expose `lib-jitsi-meet` connections designed for arbitrary third-party embedding at that layer). **Given D-12 already locks the External API + `meet.jit.si` for MVP, D-16's Web Audio mixing plan as written cannot be implemented against that locked stack** — the planner must either (a) accept D-17's lecturer-mic-only fallback as the actual Phase 6 deliverable for VIDEO-02 and re-scope the "dual-audio" language accordingly, or (b) treat a `lib-jitsi-meet` migration as a separate, larger follow-on decision explicitly outside this phase's timeline. This document does not make that call — it surfaces it for `/gsd-discuss-phase` or the planner to resolve explicitly, per D-17's own instruction not to "silently attempt-and-hope."

**Primary recommendation:** Build Celery + Redis + faster-whisper first (low-risk, well-trodden path, and STT-01/02/07 alone deliver real value even for offline sessions). Treat the Jitsi dual-audio question as a go/no-go decision to make explicitly before Wave planning, not a task to attempt and see — the research answer is already in: the External API cannot give you the remote track, so plan for lecturer-mic-only online recording (D-17) as the shipped Phase 6 behavior unless the team commits to a `lib-jitsi-meet` self-hosted rebuild that this phase's timeline likely cannot absorb alongside everything else already in scope (Celery, Redis, faster-whisper, and the LLM pipeline).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Audio transcription (STT) | API / Backend (Celery worker) | — | CPU-bound inference; must run off the request/response cycle in a dedicated worker process, never in a Django view |
| LLM summarization | API / Backend (Celery worker) | External API (Anthropic) | Orchestration and state live in Django/Celery; the model call itself is delegated to `api.anthropic.com` (AI-SPEC territory) |
| Task queue / broker | API / Backend (Redis + Celery) | — | New infrastructure tier this phase introduces; sits between Django and the worker processes |
| Logbook storage (`SessionLogbook`) | Database / Storage | API / Backend | Postgres is the durable source of truth; Celery/Anthropic state (batch_id) is treated as ephemeral per AI-SPEC |
| Lecturer review/approve UI | Browser / Client | API / Backend | Client renders draft + edit form; backend is authoritative on `status` transitions and ownership checks |
| Video call rendering (Jitsi) | Browser / Client | CDN / Static (`meet.jit.si`) | The iframe is loaded from Jitsi's own origin; the React app only mounts/controls it via `postMessage`-backed commands, it does not render the call itself |
| Dual-audio mixing (Web Audio API) | Browser / Client | — | **Constrained tier** — must happen entirely client-side because there is no server-side hook into a cross-origin iframe's media streams; this is exactly why D-16 cannot reach the remote track (see Summary) |
| Recording upload (`SessionRecording`) | Browser / Client → API / Backend | — | `MediaRecorder` output uploaded from client to Django, unchanged pattern from Phase 5 |
| STT/LLM job monitoring (Admin Dashboard) | API / Backend | Browser / Client | `SystemLog` queried server-side; dashboard is a thin read view over `event_type` aggregates |
| Video provider abstraction (`VideoProvider`) | Browser / Client | API / Backend (config only) | The abstraction itself is a frontend-side interface (Jitsi is a client-embedded widget); backend involvement is limited to passing room/session identifiers, not managing the call |

---

## Project Constraints (from CLAUDE.md)

The root `CLAUDE.md` is a workspace-routing file (points to `library-management`/`gsd-new-project` folders that do not apply to this repo layout) plus a living **STATUS AUDIT PHASE 2** section with directives directly relevant to this phase:

- **FR-M04 (consent) is already implemented**, not phase-6 scope: `Session.consent_given_at`, `consent_by_dosen`, `consent_by_mahasiswa` fields already exist in `apps/bimbingan/models.py` (confirmed by direct read this session) — CLAUDE.md's "FR MISSING" table is stale on this point; do not re-plan consent capture.
- **NFR-01** directive: "Calendar check_free_busy + create_event dipanggil di approve — Calls masih synchronous/blocking (bukan threading.Thread)" is flagged as a partial/outstanding item from Phase 2 unrelated to this phase, but establishes the project convention that **blocking external-API calls inside a request/response view are a known anti-pattern already flagged for fix elsewhere** — Phase 6 must not repeat this mistake for STT/LLM calls (Celery already prevents this by design, per D-06/D-07).
- **NFR-03** directive: existing Fernet (AES-128-CBC) token encryption is flagged as *not* meeting the PROJECT.md AES-256 requirement. `SessionLogbook` (D-05) inherits the same "encrypted at rest" constraint as `SessionRecording` per AI-SPEC.md — if the planner reuses the existing Fernet-based encryption helper for any new encrypted field, it inherits this same known gap; do not treat Fernet as AES-256-compliant.
- **"Make the smallest change that solves the request... avoid touching unrelated files"** — directly relevant given this phase touches `docker-compose.yml`/`docker-compose.dev.yml` (adding services) and `requirements.txt` (adding packages): additions should be scoped to exactly what Celery/Redis/faster-whisper/Jitsi require, not a broader dependency refresh.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| faster-whisper | 1.2.1 | Self-hosted CPU speech-to-text (STT-01) | CTranslate2-based reimplementation of OpenAI Whisper, up to 4× faster and lower-memory than `openai-whisper` on the same hardware; the only self-hosted STT option consistent with D-01's CPU-only, no-per-request-cost constraint [VERIFIED: pypi.org/project/faster-whisper] |
| ctranslate2 | 4.8.1 | Inference engine faster-whisper is built on (pulled in automatically) | Required dependency; do not pin independently unless a specific CUDA/CPU compatibility issue arises [VERIFIED: pypi.org/project/ctranslate2] |
| celery | 5.6.3 | Async task queue for `transcribe_session`/`submit_summary_batch`/`poll_summary_batch` (D-06/D-07) | De facto standard Python task queue; official Django integration documented; this project's first background-worker process | [VERIFIED: pypi.org/project/celery] |
| redis | 8.0.1 (Python client) | Celery broker (D-07) | Confirmed lighter-weight than RabbitMQ for this project's scale per D-07; official Celery-supported broker | [VERIFIED: pypi.org/project/redis] — note: this is the **Python client** version; the Redis **server** Docker image tag should be pinned separately (see Architecture Patterns) |
| @jitsi/react-sdk | 1.4.4 | React wrapper around the Jitsi Meet IFrame API (VIDEO-01) | Official Jitsi-maintained package (repo: `jitsi/jitsi-meet-web-sdk`); avoids hand-rolling iframe mount/unmount lifecycle in a `useEffect` | [VERIFIED: npm registry — published 2025-11-06] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| onnxruntime | (pulled in transitively by faster-whisper, currently 1.23.x per faster-whisper's `<2,>=1.14` constraint) | Used by faster-whisper for certain model ops (e.g. silero VAD if enabled) | No direct install needed; comes in via faster-whisper's dependency tree [CITED: pypi faster-whisper metadata] |
| huggingface-hub | pulled in transitively (`>=0.21` constraint) | Downloads faster-whisper model weights from the Hugging Face Hub on first load | No direct install/pin needed unless you need to control cache behavior explicitly (see Pitfall 2) |
| django-celery-results | 2.6.0 | Optional: persist Celery task results/state to the Django DB instead of only Redis | Only needed if the team wants queryable task-result history beyond what `SessionLogbook`/`SystemLog` already store; **not required** for this phase's design since AI-SPEC.md already treats Postgres (`SessionLogbook`) as the durable state and the Batch API as ephemeral — recommend `CELERY_RESULT_BACKEND` left unset with `ignore_result=True` on tasks unless a concrete need for it emerges | [VERIFIED: pypi.org/project/django-celery-results] |
| flower | (not version-pinned here) | Celery task monitoring web UI | Optional dev-time convenience for watching the STT/LLM queues during implementation; not required for the ADMIN-05 dashboard, which is spec'd to reuse `SystemLog` instead |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| faster-whisper (CTranslate2) | `openai-whisper` (reference implementation) | 4× slower, higher memory, no int8 CPU quantization path — would not plausibly clear the ≤2× duration NFR on CPU-only hardware |
| faster-whisper (CTranslate2) | `whisper.cpp` | Comparable CPU performance, but C++/bindings-based — more deployment friction in a Python/Django Docker image than a pure-pip package; no clear advantage given faster-whisper already meets the NFR with margin |
| Celery + Redis | Django-Q2 / Django-RQ | Lighter-weight alternatives exist, but D-07 already locked Celery + Redis explicitly as "confirmed choice — proceed" after considering the tradeoff; not re-litigated here |
| Jitsi Meet External API (iframe) | `lib-jitsi-meet` (direct, no iframe) | Only path that gives raw remote-track access for VIDEO-02's Web Audio mixing (D-16) — but requires dropping the iframe entirely, handling WebRTC signaling directly, and very likely a self-hosted/JaaS Jitsi deployment (not `meet.jit.si`) since the public instance isn't intended for arbitrary custom-client connections at this layer. Large scope increase versus D-12's locked choice — flagged as the real fork-in-the-road decision for this phase, not a drop-in swap |
| `@jitsi/react-sdk` | Hand-rolled `<script src="https://meet.jit.si/external_api.js">` + manual `useRef`/`useEffect` | Works fine and is what the SDK wraps internally — legitimate if the team prefers zero extra npm dependency; SDK mainly buys cleaner lifecycle/unmount handling |

**Installation:**
```bash
# Backend
pip install "faster-whisper==1.2.1" "celery==5.6.3" "redis==8.0.1"
# django-celery-results only if the team decides it's needed (see Supporting table note)

# Frontend
npm install @jitsi/react-sdk@1.4.4
```

**Version verification (run before finalizing — already run once this session, re-verify at implementation time since these move fast):**
```bash
pip index versions faster-whisper celery redis ctranslate2 django-celery-results
npm view @jitsi/react-sdk version
```

---

## Package Legitimacy Audit

> Ran via `gsd-tools query package-legitimacy check`. **Important caveat on this run's results:** the automated seam flagged `celery`, `redis`, `faster-whisper`, `ctranslate2`, `django-celery-results`, and `onnxruntime` as `SUS`, all for `unknown-downloads` (PyPI download counts were not available to the check) and, for several, `too-new` (the seam appears to read PyPI's *latest-release* publish timestamp rather than the package's original release date — e.g. it reported `redis` as published `2026-06-23`, which is the date of the latest `8.0.1` point release, not the true age of the `redis-py` project, which is 15+ years old and one of the most widely used Python packages in existence). Independent verification below (GitHub org/repo age, official project status, and third-party download-stat sites) shows these are all long-established, unambiguously legitimate projects — the `SUS` verdicts are a tooling false-positive for this class of package (mature project, frequent point releases, PyPI API not surfacing historical download stats), not a real risk signal. Per protocol, they remain tagged `[SUS]` below and the planner should still add a lightweight `checkpoint:human-verify` before the first install of each, purely as process hygiene — not because there is genuine reason to doubt them.

| Package | Registry | Age | Downloads | Source Repo | Verdict (tool) | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| faster-whisper | PyPI | ~4 yrs (SYSTRAN, active) | high (widely used STT project; exact weekly count not confirmed via pypistats this session) | github.com/SYSTRAN/faster-whisper | [SUS] (unknown-downloads) | Approved — false positive; official SYSTRAN-maintained repo, 1.2.1 is current stable |
| ctranslate2 | PyPI | 6+ yrs (OpenNMT) | 753,613/week [CITED: pypistats.org/packages/ctranslate2] | github.com/OpenNMT/CTranslate2 | [SUS] (too-new, unknown-downloads) | Approved — false positive; OpenNMT is an established MT/NLP org, high real download volume confirmed independently |
| celery | PyPI | 15+ yrs | very high (industry-standard task queue; not independently re-confirmed this session) | github.com/celery/celery | [SUS] (unknown-downloads) | Approved — false positive; celery is the de facto standard Python task queue |
| redis (python client) | PyPI | 15+ yrs (redis-py) | 56,044,339/week [CITED: pypistats.org/packages/redis] | github.com/redis/redis-py | [SUS] (too-new, unknown-downloads) | Approved — false positive; officially maintained by Redis Inc., extremely high confirmed download volume |
| django-celery-results | PyPI | 10+ yrs | high (official Celery-project sub-package) | github.com/celery/django-celery-results | [SUS] (unknown-downloads) | Approved (optional dependency — see Standard Stack note on whether it's needed at all) |
| onnxruntime | PyPI | 7+ yrs (Microsoft) | very high (major ML inference runtime; not independently re-confirmed this session) | onnxruntime.ai / github.com/microsoft/onnxruntime | [SUS] (too-new, unknown-downloads) | Approved — false positive; official Microsoft project, transitive dependency only (not directly installed) |
| @jitsi/react-sdk | npm | published 2025-02-18, actively updated (last publish 2025-11-06) | 23,587/week [VERIFIED: npm registry via `gsd-tools`] | github.com/jitsi/jitsi-meet-web-sdk | [OK] | Approved |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `celery`, `redis`, `faster-whisper`, `ctranslate2`, `django-celery-results`, `onnxruntime` — all judged false positives per the caveat above (mature, high-profile, officially-maintained projects); planner should still add one `checkpoint:human-verify` task before the Wave 0 dependency install step as process hygiene, not because of a genuine legitimacy concern.

---

## Architecture Patterns

### System Architecture Diagram

```
[Browser: React SPA]
   |
   |-- Offline session: existing Phase 5 MediaRecorder (local mic only) -- unchanged (D-18)
   |
   |-- Online session (VIDEO-01):
   |     [Jitsi iframe: JitsiMeetExternalAPI, domain=meet.jit.si]
   |         |-- renders remote/local video+audio INSIDE its own cross-origin iframe
   |         |-- emits metadata-only events to parent (mute state, dominant speaker) -- NOT raw tracks
   |     [Lecturer's local mic: getUserMedia()] -- raw MediaStreamTrack, embedding page HAS this
   |     [Web Audio AudioContext] -- CAN mix tracks the page has direct access to;
   |                                 CANNOT reach into the Jitsi iframe's remote audio (see Pitfall 8)
   |     -- D-17 fallback: MediaRecorder captures lecturer-mic-only stream, same as offline path
   |
   v  (POST recording blob on "Selesai")
[Django API] -- SessionRecording created (unchanged shape/flow from Phase 5)
   |
   v  CompleteSessionView calls transcribe_session.delay(session_id)   [D-06]
[Redis broker] <--- Celery task queue ---> [Celery worker process(es)]
   |                                             |
   |                                             |-- transcribe_session:
   |                                             |     loads WhisperModel ONCE per worker process
   |                                             |     (worker_process_init signal, not per-task)
   |                                             |     runs CPU/int8 inference -> transcript text
   |                                             |     writes SessionLogbook.transcript, status=summarizing
   |                                             |     .delay()'s summarize_session
   |                                             |
   |                                             |-- submit_summary_batch / poll_summary_batch:
   |                                             |     (fully specified in AI-SPEC.md — Anthropic Batch API)
   |
   v  on failure/timeout at either stage
[SystemLog] (event_type: STT_TIMEOUT / STT_FAILED / LLM_TIMEOUT / LLM_FAILED / LLM_VALIDATION_FAILED)
   |
   v
[Lecturer review UI] <-- ready_for_review (success) OR failed -> manual note editor (D-08/D-09/STT-07)
   |
   v  approve
[SessionLogbook.status=approved] -> visible to student (STT-06), feeds Admin Dashboard counts (ADMIN-05)
```

### Recommended Project Structure

```
backend/
├── config/
│   ├── celery.py                  # NEW: Celery app definition (Pattern 1)
│   ├── settings/
│   │   └── base.py                # add CELERY_* settings, STT_* env vars
│   └── __init__.py                 # add `from .celery import app as celery_app`
├── apps/
│   ├── bimbingan/                  # existing — Session, SessionRecording, SystemLog (unchanged models)
│   ├── logbook/                    # NEW app (per AI-SPEC.md's structure — extended here for STT)
│   │   ├── models.py               # SessionLogbook (D-05)
│   │   ├── tasks.py                # transcribe_session (NEW, this doc) +
│   │   │                           #   submit_summary_batch/poll_summary_batch (AI-SPEC.md)
│   │   ├── services/
│   │   │   ├── stt.py              # faster-whisper wrapper: get_model(), transcribe_audio()
│   │   │   └── summarizer.py       # AI-SPEC.md territory
│   │   └── migrations/
│   └── videocall/                  # NEW app for VIDEO-01/02 backend surface (room/session identifiers only —
│       │                           #   the actual video rendering is 100% frontend, see Responsibility Map)
│       └── ... (minimal — likely just serializer fields on Session, no heavy backend logic)
frontend/
└── src/
    ├── components/
    │   └── video/
    │       ├── VideoProvider.tsx    # D-13 abstraction (interface)
    │       └── JitsiVideoProvider.tsx  # Jitsi implementation using @jitsi/react-sdk (Pattern 3)
    └── hooks/
        └── useDualAudioRecorder.ts  # D-16/D-17 — lecturer-mic (+ remote, IF achievable) mixing (Pattern 3)
docker-compose.yml                  # add `redis` + `celery-worker` services (Pattern 2)
docker-compose.dev.yml              # same, dev variant
```

### Pattern 1: Celery App Definition Wired to Django Settings

**What:** The canonical `celery.py` app object, imported at Django startup so `@shared_task` works project-wide.
**When to use:** Once, at project setup — this is genuinely new infrastructure (D-07).

```python
# Source: docs.celeryq.dev/en/stable/django/first-steps-with-django.html (fetched this session)
# backend/config/celery.py
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.docker')

app = Celery('temudosen')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
```

```python
# backend/config/__init__.py
from .celery import app as celery_app
__all__ = ('celery_app',)
```

```python
# backend/config/settings/base.py — additions
CELERY_BROKER_URL = env('CELERY_BROKER_URL', default='redis://redis:6379/0')
CELERY_TASK_TRACK_STARTED = True
CELERY_TIMEZONE = TIME_ZONE  # 'Asia/Jakarta', reuse existing setting
CELERY_TASK_TIME_LIMIT = 60 * 60 * 4  # hard ceiling above LLM_BATCH_TIMEOUT_MINUTES default of 180min (D-08)
# No CELERY_RESULT_BACKEND set — durable state lives in SessionLogbook/SystemLog per AI-SPEC.md;
# tasks should set `ignore_result=True` unless a concrete need for Celery-native result storage emerges.

STT_LLM_ENABLED = env.bool('STT_LLM_ENABLED', default=False)  # D-04 feature flag, also gates STT (D-08 fallback)
STT_MODEL_SIZE = env('STT_MODEL_SIZE', default='small')       # D-01
STT_COMPUTE_TYPE = env('STT_COMPUTE_TYPE', default='int8')     # D-01
STT_LANGUAGE = env('STT_LANGUAGE', default='id')               # D-01
STT_MODEL_DOWNLOAD_ROOT = env('STT_MODEL_DOWNLOAD_ROOT', default='/app/storage/whisper_models')  # Pitfall 2
LLM_BATCH_TIMEOUT_MINUTES = env.int('LLM_BATCH_TIMEOUT_MINUTES', default=180)  # D-08
```

### Pattern 2: faster-whisper Loaded Once Per Celery Worker Process

**What:** Load `WhisperModel` exactly once per forked worker process (not per task call, not eagerly before fork) using Celery's `worker_process_init` signal.
**When to use:** Any Celery + CPU-bound-model integration; specifically required here to avoid the documented hang failure mode and to avoid re-paying the ~1-3s model-load cost on every single task.

```python
# Source: faster-whisper README (github.com/SYSTRAN/faster-whisper, fetched this session) +
#         Celery signals docs (docs.celeryq.dev/en/stable/userguide/signals.html) +
#         faster-whisper Celery-hang report (github.com/SYSTRAN/faster-whisper/issues/907)
# backend/apps/logbook/services/stt.py
from celery.signals import worker_process_init
from django.conf import settings

_model = None  # module-level global, one per forked worker process


@worker_process_init.connect
def load_whisper_model(**kwargs):
    """Load the model ONCE when each worker child process starts — never inside a task body,
    never before Celery forks (that would share one loaded model handle across forked children,
    which is exactly the pattern reported to hang in faster-whisper issue #907 under prefork)."""
    global _model
    from faster_whisper import WhisperModel
    _model = WhisperModel(
        settings.STT_MODEL_SIZE,          # "small" per D-01
        device="cpu",
        compute_type=settings.STT_COMPUTE_TYPE,  # "int8" per D-01
        download_root=settings.STT_MODEL_DOWNLOAD_ROOT,  # persistent volume — see Pitfall 2
    )


def get_model():
    if _model is None:
        # Fallback for contexts without the signal (e.g. eager/test mode) — not the hot path.
        load_whisper_model()
    return _model


def transcribe_audio(file_path: str) -> tuple[str, float]:
    """Returns (full_transcript_text, audio_duration_seconds)."""
    model = get_model()
    segments, info = model.transcribe(
        file_path,
        language=settings.STT_LANGUAGE,  # "id" — skip auto-detect per D-01
    )
    transcript = " ".join(segment.text.strip() for segment in segments)
    return transcript, info.duration
```

```python
# backend/apps/logbook/tasks.py
from celery import shared_task
from django.conf import settings
from django.utils import timezone

from .models import SessionLogbook
from .services.stt import transcribe_audio
from apps.bimbingan.models import SystemLog


@shared_task(bind=True, autoretry_for=(Exception,), retry_backoff=True, max_retries=2)
def transcribe_session(self, logbook_id: int):
    logbook = SessionLogbook.objects.select_related('session__recording').get(id=logbook_id)
    if not settings.STT_LLM_ENABLED:
        _fail(logbook, 'STT_DISABLED')
        return
    recording = logbook.session.recording
    try:
        transcript, duration = transcribe_audio(recording.file_path)
    except Exception as e:
        SystemLog.objects.create(
            level='ERROR', event_type='STT_FAILED',
            message=str(e), context={'logbook_id': logbook_id},
        )
        _fail(logbook, 'STT_FAILED')
        return
    logbook.transcript = transcript
    logbook.status = 'summarizing'
    logbook.save(update_fields=['transcript', 'status'])
    from .tasks import submit_summary_batch  # AI-SPEC.md task
    submit_summary_batch.delay(logbook.id)


def _fail(logbook, event_type: str):
    logbook.status = 'failed'
    logbook.save(update_fields=['status'])
    SystemLog.objects.create(level='ERROR', event_type=event_type, context={'logbook_id': logbook.id})
```

**Worker deployment command (Docker):**
```bash
# CPU-bound STT work benefits from the prefork pool sized to available cores — but oversubscription
# (model threads * worker concurrency > physical cores) causes contention, not speedup. Recommend
# starting conservative and tuning: concurrency=2, and constrain OMP threads per faster-whisper's own
# threading guidance (fetched this session) so 2 workers * N threads doesn't exceed core count.
celery -A config worker --loglevel=info --concurrency=2 -Q stt,llm
```

### Pattern 3: Jitsi Meet External API — What It Can and Cannot Give You (VIDEO-01/VIDEO-02)

**What:** Embed a Jitsi call via `@jitsi/react-sdk`'s `JitsiMeeting` component (thin wrapper over `JitsiMeetExternalAPI`), and understand precisely where its capabilities stop for VIDEO-02's dual-audio requirement.
**When to use:** Every online session (VIDEO-01). For VIDEO-02, use this pattern to confirm what's actually available before attempting D-16's full mixing approach.

```tsx
// Source: @jitsi/react-sdk README + jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe/
//         + dev-guide-react-sdk (fetched this session)
// frontend/src/components/video/JitsiVideoProvider.tsx
import { JitsiMeeting } from '@jitsi/react-sdk';

interface JitsiVideoProviderProps {
  roomName: string;       // e.g. `temudosen-session-${sessionId}`
  displayName: string;
  onApiReady?: (externalApi: any) => void;
}

export function JitsiVideoProvider({ roomName, displayName, onApiReady }: JitsiVideoProviderProps) {
  return (
    <JitsiMeeting
      domain="meet.jit.si"                 // D-12 — public instance for MVP/demo only
      roomName={roomName}
      configOverwrite={{ startWithAudioMuted: false, prejoinPageEnabled: false }}
      userInfo={{ displayName }}
      onApiReady={(externalApi) => {
        // externalApi exposes .executeCommand(), .addEventListener(), .dispose() — all metadata-level.
        // It does NOT expose a method returning a MediaStreamTrack/MediaStream for any participant
        // (own or remote) — confirmed against the IFrame API's documented functions/commands/events.
        externalApi.addEventListener('audioMuteStatusChanged', (e: { muted: boolean }) => { /* ... */ });
        onApiReady?.(externalApi);
      }}
      getIFrameRef={(iframeEl) => { iframeEl.style.height = '100%'; }}
    />
  );
}
```

**What IS achievable for VIDEO-02 within this stack (D-16's realistic scope):**
```typescript
// frontend/src/hooks/useDualAudioRecorder.ts
// The embedding page DOES have direct getUserMedia() access to the LECTURER'S OWN local mic
// (it's the app's own media device, requested by the app itself — nothing to do with Jitsi).
// It does NOT have access to the STUDENT'S remote track, because that track only exists inside
// the cross-origin meet.jit.si iframe's own WebRTC/DOM context.
const lecturerMicStream = await navigator.mediaDevices.getUserMedia({ audio: true });
// D-17 fallback path: record lecturerMicStream directly via MediaRecorder — identical to Phase 5's
// existing offline-session flow. This is achievable today, with the currently-locked stack (D-12).

// D-16's full mixing (`AudioContext` merging lecturer + remote tracks) requires a MediaStreamTrack
// for the remote participant that the External API cannot provide (see Common Pitfalls #8). This
// is NOT an implementation-effort problem to solve with more Web Audio API code — the input the
// code needs does not exist on this side of the iframe boundary.
```

**The only path to real dual-track access:** drop the iframe/External API and integrate `lib-jitsi-meet` directly, which exposes `JitsiTrack.getOriginalStream()` returning a real `MediaStream` for both local and remote tracks [CITED: github.com/jitsi/lib-jitsi-meet, jiyeyuran/lib-jitsi-meet/doc/API.md]. This requires: no iframe (the page speaks WebRTC/XMPP signaling directly to a Jitsi Meet deployment's videobridge), and in practice a self-hosted or JaaS-provisioned Jitsi backend rather than casually connecting to `meet.jit.si` at this protocol layer. This is a materially different, larger integration than what D-12 locked in, and should be surfaced as an explicit scope decision, not silently substituted or silently dropped.

### Anti-Patterns to Avoid

- **Loading `WhisperModel` inside the task function body:** Re-loads ~484MB of weights and re-initializes CTranslate2 on every single transcription call — works, but throws away the entire point of a persistent worker process and multiplies latency. Use `worker_process_init` (Pattern 2).
- **A single Celery task that submits the Anthropic batch AND polls it in a `while` loop with `time.sleep()`:** Already flagged in AI-SPEC.md Section 3 Pitfall #1 — confirmed independently here: Celery's own `eta`/`countdown` guidance explicitly discourages scheduling far into the future in one call, but the `submit`/`poll`-with-`self.retry(countdown=60)` split is exactly the pattern Celery's own internal chord-unlocking mechanism uses, so it's the correct, idiomatic approach, not a workaround.
- **Attempting D-16's dual-track mixing against the locked Jitsi External API stack without first re-confirming this constraint with the team:** the research is unambiguous (see Summary and Pattern 3) — this would burn implementation time on something structurally not possible with the current stack.
- **Running Celery's default `prefork` pool on native Windows for local (non-Docker) development:** Windows dropped fork support in the `billiard` package Celery depends on; `prefork` simply does not work there. Use `--pool=solo` for local Windows dev runs, or (preferred, and consistent with this project's existing docker-compose-first workflow) always run the Celery worker via `docker-compose`, which uses Linux containers where prefork works normally [CITED: celery.school/celery-on-windows + docs.celeryq.dev/en/latest/userguide/concurrency].

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CPU-optimized Whisper inference | Custom ONNX/CTranslate2 wrapper around raw Whisper weights | `faster-whisper` | Already does exactly this (CTranslate2 + int8 quantization) with a stable, documented Python API — no reason to re-derive it |
| Async job queue / retry/backoff | Custom polling table + cron | Celery (`autoretry_for`, `retry_backoff`, `self.retry(countdown=...)`) | Celery's retry primitives are exactly D-09's requirement; a hand-rolled retry-flag column reinvents what Celery already does correctly |
| Embedded video calling | Custom WebRTC signaling server | Jitsi Meet External API (`@jitsi/react-sdk`) | D-12 already settled this — a custom WebRTC stack is a multi-week undertaking Jitsi eliminates entirely for VIDEO-01 |
| Model weight download/caching | Custom Hugging Face Hub download logic | faster-whisper's built-in `download_root`/Hugging Face Hub integration | Already handles resumable downloads, revision pinning, and local-cache lookups — a custom downloader would just reimplement `huggingface_hub` |
| Job health/failure monitoring | New dedicated monitoring model/table | Existing `SystemLog` model, filtered by `event_type` | D-10 already locked this reuse — a new table duplicates what `SystemLog` already provides |

**Key insight:** every piece of this phase's new infrastructure (STT engine, task queue, video embedding) has a mature, purpose-built library already selected by CONTEXT.md's locked decisions. The actual engineering work in this phase is **integration and boundary discipline** (D-14's video-provider-agnostic pipeline, D-08's split-stage timeouts) — not building any of the three core capabilities from scratch.

---

## Common Pitfalls

### Pitfall 1: Blocking a Django View or Celery Worker on Batch/Model Wait
**What goes wrong:** Same failure family as AI-SPEC.md Section 3 Pitfall #1, but also applies to STT: if `transcribe_session` were called synchronously from `CompleteSessionView` instead of via `.delay()`, the HTTP request would hang for however long transcription takes (seconds to low minutes even at 7.6× realtime), defeating STT-02's "UI is not blocked" requirement.
**Why it happens:** It's tempting to call the transcription function directly during the "Selesai" upload handler since the result feels like it should be immediate.
**How to avoid:** `CompleteSessionView` must call `transcribe_session.delay(logbook_id)` and return immediately (D-06), exactly as AI-SPEC.md already specifies for the LLM stage.
**Warning signs:** Upload endpoint response times scale with audio length instead of staying constant.

### Pitfall 2: Model Weights Re-Downloaded on Every Container Restart
**What goes wrong:** faster-whisper downloads the `small` model (~484MB `model.bin` + tokenizer files) [CITED: huggingface.co/Systran/faster-whisper-small] from the Hugging Face Hub the first time `WhisperModel("small", ...)` is instantiated. If `download_root` isn't pointed at a path backed by a persistent Docker volume, every `docker-compose up` (or worker restart) silently re-downloads 484MB before the first transcription can run, adding minutes of cold-start latency and unnecessary bandwidth.
**Why it happens:** The default cache location (`~/.cache/huggingface/hub` or similar) lives inside the container's writable layer, which is discarded/rebuilt depending on how the image is built and volumes are mounted.
**How to avoid:** Either (a) mount a named volume at `STT_MODEL_DOWNLOAD_ROOT` (e.g. `/app/storage/whisper_models`) in `docker-compose.yml`, matching the existing `storage_data` volume pattern already used for `MEDIA_ROOT`, or (b) bake the model into the Docker image at build time with a `RUN python -c "from faster_whisper import WhisperModel; WhisperModel('small', compute_type='int8', download_root='/app/storage/whisper_models')"` step in the `Dockerfile`. Option (a) is simpler and keeps the image smaller; recommend it for this project's scale.
**Warning signs:** Every fresh container start has a multi-minute delay before the first STT job completes; unexpected egress/bandwidth usage on deploy.

### Pitfall 3: faster-whisper Hangs Under Celery's Prefork Pool
**What goes wrong:** A model loaded before Celery forks worker child processes (or loaded via a lazy singleton pattern that races across forked processes) can hang with no error message — reported independently by faster-whisper users running under Celery, on both CPU and GPU [CITED: github.com/SYSTRAN/faster-whisper/issues/907].
**Why it happens:** CTranslate2's internal threading state and any partially-initialized model object do not survive `fork()` cleanly if the model was loaded in the parent process before forking (a well-known general class of fork-safety bug, not specific to this library, but reported here).
**How to avoid:** Use the `worker_process_init` Celery signal to load the model strictly **after** each child process has forked (Pattern 2) — never load it at module-import time in the parent, and never inside the task body per-call either (Pitfall/Anti-pattern above).
**Warning signs:** Transcription tasks hang indefinitely with no exception, no log output, and no CPU/GPU activity after model load; only reproduces under the worker pool, not in a standalone script.

### Pitfall 4: Retry Ceiling Mismatched to Stage-Specific Timeout (D-08)
**What goes wrong:** Already flagged in AI-SPEC.md Section 7 — the `poll_summary_batch` task's `max_retries` must be derived from `LLM_BATCH_TIMEOUT_MINUTES` (180min default = 180 retries at a 60s countdown), not left at whatever default "felt reasonable" during initial implementation. The STT stage has its own, separate timeout (2× audio duration, min 5 minutes) that should NOT share a retry-count constant with the LLM stage — they are unrelated clocks (D-08).
**Why it happens:** Copy-pasting one task's retry configuration into the other, since they look structurally similar (both are "keep checking until done" tasks).
**How to avoid:** Compute each task's retry ceiling explicitly from its own env var (`LLM_BATCH_TIMEOUT_MINUTES` for the LLM stage; a duration-derived value for STT, though STT typically completes in one task call rather than needing to poll — see Pattern 2's `transcribe_session`, which is synchronous-within-the-task, not poll-based, since faster-whisper's `transcribe()` call is a normal blocking Python call within the worker, not an external async job).
**Warning signs:** Healthy LLM batches abandoned to manual notes well before 180 minutes; or STT timeouts not actually enforced because the value is hardcoded rather than duration-derived.

### Pitfall 5: CPU Thread Oversubscription Between Whisper and Celery Concurrency
**What goes wrong:** faster-whisper's CPU performance guidance notes you should "set the same number of threads" consistently (via `OMP_NUM_THREADS` or the `cpu_threads` constructor parameter) [CITED: github.com/SYSTRAN/faster-whisper]. If the Celery worker runs with `--concurrency=4` and each forked child also lets CTranslate2 use all available cores by default, 4 concurrent transcriptions can each try to claim all CPU cores simultaneously, causing contention that makes every job slower rather than enabling true parallelism.
**Why it happens:** `cpu_threads` and Celery `--concurrency` are two independent knobs that are easy to configure without considering their product against the host's actual core count.
**How to avoid:** Pick a Celery `--concurrency` for the STT queue conservatively (e.g. 1-2 for a modest CPU deployment) and/or set `cpu_threads` explicitly in the `WhisperModel(...)` constructor so `concurrency * cpu_threads` stays within the physical core count. Given this project's modest scale (~500 sessions/semester per AI-SPEC.md), a low-concurrency single-queue-per-worker setup is likely sufficient — resist over-provisioning concurrency preemptively.
**Warning signs:** Adding more Celery worker concurrency makes transcription jobs slower, not faster; high CPU load average with low actual throughput.

### Pitfall 6: `docker-compose.yml`'s Existing `web` Service Pattern Doesn't Auto-Extend to `celery-worker`
**What goes wrong:** The existing `web` service (`docker-compose.yml`) runs `migrate && seed_admin && gunicorn ...` as its startup command and shares the `./backend:/app` volume mount. A new `celery-worker` service needs the **same** codebase/volume mount and environment variables (especially `DATABASE_URL`, `STT_*`, `CELERY_BROKER_URL`) but a **different** command (`celery -A config worker ...`) and must depend on both `db` (for Django ORM access inside tasks) and the new `redis` service.
**Why it happens:** Easy to under-specify the new service by only copying `image`/`build` and forgetting the shared volume or a subset of the required env vars, causing tasks to fail with `ModuleNotFoundError` or missing settings at runtime rather than at container-start time.
**How to avoid:** Mirror the `web` service's `volumes` and `environment` blocks closely (see Code Examples for a full `docker-compose.yml` diff), differing only in `command` and the added `depends_on: redis`.
**Warning signs:** Celery worker container starts successfully but tasks fail with import errors or "settings not configured" the first time a task actually runs.

### Pitfall 7: Windows Local Dev — Celery Prefork Pool Doesn't Work Natively
**What goes wrong:** A developer tries to run `celery -A config worker` directly on a Windows machine (outside Docker) for a quick local test, and it either fails outright or behaves unpredictably, because Celery's default `prefork` pool requires OS-level `fork()`, which Windows/`billiard` no longer support [CITED: celery.school/celery-on-windows].
**Why it happens:** Celery's docs and most tutorials assume Linux/macOS; the Windows limitation is easy to miss until you hit it.
**How to avoid:** Always run the Celery worker via `docker-compose` (Linux container, prefork works normally) for this project — which is already this project's established workflow for `web`/`db`. If a developer genuinely needs a non-Docker local run on Windows, use `--pool=solo` explicitly.
**Warning signs:** Worker process exits immediately or throws `NotImplementedError` related to forking, only on Windows machines, never inside the Docker containers.

### Pitfall 8: Assuming the Jitsi External API Can Be Extended to Expose Raw Tracks (VIDEO-02)
**What goes wrong:** Spending implementation time trying to find an undocumented method, event, or configuration flag on `JitsiMeetExternalAPI`/`@jitsi/react-sdk` that returns the remote participant's `MediaStreamTrack` for Web Audio mixing (D-16). None exists, and none can be added without abandoning the iframe architecture entirely (see Summary and Pattern 3) — this is a structural, not incidental, limitation.
**Why it happens:** The task ("mix two audio tracks with the Web Audio API") sounds purely like a client-side coding problem, and Web Audio API code for *merging streams you already have* is genuinely simple — the gap is entirely in *obtaining* the second stream, not in mixing it once you have it.
**How to avoid:** Confirm D-17's fallback (lecturer-mic-only recording) as the actual shipped behavior for online sessions in this phase, unless the team explicitly commits to a `lib-jitsi-meet`-based rebuild (a materially larger, likely out-of-timeline scope change) as a deliberate decision — not something to discover mid-implementation.
**Warning signs:** Implementation time spent searching Jitsi's iframe API docs/GitHub issues for a "get remote track" method that isn't there.

---

## Code Examples

### `docker-compose.yml` additions (redis + celery-worker services)

```yaml
# Source: pattern mirrors this project's own existing `db`/`web` service style (verified by reading
# docker-compose.yml this session) + Celery/Redis Docker Compose conventions (multiple community
# sources, fetched this session — no single canonical "official" compose file exists for this pairing,
# so this follows the shape independently confirmed across several current tutorials)

services:
  # ...existing db, web services unchanged...

  redis:
    image: redis:7-alpine
    container_name: temudosen_redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  celery-worker:
    build: .
    container_name: temudosen_celery_worker
    restart: unless-stopped
    command: >
      sh -c "celery -A config worker --loglevel=info --concurrency=2 -Q stt,llm"
    volumes:
      - ./backend:/app
      - storage_data:/app/storage   # SAME volume as `web` — recordings + whisper model cache live here
    environment:
      - DJANGO_SETTINGS_MODULE=config.settings.docker
      - SECRET_KEY=docker-secret-key-ganti-di-production   # match `web`'s env exactly
      - DATABASE_URL=postgres://temudosen:temudosen123@db:5432/temudosen
      - MEDIA_ROOT=/app/storage
      - CELERY_BROKER_URL=redis://redis:6379/0
      - STT_LLM_ENABLED=False        # D-04 — default off until ANTHROPIC_API_KEY is provisioned
      - STT_MODEL_SIZE=small
      - STT_COMPUTE_TYPE=int8
      - STT_LANGUAGE=id
      - STT_MODEL_DOWNLOAD_ROOT=/app/storage/whisper_models
      - LLM_BATCH_TIMEOUT_MINUTES=180
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  postgres_data:
  storage_data:
  redis_data:      # NEW
```

*(Apply the equivalent addition to `docker-compose.dev.yml`, matching its `_dev` container-name/volume-name suffix convention.)*

### `backend/requirements.txt` additions

```
# STT, AI Summarization & Logbook (Phase 6)
faster-whisper==1.2.1
celery==5.6.3
redis==8.0.1
anthropic>=0.69          # per AI-SPEC.md
pydantic>=2.7            # per AI-SPEC.md
```

### faster-whisper duration capture (resolves D-02)

```python
# backend/apps/logbook/services/stt.py (continued from Pattern 2)
# info.duration (from WhisperModel.transcribe()'s TranscriptionInfo return value) gives the
# authoritative audio duration directly from the STT engine itself — no separate ffprobe/mutagen
# call needed. Persist this onto SessionRecording (D-02) the first time transcription runs:

def transcribe_and_persist_duration(recording, logbook):
    transcript, duration_seconds = transcribe_audio(recording.file_path)
    recording.duration_seconds = duration_seconds   # NEW field per D-02
    recording.save(update_fields=['duration_seconds'])
    return transcript
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `openai/whisper` reference implementation | `faster-whisper` (CTranslate2-based) | Ongoing since ~2023, still current best-practice for self-hosted CPU/GPU Whisper inference as of this research | 4× speed, lower memory, int8 CPU quantization support — makes CPU-only self-hosting realistic for the ≤2× duration NFR |
| Zoom/Google Meet external links for "online" sessions | In-app embedded Jitsi (External API) | This phase (v2.3 PRD amendment) | Enables server-side audio capture requirements (VIDEO-02) that an external link could never support — though the External API itself then can't fully satisfy VIDEO-02, see Summary |
| Single blocking task for async batch/job polling | Split submit/poll tasks with `self.retry(countdown=...)` | Established Celery best practice (matches Celery's own internal chord-unlocking implementation) | Prevents worker-pool exhaustion; already correctly reflected in AI-SPEC.md's task design |

**Deprecated/outdated:**
- Assuming `getUserMedia()`-style raw track access is available from any third-party embedded video iframe by default — modern browsers' cross-origin iframe isolation makes this a hard boundary regardless of the video vendor (Jitsi, Zoom, Google Meet, etc.) unless that vendor explicitly designs a lower-level SDK (like `lib-jitsi-meet`) for exactly this purpose.
- Native Windows Celery `prefork` workers — not supported since `billiard` dropped Windows fork support; Docker/Linux is the only reliable path for this project's existing docker-compose-first workflow anyway.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | faster-whisper's published CPU benchmark (13min audio -> 1m42s on an 8-thread desktop CPU, small+int8) is representative enough of the actual production/deployment CPU to comfortably clear the ≤2× duration NFR | Summary, Standard Stack | If the production server's CPU is significantly weaker (e.g. a low-core-count shared VPS), the safety margin shrinks — recommend a one-time benchmark on the actual target deployment hardware before relying on this number for the STT-02 SLA |
| A2 | A single Celery worker process handling both `stt` and `llm` queues at low concurrency is sufficient for this project's ~500 sessions/semester scale, rather than requiring separate dedicated workers per queue | Pattern 2, Pitfall 5 | If STT and LLM-polling tasks contend for the same limited worker slots during a burst of concurrent session completions, LLM polling (I/O-bound, cheap) could be starved by STT (CPU-bound, expensive) or vice versa — mitigated by using named queues (`-Q stt,llm`) now so splitting into separate worker processes later is a deployment change, not a code change |
| A3 | `django-celery-results` is NOT needed for this phase (Postgres via `SessionLogbook`/`SystemLog` is sufficient durable state) | Standard Stack | If the team later wants Celery-native task-result introspection (e.g. via Flower) for debugging, this is a low-cost addition to reverse — not a locked-in architectural risk |
| A4 | The Jitsi External API's documented event/function set (fetched from the official handbook this session) is complete and current — i.e., there is no newer, undocumented method that exposes remote track access | Architecture Patterns (Pattern 3), Common Pitfalls #8 | If Jitsi has since added such a capability that isn't yet reflected in the fetched handbook pages, the "hard constraint" framing in this document would be too pessimistic — recommend the planner do one confirming pass against the very latest `@jitsi/react-sdk`/External API changelog before treating D-17 as the final answer |
| A5 | `onnxruntime`'s current PyPI version (fetched as part of the transitive-dependency check) does not need independent pinning since faster-whisper's own dependency constraint (`<2,>=1.14`) governs it | Standard Stack | Low risk — if a future faster-whisper release changes this constraint incompatibly with another project dependency, `pip install` will surface a conflict at install time, not silently |

**If this table is empty:** N/A — see entries above.

---

## Open Questions

1. **Token/cost estimate display (D-11, carried from CONTEXT.md — not resolved by this research pass):** per-session cost, aggregate monthly spend, or both? Real-time computed or batched/cached? This is a product/UX decision for the Admin Dashboard, not a technical research gap — AI-SPEC.md Section 4b already provides the per-session cost math (~Rp 43-137/session) the dashboard would display; the open question is purely about presentation/aggregation, deferred to planner/discuss-phase discretion.

2. **VideoProvider abstraction reference (D-13, carried from CONTEXT.md):** confirmed by this research — no `VideoProvider`/`lib-jitsi-meet`/Daily.co code or design doc exists anywhere in this repo or was discoverable via search. Treat as a fresh design with no prior art, exactly as CONTEXT.md's D-13 already concluded.

3. **NEW from this research pass — the real decision point for VIDEO-02:** Does the team accept D-17's lecturer-mic-only recording as Phase 6's actual shipped behavior for online sessions (recommended, given the timeline already carrying Celery+Redis+faster-whisper+Jitsi+LLM in one phase), or does the team want to scope a `lib-jitsi-meet`-based rebuild (dropping the iframe, likely requiring self-hosted/JaaS Jitsi even for the "MVP/demo" tier) as an explicit, separately-estimated addition? This needs an explicit answer before Wave planning — recommend routing back through `/gsd-discuss-phase` or a direct product decision rather than the planner silently picking one.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Celery worker, Redis, all services (docker-compose deployment model) | Partial — Docker CLI installed, daemon not currently running on this dev machine at research time | Docker 29.1.3 (client) | Start Docker Desktop before running `docker-compose up`; not a blocker, just needs to be running |
| Python | Django, faster-whisper, Celery | Yes | 3.11.9 | — |
| Node.js | Frontend build, `@jitsi/react-sdk` | Yes | v22.20.0 | — |
| redis-cli | Local host-side Redis debugging (optional convenience) | No | — | Not required — Redis runs inside the `redis` Docker service; use `docker-compose exec redis redis-cli ping` instead of a host-installed client |
| ffmpeg (system) | Audio decoding for faster-whisper | Not required | — | `av` (PyAV), a faster-whisper dependency, bundles its own FFmpeg libraries — no system install needed [CITED: github.com/SYSTRAN/faster-whisper] |
| Anthropic API key | LLM summarization stage (D-04) | No — confirmed absent, expected (D-04: "assumed NOT YET present") | — | `STT_LLM_ENABLED=False` default keeps the whole pipeline gracefully disabled until provisioned (per D-04/D-08) |

**Missing dependencies with no fallback:**
- None — every gap above has a documented, already-planned fallback (Docker daemon just needs starting; API key absence is an anticipated, already-designed-for state).

**Missing dependencies with fallback:**
- Docker daemon not currently running locally — start before running compose commands, no code change needed.
- `ANTHROPIC_API_KEY` absent — `STT_LLM_ENABLED=False` is the designed default (D-04), not a blocker for STT-only work.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 9.1.x + pytest-django 4.12.x (existing project stack, confirmed in `backend/requirements.txt`) |
| Config file | `backend/pytest.ini` (existing from Phase 1) |
| Quick run command | `pytest tests/ -x -q -k "logbook or stt or celery"` |
| Full suite command | `pytest tests/ -v --tb=short` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STT-01 | `transcribe_session` task produces a transcript from a fixture audio file | integration (Celery `task_always_eager=True` in test settings) | `pytest tests/test_logbook_tasks.py::test_transcribe_session_success -x` | ❌ Wave 0 |
| STT-02 | Recorded audio duration is captured and stored on `SessionRecording` (D-02) | unit | `pytest tests/test_logbook_tasks.py::test_duration_persisted -x` | ❌ Wave 0 |
| STT-07 | STT failure (corrupt/missing audio file) transitions to `status=failed` + `SystemLog(event_type=STT_FAILED)` | integration | `pytest tests/test_logbook_tasks.py::test_transcribe_session_failure_logs_systemlog -x` | ❌ Wave 0 |
| STT-07 | STT timeout (simulated) falls back to manual notes editor path | integration | `pytest tests/test_logbook_tasks.py::test_stt_timeout_fallback -x` | ❌ Wave 0 |
| STT-05 | `SessionLogbook` created with correct FK/OneToOne linkage to `Session` | unit | `pytest tests/test_logbook_models.py::test_session_logbook_link -x` | ❌ Wave 0 |
| STT-06 | Student can GET their own approved logbook; cannot GET another student's | integration | `pytest tests/test_logbook_views.py::test_student_logbook_ownership -x` | ❌ Wave 0 |
| ADMIN-05 | Admin Dashboard endpoint returns STT/LLM `SystemLog` counts filtered by `event_type` | integration | `pytest tests/test_admin_dashboard.py::test_stt_llm_job_counts -x` | ❌ Wave 0 |
| VIDEO-01 | `JitsiVideoProvider` component mounts with correct `roomName`/`domain` props (frontend) | unit (Vitest/RTL) | `npm run test -- JitsiVideoProvider` | ❌ Wave 0 |
| VIDEO-02 | Online-session recording upload succeeds via the D-17 lecturer-mic-only fallback path (pending the Open Question #3 decision above) | integration | `pytest tests/test_session_recording.py::test_online_session_lecturer_mic_only_recording -x` | ❌ Wave 0 — **blocked on resolving Open Question #3 first** |

### Sampling Rate
- **Per task commit:** `pytest tests/ -x -q -k "logbook or stt or celery"`
- **Per wave merge:** `pytest tests/ -v --tb=short` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `backend/apps/logbook/` app scaffold (models, tasks, services, migrations) — does not exist yet
- [ ] `backend/config/celery.py` + `config/__init__.py` update — Celery app wiring (Pattern 1)
- [ ] Test settings: `CELERY_TASK_ALWAYS_EAGER = True` in `config/settings/test.py` so Celery tasks run synchronously in the test suite without requiring a live Redis broker
- [ ] `backend/tests/test_logbook_tasks.py`, `test_logbook_models.py`, `test_logbook_views.py` — new test files
- [ ] Fixture audio file(s) for STT integration tests (short, real or synthetic Indonesian speech clip)
- [ ] `docker-compose.yml`/`docker-compose.dev.yml` — `redis` + `celery-worker` service additions (Pattern 2/Code Examples) — required before any integration test that exercises the real broker (as opposed to eager mode)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited) | Existing DRF `SessionAuthentication` — no new auth surface introduced by Celery/Redis/faster-whisper/Jitsi |
| V3 Session Management | no (not touched) | This phase adds no new session-management surface |
| V4 Access Control | yes | `SessionLogbook` read/write endpoints must reuse the existing ownership-check pattern (student sees own logbook only; lecturer sees own advisees' only) — same discipline as Phase 1's `IsApprovedUser`/ownership pattern |
| V5 Input Validation | yes | Recording file path/MIME validation before it's ever passed to `transcribe_audio()` — reuse the existing `SessionRecording` upload validation (Phase 5), do not re-validate ad hoc in the Celery task |
| V6 Cryptography | yes — flagged risk | `SessionLogbook.transcript`/`summary_raw` must inherit the same "encrypted at rest" standard as `SessionRecording` per AI-SPEC.md — **but this project's existing encryption helper (Fernet/AES-128-CBC) does not meet the PROJECT.md-stated AES-256 requirement** (per CLAUDE.md's own NFR-03 audit note). Do not treat the existing pattern as a compliant reference implementation without flagging this gap to the planner. |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Redis exposed without auth/network isolation | Information Disclosure / Tampering | Do not publish the `redis` service's port to the host in `docker-compose.yml` (unlike `db`, which already exposes `5432` — Redis has no such requirement from any consumer outside the Docker network); rely on the internal Docker network only |
| Transcript/summary data leaving Indonesia to Anthropic's API | (Compliance, not STRIDE — flagged in AI-SPEC.md already) | Already addressed in AI-SPEC.md's UU PDP discussion — not re-derived here, only confirmed applicable |
| Malicious/oversized audio file crashing the STT worker | Denial of Service | Reuse Phase 5's existing `RECORDING_MAX_UPLOAD_SIZE` (100MB default) validation before a file ever reaches `transcribe_session`; faster-whisper itself has no built-in size guard |
| Third-party iframe (`meet.jit.si`) with no SLA/security guarantee handling sensitive 1:1 counseling audio/video | Information Disclosure | Already flagged as a known, accepted MVP-only limitation in `PROJECT.md`'s Key Decisions (D-12) — not a new finding, just confirmed still applicable and worth re-surfacing given this phase's session content is academic-advising, potentially sensitive, conversation |
| Celery task parameters (e.g. `logbook_id`) tampered via a compromised broker | Tampering | Redis broker should not be exposed outside the Docker network (see above); Celery task bodies should re-validate the referenced `SessionLogbook`/`Session` still belongs to a consistent, non-deleted record before acting on it (defensive, cheap) |

---

## Sources

### Primary (HIGH confidence — verified via official docs/registries this session)
- `pypi.org/project/faster-whisper/` — version 1.2.1 confirmed via `pip index versions`
- `pypi.org/project/ctranslate2/` — version 4.8.1 confirmed via `pip index versions`
- `pypi.org/project/celery/` — version 5.6.3 confirmed via `pip index versions`
- `pypi.org/project/redis/` — version 8.0.1 confirmed via `pip index versions`
- `pypi.org/project/django-celery-results/` — version 2.6.0 confirmed via `pip index versions`
- npm registry — `@jitsi/react-sdk` version 1.4.4, weekly downloads 23,587, confirmed via `gsd-tools query package-legitimacy check`
- `github.com/SYSTRAN/faster-whisper` (README, fetched via WebFetch this session) — install command, WhisperModel/transcribe() usage, CPU benchmark numbers, model download/caching behavior, threading guidance
- `github.com/SYSTRAN/faster-whisper/blob/master/faster_whisper/transcribe.py` (fetched via WebFetch) — `WhisperModel.__init__` full parameter list, `transcribe()` parameter list, `Segment`/`TranscriptionInfo` field names
- `github.com/SYSTRAN/faster-whisper/issues/907` (fetched via WebFetch) — documented Celery-hang failure mode
- `huggingface.co/Systran/faster-whisper-small` — model.bin size (~484MB) confirmed via WebSearch
- `docs.celeryq.dev/en/stable/django/first-steps-with-django.html` (fetched via WebFetch) — canonical `celery.py`/`__init__.py`/settings pattern
- `docs.celeryq.dev` (calling/tasks/canvas pages, via WebSearch) — `countdown`/`eta` scheduling guidance, chord `unlock_chord` polling pattern
- `jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe/` (fetched via WebFetch) — IFrame API function/command/event categories, confirmed no raw track access
- `jitsi.github.io/handbook/docs/dev-guide/dev-guide-iframe-events` (fetched via WebFetch) — full audio-related event list and payload shapes (metadata only)
- `github.com/jitsi/lib-jitsi-meet` + `github.com/jiyeyuran/lib-jitsi-meet/doc/API.md` (via WebSearch) — `getOriginalStream()`/`JitsiTrack` raw-track access confirmation
- `celery.school/celery-on-windows` (via WebSearch) — Windows prefork limitation, `--pool=solo` recommendation

### Secondary (MEDIUM confidence)
- `pypistats.org/packages/ctranslate2`, `pypistats.org/packages/redis` — weekly download figures (via WebSearch, third-party stats aggregator, not the registry itself)
- Multiple community Docker Compose + Celery + Django tutorials (via WebSearch, cross-referenced for the `redis`/`celery-worker` service pattern — no single official Celery+Docker-Compose reference exists, so this is triangulated across several current sources rather than one authoritative doc)

### Tertiary (LOW confidence — flagged explicitly)
- Exact production-CPU transcription speed for this project's actual deployment hardware — the 7.6× realtime figure is from the faster-whisper project's own published benchmark hardware (Intel i7-12700K), not this project's target server; treat as directionally strong evidence, not a guaranteed number (see Assumptions Log A1)
- `onnxruntime`'s exact current pinned version — not independently re-verified via `pip index versions` this session (only referenced via faster-whisper's own dependency metadata)

---

## Metadata

**Confidence breakdown:**
- Standard stack (faster-whisper/Celery/Redis): HIGH — all core package versions verified via `pip index versions`/npm registry this session; API usage confirmed via official README/source and official Celery docs
- Standard stack (Jitsi): MEDIUM-HIGH — `@jitsi/react-sdk` version/downloads verified via registry; the critical raw-track-access finding is confirmed via the official Jitsi handbook (events/functions pages) and cross-referenced against `lib-jitsi-meet`'s own API docs, but no MCP-based docs tool was available to do a deeper cross-check this session (see caveat at top of document)
- Architecture (Celery/Redis/faster-whisper integration): HIGH — patterns confirmed against official Celery Django-integration docs and faster-whisper's own README/source
- Architecture (Jitsi dual-audio): HIGH confidence in the **negative finding** (External API cannot expose remote raw tracks) — this is the single most load-bearing claim in this document and is corroborated by three independent sources (Jitsi's own iframe-events doc, iframe dev-guide overview, and `lib-jitsi-meet`'s own API doc describing what it uniquely provides that the iframe API does not)
- Pitfalls: HIGH — derived from a documented GitHub issue (faster-whisper/Celery hang), official Celery scheduling guidance, and this project's own existing `docker-compose.yml`/`requirements.txt` (read directly this session, not assumed)
- Package Legitimacy Audit: MEDIUM — automated seam produced false-positive `SUS` verdicts for several extremely well-established packages due to tooling limitations (see caveat in that section); manually cross-verified via independent download-stat sources and project provenance

**Research date:** 2026-07-05
**Valid until:** 2026-08-05 (30 days — package versions and, notably, the Jitsi IFrame API's documented capabilities should be re-checked if implementation is delayed past this window, since a Jitsi API change could in principle alter the VIDEO-02 finding)
