# Phase 5: Session Execution with Recording & Consent - Research

**Researched:** 2026-07-02
**Domain:** Browser audio capture (MediaRecorder Web API) + Django REST Framework multipart file upload + at-rest encryption, layered onto an existing session state machine
**Confidence:** MEDIUM

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Already Implemented — No New Decisions Needed**
- **D-01:** SESSION-01 (T-15 notification) — fully implemented in `apps/bimbingan/scheduler.py::check_h15_notifications` (runs every 1 min via APScheduler, sends when `scheduled_at` is 14–16 min out and `notification_sent=False`).
- **D-02:** SESSION-05 (auto-cancel, no-show >30min) — fully implemented in `apps/bimbingan/scheduler.py::check_auto_cancel` (runs every 5 min, cancels `WAITING` sessions past `scheduled_at + 30min` with `ts1__isnull=True`, notifies both parties, deletes calendar event, recalculates queue).
- **D-03:** SESSION-06 (offline/online + meeting link) — fully implemented. Dosen selects method + optional meeting link at **approval time** (`LecturerRequests.tsx`), stored on `Session.method` / `Session.meeting_link`. No new UI needed in Phase 5.
- **D-04:** Partial: `Session.ts1` + status transition `WAITING → IN_PROGRESS` already exists via `StartSessionView` (`POST /api/queue/<id>/start/`), triggered by a "Mulai" button on `LecturerDashboard.tsx`. This button currently does NOT gate on consent and does NOT record audio — it only timestamps and notifies. Phase 5 extends this existing endpoint/button rather than building a new one from scratch.

**Consent Flow (SESSION-02)**
- **D-05:** Consent is captured as part of the existing "Mulai & Rekam" action (renamed from "Mulai") — not a separate pre-step page. Clicking the button opens a consent modal first; only on confirm does `ts1` get set and recording start.
- **D-06:** Single confirmation by the lecturer on behalf of both parties (dosen + mahasiswa share the same device/room during an in-person session — this matches how `method`/offline sessions work). No separate student-side consent action.
- **D-07:** If consent is declined: session still starts normally (`ts1` recorded, status → `IN_PROGRESS`) but flagged as "no recording" — functionally identical to today's plain "Mulai" behavior. Session is never blocked by a consent refusal.
- **D-08:** Consent is asked every session (no "always allow" / remembered-consent state for a dosen-mahasiswa pair) — matches SESSION-02's "explicit... before the session begins" wording and avoids a new persistence concept.

**Audio Recording (part of SESSION-03)**
- **D-09:** Recorded client-side via the browser's native `MediaRecorder` API in **WebM/Opus** — no client-side transcoding. This format is directly consumable by faster-whisper in Phase 6.
- **D-10:** Recording is buffered in the browser for the session's duration and uploaded as a **single file** when "Selesai" is pressed — no chunked/incremental upload. Mirrors the existing PDF-upload pattern (D-26/D-27 from Phase 1: local disk storage, UUID-based filename, no guessable path).
- **D-11:** No hard duration/size cap for MVP — sessions are already bounded by symptom-weight-estimated duration (typically 15–60 min); only a soft warning if a session runs unusually long. Revisit if real usage shows a problem.
- **D-12:** If the browser denies microphone permission, the session is NOT blocked — it proceeds exactly like a declined-consent session (`ts1` recorded, no recording, dosen notified inline that recording failed/unavailable).

**Session Completion / TS2 (SESSION-04)**
- **D-13:** "Selesai" lives on a **dedicated active-session page** (not just a button-swap on the existing dashboard/queue list) — this page also hosts the recording indicator ("Merekam…") required by PROJECT.md's Constraints section.
- **D-14:** Manual notes are entered via a short textarea inside a confirmation modal shown when "Selesai" is pressed — not a separate later-editable field.
- **D-15:** Manual notes remain fully optional even when there is no recording (declined consent or mic failure) — the session can close with zero documentation if the dosen chooses.
- **D-16:** New `Session.ts2` field required (does not exist yet) — analogous to existing `Session.ts1`. New endpoint (e.g., `POST /api/queue/<id>/complete/`) sets `ts2`, transitions status `IN_PROGRESS → DONE`, accepts the uploaded audio file + optional manual notes.

### Claude's Discretion
- Exact consent modal copy/wording (Indonesian) — follow existing UI copy tone (see `LoginPage.tsx`, `RegisterStudentPage.tsx` for house style).
- Where the recording indicator ("Merekam…") is visually placed on the active-session page — PROJECT.md only requires it be "clearly visible."
- Whether the active-session page is a new route (e.g., `/dosen/session/:id`) or a modal-over-dashboard — planner decides based on existing router.tsx conventions (see `/dosen/requests`, `/dosen/queue` pattern).
- Exact recovery behavior if the dosen navigates away / refreshes mid-recording (browser tab close would lose an in-memory, non-chunked recording) — flag as a risk for the planner to address, no user preference captured.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within Phase 5 scope. Chunked/incremental audio upload and per-pair "remembered consent" were both raised as alternatives during discussion and explicitly rejected for MVP — noted here so a future phase doesn't need to re-litigate them without cause.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SESSION-01 | T-15 notification to student before turn | Already implemented — `check_h15_notifications`; no research needed, confirmed present and correct. |
| SESSION-02 | Explicit recording-consent prompt before session; session proceeds without recording if declined | See Architecture Patterns → Pattern 1 (Consent Modal), Code Examples, Security Domain (V6, consent-flag tampering note). |
| SESSION-03 | Single "Mulai & Rekam" button: log TS1 + start audio recording | See Architecture Patterns → Pattern 2 (MediaRecorder hook), Common Pitfalls #1/#2/#6, Code Examples. |
| SESSION-04 | "Selesai" stops recording + logs TS2; optional manual notes | See Architecture Patterns → Pattern 3 (Complete endpoint + upload), Common Pitfalls #3/#4/#5/#9, Code Examples. |
| SESSION-05 | Auto-cancel no-show after 30 min | Already implemented — `check_auto_cancel`; no research needed, confirmed present and correct. |
| SESSION-06 | Offline/Online method + meeting link | Already implemented — `LecturerRequests.tsx` + `Session.method`/`meeting_link`; no research needed. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

`./CLAUDE.md` at the workspace root (`E:\Proyek S4\CLAUDE.md`) is a generic multi-project workspace default (it references `library-management` and `gsd-new-project` folders, neither of which exists in this TemuDosen repo — this repo's actual folders are `backend/`, `frontend/`, `.planning/`). Its directives are process-level, not code-specific, and do not conflict with anything in this research:

- Make the smallest change that solves the request — favors extending `StartSessionView`/`LecturerDashboard.tsx` in place (as this research recommends) over introducing parallel new flows.
- Keep edits focused on the relevant folder, avoid touching unrelated files — Phase 5 work should stay within `backend/apps/bimbingan/` and `frontend/src/{pages/lecturer,components,hooks,api}/`; do not touch `apps/submissions` (only mirror its patterns, don't modify it) unless a genuine shared utility is extracted.
- If verifying behavior, run the narrowest relevant check first — matches the "Sampling Rate" guidance in this document's Validation Architecture section (targeted `pytest`/`vitest` runs per task, full suite per wave/phase gate).

No project-specific coding conventions, forbidden patterns, or required-tool directives were found in this CLAUDE.md beyond the above.

## Summary

Three of six Phase 5 requirements (SESSION-01, SESSION-05, SESSION-06) are already fully implemented and verified present in `apps/bimbingan/scheduler.py` and `LecturerRequests.tsx` — this research does not revisit them. The genuinely unbuilt work is: (1) a consent gate in front of the existing "Mulai" action, (2) real client-side audio capture via the browser's native `MediaRecorder` API in WebM/Opus, and (3) a new session-completion flow that stops recording, timestamps `ts2`, uploads the recorded audio as a single multipart file, and accepts optional notes.

The codebase already contains a directly-reusable blueprint for every piece of this: `StartSessionView` is the template for a new `CompleteSessionView` (same ownership-check + `SystemLog` + notify pattern); `apps/submissions`' validate-before-write, UUID-filename, auth-gated-serving pattern (`serve_submission_file`) is the template for audio storage and serving; and `frontend/src/api/submissions.ts::createSubmission` is the exact template for the raw-`fetch`-with-`FormData` multipart upload pattern the "Selesai" action needs (the shared `apiRequest` wrapper forces `Content-Type: application/json` and must NOT be used for the file upload call).

One requirement is **not** covered by any existing pattern and needs new engineering: PROJECT.md's constraint that "audio recordings and transcripts stored encrypted AES-256" is **not** satisfied by the existing `DosenCalendarToken` Fernet-based encryption pattern — Fernet is AES-**128**-CBC, not AES-256. A new AES-256-GCM encrypt/decrypt helper (using `cryptography.hazmat.primitives.ciphers.aead.AESGCM`, already available in the installed `cryptography==44.*` dependency — no new package needed) must be built for audio files specifically; the existing plaintext-on-disk PDF pattern is not sufficient for audio.

**Primary recommendation:** Extend `StartSessionView`/`LecturerDashboard.tsx` with a consent modal + `MediaRecorder`-backed recording hook that gracefully degrades to "no recording" on decline/permission-denial/codec-unsupported (same code path for all three); build a new `CompleteSessionView` on a dedicated `/dosen/session/:id` page that accepts a single multipart POST (`ts2` handled server-side, audio Blob + optional notes text field), mirroring `apps/submissions`' validate-then-write-then-encrypt pattern; use `AESGCM` (not Fernet) for AES-256 at-rest encryption of the stored audio file.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Consent prompt & decision | Browser / Client | API / Backend | UI lives client-side (modal); the boolean decision must be persisted server-side (`consent_given` on `Session`) per NFR-08 ("captured and stored"). |
| Audio capture (MediaRecorder) | Browser / Client | — | `getUserMedia`/`MediaRecorder` are browser-only APIs; no server involvement until upload. |
| TS1/TS2 timestamping | API / Backend | — | Server clock is authoritative (matches existing `ts1` pattern in `StartSessionView` — `timezone.now()` set server-side, not trusted from client). |
| Audio upload | Browser / Client → API / Backend | — | Single multipart POST from client; backend validates + persists. |
| Audio storage & AES-256 encryption | API / Backend | Database / Storage | Encryption key material and encrypt/decrypt logic must live server-side (mirrors `DosenCalendarToken` token-encryption pattern, upgraded to AES-256). |
| Protected audio serving (Phase 6 consumption) | API / Backend | — | Must reuse the auth-gated-route pattern (`serve_submission_file`), never a direct/guessable media URL (D-29). |
| Recording indicator UI ("Merekam…") | Browser / Client | — | Pure presentational state driven by `MediaRecorder.state`. |
| Session completion notes | Browser / Client | API / Backend | Textarea input client-side; persisted as a `Session`/related-model field server-side. |
| 30-min no-show auto-cancel | API / Backend (scheduler) | — | Already implemented (`check_auto_cancel`), unaffected by Phase 5 changes. |

## Standard Stack

### Core

No new external packages are required for this phase — both the browser recording capability and the backend cryptography primitive already exist in the codebase's dependency set.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `MediaRecorder` (Web API, native browser) | N/A — browser built-in | Client-side audio capture to WebM/Opus | Native, zero-dependency, W3C-specified (`MediaStream Recording` spec); locked by D-09. `[CITED: developer.mozilla.org/en-US/docs/Web/API/MediaRecorder]` |
| `cryptography` (Python) | 44.0.3 (already installed, `requirements.txt: cryptography==44.*`) | AES-256-GCM encrypt/decrypt of stored audio files via `AESGCM` | Already a project dependency (used today for Fernet-based calendar-token encryption); its `hazmat.primitives.ciphers.aead.AESGCM` submodule provides audited AES-256-GCM without adding a new package. `[VERIFIED: pip — cryptography==44.0.3 installed in backend/.venv]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `python-magic` (already conditionally used in `apps/submissions/serializers.py`) | existing | Magic-bytes MIME sniff, with a manual-header fallback when libmagic DLL is unavailable | Reuse the exact `_MAGIC_AVAILABLE` try/except fallback pattern to validate uploaded audio is actually WebM (`b'\x1a\x45\xdf\xa3'` EBML header) rather than trusting the client `Content-Type`/extension. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `MediaRecorder` | `RecordRTC` / `opus-media-recorder` (polyfill libraries) | Adds an npm dependency and client-side WASM Opus encoder; unnecessary since D-09 already locked native `MediaRecorder` and target browsers (Chrome/Edge/Firefox — the realistic desktop dosen environment) support `audio/webm;codecs=opus` natively. Not recommended; documented only because Safari lacks WebM support (see Pitfall #2). |
| `AESGCM` (AES-256-GCM) | Reusing the existing `Fernet` helper from `calendar.py` | Fernet is AES-**128**-CBC, not AES-256 — does not satisfy PROJECT.md's explicit AES-256 constraint. Do not copy the calendar-token pattern verbatim for audio. |
| Single non-chunked upload (D-10, locked) | Chunked/resumable upload (e.g., tus protocol) | Explicitly rejected by the user during discussion (see Deferred Ideas) — more robust against connection drops but adds real complexity; out of scope for MVP. |

**Installation:** None — no `pip install` / `npm install` needed for this phase's core capability.

**Version verification:** `cryptography==44.0.3` confirmed installed via `backend/.venv/Scripts/python.exe -c "import cryptography; print(cryptography.__version__)"` on 2026-07-02. `[VERIFIED: local venv]`

## Package Legitimacy Audit

No new external packages are introduced by this phase. `cryptography` is already installed and in `requirements.txt`; `MediaRecorder` is a browser built-in, not an installable package. This section is included per protocol but has no findings to report.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `cryptography` | PyPI | Long-established (pyca project) | Very high | github.com/pyca/cryptography | OK | Already installed — no new install action |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────┐
│ LecturerDashboard.tsx    │  "Mulai & Rekam" button (idx 0 in queue)
│  (existing, extend)      │
└────────────┬─────────────┘
             │ click
             ▼
┌─────────────────────────┐
│ ConsentModal             │  new component
│  "Sesi ini akan direkam" │
└────┬──────────────┬──────┘
     │ setuju        │ tolak / batal
     ▼               ▼
┌─────────────────┐   ┌───────────────────────────┐
│ getUserMedia +   │   │ (skip recording branch)    │
│ MediaRecorder     │   │ consent_given=false         │
│ .start()          │   └──────────────┬──────────────┘
└────────┬─────────┘                  │
         │ (also: permission denied,   │
         │  codec unsupported → same   │
         │  no-recording branch)       │
         ▼                             ▼
┌───────────────────────────────────────────────────┐
│ POST /api/queue/<id>/start/                         │
│  body: { consent_given }                             │
│  server: ts1 = now(), status → IN_PROGRESS           │
└───────────────────────┬───────────────────────────┘
                         ▼
┌───────────────────────────────────────────────────┐
│ Active Session Page  (new route /dosen/session/:id)  │
│  - "Merekam…" indicator (if recording)                │
│  - optional periodic requestData() → in-memory buffer │
│  - "Selesai" button                                   │
└───────────────────────┬───────────────────────────┘
                         │ click "Selesai"
                         ▼
┌───────────────────────────────────────────────────┐
│ MediaRecorder.stop() → final Blob assembled          │
│ Confirmation modal: optional notes textarea           │
└───────────────────────┬───────────────────────────┘
                         │ confirm
                         ▼
┌───────────────────────────────────────────────────┐
│ POST /api/queue/<id>/complete/  (multipart, raw fetch, │
│   NOT apiRequest — no forced JSON Content-Type)        │
│   fields: audio_file (Blob|absent), notes (text)       │
└───────────────────────┬───────────────────────────┘
                         ▼
┌───────────────────────────────────────────────────┐
│ CompleteSessionView (new, mirrors StartSessionView)   │
│  - ownership + status==IN_PROGRESS guard               │
│  - validate audio (magic bytes, size) if present        │
│  - encrypt with AESGCM (AES-256) → UUID filename         │
│  - ts2 = now(), status → DONE                             │
│  - SystemLog + notify_student/notify_lecturer               │
└───────────────────────┬───────────────────────────┘
                         ▼
┌───────────────────────────────────────────────────┐
│ Protected audio serving route (new, mirrors            │
│  serve_submission_file) — decrypt-on-read,               │
│  ownership-checked — consumed by Phase 6 STT pipeline      │
└───────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
backend/apps/bimbingan/
├── models.py               # add: ts2, consent_given, recording_status to Session
├── migrations/
│   └── 0002_session_ts2_consent_recording.py   # new migration (only 0001 exists today)
├── views.py                 # extend StartSessionView (consent_given input); add CompleteSessionView
├── serializers.py           # add CompleteSessionSerializer (mirrors SubmissionCreateSerializer's validate-then-save pattern)
├── services/
│   └── audio_crypto.py      # new: AESGCM encrypt_audio()/decrypt_audio() helpers (NOT calendar.py's Fernet)
└── urls.py                  # add: <id>/complete/, and an audio-file serving route (own app or reuse submissions' file pattern)

frontend/src/
├── pages/lecturer/
│   ├── LecturerDashboard.tsx     # extend: rename "Mulai" → "Mulai & Rekam", open ConsentModal first
│   └── ActiveSession.tsx          # new: dedicated page hosting "Merekam…" indicator + "Selesai"
├── components/
│   └── ConsentModal.tsx           # new: consent prompt (D-05/D-06/D-07)
├── hooks/
│   └── useMediaRecorder.ts        # new: encapsulates getUserMedia + MediaRecorder lifecycle + graceful degradation
├── api/
│   └── sessions.ts                 # extend: startSession(id, {consent_given}), completeSession(id, formData) — raw fetch, not apiRequest
└── router.tsx                      # add: { path: 'session/:id', element: <ActiveSession /> } under /dosen
```

### Pattern 1: Consent Modal (SESSION-02)

**What:** A blocking modal shown when "Mulai & Rekam" is clicked, before any recording starts or `ts1` is set. Two outcomes both proceed to start the session (D-07) — only the recording branch differs.

**When to use:** Every session start (D-08 — no remembered consent).

**Example (React, following house copy style from `LoginPage.tsx`):**
```tsx
// ConsentModal.tsx — Source: pattern derived from D-05/D-06/D-07/D-12 in 05-CONTEXT.md
function ConsentModal({ onDecision }: { onDecision: (consent: boolean) => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-5 space-y-4">
        <h2 className="font-headline font-bold text-lg text-slate-900">
          Rekam Sesi Bimbingan Ini?
        </h2>
        <p className="text-sm text-neutral-gray">
          Sesi akan direkam untuk transkrip &amp; ringkasan otomatis. Sesi tetap dapat
          berjalan tanpa rekaman jika Anda memilih tidak merekam.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => onDecision(false)}
            className="flex-1 min-h-[44px] rounded-xl border border-gray-200 font-bold text-sm text-slate-700"
          >
            Tidak, Lanjutkan Tanpa Rekam
          </button>
          <button
            type="button"
            onClick={() => onDecision(true)}
            className="flex-1 min-h-[44px] rounded-xl bg-primary text-white font-bold text-sm"
          >
            Ya, Rekam Sesi
          </button>
        </div>
      </div>
    </div>
  );
}
```

### Pattern 2: `useMediaRecorder` hook with graceful degradation (SESSION-03)

**What:** Encapsulates `getUserMedia` + `MediaRecorder` with a single unified failure path covering consent-decline, permission-denial, AND codec-unsupported (the "no-recording" state must look identical from the dosen's perspective, per CONTEXT.md's `<specifics>` note).

**When to use:** On confirming consent in the modal (or skip entirely if consent was declined).

**Example:**
```ts
// useMediaRecorder.ts — Source: pattern synthesized from MediaRecorder/getUserMedia MDN docs
// [CITED: developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API]
const CANDIDATE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
]; // D-09 locks WebM/Opus; fallback list only guards against a missing codecs= negotiation, not format substitution

async function startRecording(): Promise<{ recorder: MediaRecorder; stream: MediaStream } | null> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    // NotAllowedError (permission denied) or NotFoundError (no mic) — D-12: no-recording fallback
    return null;
  }

  const mimeType = CANDIDATE_MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  if (!mimeType) {
    // e.g. Safari — audio/webm is not supported at all — same no-recording fallback as D-12
    stream.getTracks().forEach((t) => t.stop());
    return null;
  }

  const recorder = new MediaRecorder(stream, { mimeType });
  recorder.start(); // no timeslice arg needed for D-10's single-blob-on-stop model
  return { recorder, stream };
}

function stopRecording(recorder: MediaRecorder, stream: MediaStream): Promise<Blob> {
  return new Promise((resolve) => {
    const chunks: Blob[] = [];
    recorder.addEventListener('dataavailable', (e) => { if (e.data.size > 0) chunks.push(e.data); });
    recorder.addEventListener('stop', () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: recorder.mimeType }));
    });
    recorder.stop();
  });
}
```

### Pattern 3: Multipart "complete" upload — client (SESSION-04)

**What:** Mirrors `frontend/src/api/submissions.ts::createSubmission` exactly — raw `fetch` with `FormData`, NOT the shared `apiRequest` wrapper (which force-sets `Content-Type: application/json`, breaking multipart boundary negotiation).

**Example:**
```ts
// api/sessions.ts — Source: mirrors existing createSubmission() pattern in api/submissions.ts
import { getCsrfToken } from './client';

export async function completeSession(
  sessionId: number,
  payload: { audioBlob: Blob | null; notes?: string }
): Promise<{ message: string; ts2: string }> {
  const formData = new FormData();
  if (payload.audioBlob) {
    formData.append('audio_file', payload.audioBlob, 'session.webm');
  }
  if (payload.notes) {
    formData.append('notes', payload.notes);
  }

  const response = await fetch(`/api/queue/${sessionId}/complete/`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-CSRFToken': getCsrfToken() }, // no Content-Type — browser sets multipart boundary
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(JSON.stringify(error));
  }
  return response.json();
}
```

### Pattern 4: Complete endpoint — server (SESSION-04, D-16)

**What:** Mirrors `StartSessionView`'s ownership-check + status-guard + `SystemLog` + notify pattern, extended with file validation and AES-256 encryption before disk write (mirrors `SubmissionCreateSerializer.save_file`, but adds an encryption step the PDF pattern does not have).

**Example (sketch, not exhaustive):**
```python
# views.py — mirrors StartSessionView (backend/apps/bimbingan/views.py:554-592)
class CompleteSessionView(APIView):
    """POST /api/queue/<id>/complete/ — Dosen selesai sesi (set ts2, status → DONE)."""
    permission_classes = [IsLecturer]

    def post(self, request, pk):
        session = get_object_or_404(
            Session.objects.select_related('submission__student__adviser'), pk=pk
        )
        if session.submission.student.adviser != request.user:
            return Response({'detail': 'Anda tidak memiliki izin.'}, status=403)
        if session.status != Session.Status.IN_PROGRESS:
            return Response(
                {'detail': 'Hanya sesi Berlangsung yang dapat diselesaikan.'}, status=400
            )

        serializer = CompleteSessionSerializer(data=request.data, context={'request': request})
        if not serializer.is_valid():
            return Response(serializer.errors, status=400)

        session.ts2 = timezone.now()
        session.status = Session.Status.DONE
        # serializer.save() handles: validate audio (if present) → encrypt (AESGCM) → write UUID-named
        # ciphertext file → create SessionRecording row; notes saved to session/related model
        serializer.save(session=session)
        session.save(update_fields=['ts2', 'status', 'updated_at'])

        SystemLog.objects.create(
            level=SystemLog.Level.INFO, event_type='SESSION_COMPLETED',
            message=f'Sesi #{session.id} diselesaikan oleh {request.user.email}',
            context={'session_id': session.id, 'had_recording': bool(request.FILES.get('audio_file'))},
        )
        return Response({'message': 'Sesi berhasil diselesaikan.', 'ts2': session.ts2.isoformat()})
```

### Anti-Patterns to Avoid

- **Setting `ts1`/`ts2` from client-supplied timestamps:** Both existing `StartSessionView` and the new complete endpoint must use server `timezone.now()` — never trust a client-sent timestamp (a slow/paused browser tab could send an inaccurate value).
- **Reusing `apiRequest()` for the audio upload:** It force-sets `Content-Type: application/json`, which breaks multipart boundary negotiation. Always use raw `fetch` + `FormData` for this call, exactly like `createSubmission`.
- **Reusing the `Fernet`/`calendar.py::encrypt_token` helper for audio:** That helper is AES-128-CBC, not AES-256 — does not satisfy PROJECT.md's explicit constraint. Build a separate `AESGCM`-based helper.
- **Storing the consent decision only client-side (e.g., in component state, never sent to the server):** NFR-08 requires consent be "captured and stored" — `consent_given` must be a persisted field on `Session`, sent in the `/start/` request body.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Audio capture/encoding | A custom `AudioContext`-based PCM recorder + manual WebM muxer | Native `MediaRecorder` API (already locked, D-09) | `MediaRecorder` already produces a valid WebM/Opus container; hand-rolling a muxer is a well-known multi-week rabbit hole and completely unnecessary here. |
| AES-256 encryption | A custom AES implementation or ad-hoc XOR/base64 "obfuscation" | `cryptography.hazmat.primitives.ciphers.aead.AESGCM` (already an installed dependency) | Authenticated-encryption primitives are notoriously easy to get wrong (nonce reuse, padding oracle, missing MAC); `cryptography` is the audited, standard library-level building block. `[CITED: cryptography.io/en/latest/hazmat/primitives/aead]` |
| Multipart file + text field parsing | A custom request-body parser | DRF's built-in `MultiPartParser` (already the default parser used by `SubmissionCreateSerializer`) | DRF already handles multipart boundaries, `request.FILES`, and `request.data` correctly; the existing `apps/submissions` pattern is proof it works for this exact shape of request (file + scalar fields together). |
| Cross-browser codec negotiation | Hardcoding `'audio/webm;codecs=opus'` and letting construction throw on unsupported browsers | `MediaRecorder.isTypeSupported()` fallback-list check before construction | Safari does not support WebM at all; an uncaught `MediaRecorder` constructor exception would crash the recording flow instead of gracefully falling back to "no recording" per D-12's intent. |

**Key insight:** Every piece of this phase's genuinely new work (consent gate, recording, upload, encryption) has either a native browser primitive or an existing in-repo pattern to mirror. The only place a bespoke decision is required is the AES-256 encryption helper, and even that should be built from an existing audited primitive (`AESGCM`), not from scratch.

## Common Pitfalls

### Pitfall 1: `apiRequest()` wrapper breaks multipart uploads
**What goes wrong:** Using the shared `apiRequest()` helper for the "Selesai" upload silently corrupts the request — it force-sets `Content-Type: application/json` on every call, which prevents the browser from setting the correct `multipart/form-data; boundary=...` header.
**Why it happens:** `apiRequest()` was designed for JSON API calls; the project's own `createSubmission()` already documents this exact trap in a comment (`api/submissions.ts` lines 9-13).
**How to avoid:** Use raw `fetch()` with `FormData` and manually set only `X-CSRFToken` + `credentials: 'include'`, exactly like `createSubmission()`.
**Warning signs:** DRF returns 400 with "no file was submitted" or similar even though `FormData.append('audio_file', blob)` looks correct in devtools.

### Pitfall 2: Safari does not support `audio/webm`
**What goes wrong:** `new MediaRecorder(stream, {mimeType: 'audio/webm;codecs=opus'})` throws `NotSupportedError` on Safari (macOS 14.1+/iOS 14.5+ Safari only writes `audio/mp4` with AAC, never WebM).
**Why it happens:** WebM container support is a Chromium/Firefox thing; Safari's `MediaRecorder` implementation only emits MP4/AAC. `[CITED: developer.chrome.com/blog/mediarecorder — cross-browser MIME type differences]`
**How to avoid:** Always guard construction with `MediaRecorder.isTypeSupported(mimeType)` first; if unsupported, route through the exact same no-recording fallback UI as D-12 (permission-denied) rather than crashing. D-09 (WebM/Opus, locked) is not renegotiated by this — it just means Safari dosen sessions will run without recording, which is an acceptable and already-designed-for fallback path, not a new decision.
**Warning signs:** Uncaught exception in the browser console the first time a Safari user clicks "Mulai & Rekam"; recording silently never starts on iPad/Mac dosen devices.

### Pitfall 3: Complete endpoint must guard on `IN_PROGRESS`, not `WAITING`
**What goes wrong:** Copying `StartSessionView`'s guard (`if session.status != Session.Status.WAITING`) verbatim into the new complete endpoint would make it impossible to ever complete a session — the correct guard is `status != IN_PROGRESS`.
**Why it happens:** Easy copy-paste error when mirroring the existing view as a template.
**How to avoid:** Explicitly test (in the plan's verification step) that `complete/` returns 400 on a `WAITING` or already-`DONE` session, and 200 only from `IN_PROGRESS` — matching the documented one-way state machine (`WAITING → IN_PROGRESS → DONE/CANCELLED`) in PROJECT.md's Constraints.
**Warning signs:** A test asserting "cannot complete a session twice" fails, or a stray `WAITING` session gets marked `DONE` without ever having `ts1` set.

### Pitfall 4: `DATA_UPLOAD_MAX_MEMORY_SIZE`/`FILE_UPLOAD_MAX_MEMORY_SIZE` are sized for 5MB PDFs, not 15-60 min audio
**What goes wrong:** `backend/config/settings/base.py` currently sets both to `6 * 1024 * 1024` (6MB) — sized specifically for the 5MB PDF limit plus headroom (per its own comment, "Pitfall 6"). A 30-60 minute WebM/Opus recording at a typical ~32-64kbps voice bitrate is roughly 7-29MB, which will exceed this ceiling.
**Why it happens:** The constant was set in Phase 1 for a different, smaller upload type and never revisited.
**How to avoid:** Raise both settings (e.g., to 50MB) for the audio upload, or introduce a per-view override; confirm the new limit comfortably covers D-11's "no hard cap, only a soft warning for unusually long sessions" policy.
**Warning signs:** `RequestDataTooBig` / 400 errors on completing longer real sessions in staging, despite working fine in short local tests.

### Pitfall 5: Reusing Fernet (AES-128) does not satisfy the AES-256 constraint
**What goes wrong:** The most "obvious" reuse — copying `calendar.py::encrypt_token`/`_get_fernet()` for audio files — silently under-delivers on security: Fernet is AES-**128**-CBC + HMAC-SHA256, not AES-256, despite using a 32-byte key internally (split into two 16-byte halves). `[CITED: cryptography.io/en/latest/fernet — "Fernet... AES in CBC mode with a 128-bit key"]`
**Why it happens:** The 32-byte Fernet key length is easy to mistake for "AES-256" if you don't read the spec closely.
**How to avoid:** Build a separate helper using `AESGCM(key)` with a genuine 32-byte AES-256 key, a per-file random 12-byte nonce (`os.urandom(12)`, never reused with the same key), storing `nonce + ciphertext(+tag)` alongside (or prefixed to) the encrypted file.
**Warning signs:** A security/compliance review later flags "AES-256" in PROJECT.md as unmet even though "encryption" was technically added.

### Pitfall 6: In-browser `MediaRecorder` Blob is lost on tab close/refresh (flagged risk, no fix mandated)
**What goes wrong:** Because D-10 locks a single non-chunked upload, the entire recording exists only in browser memory (as accumulated `dataavailable` Blob chunks) until "Selesai" is pressed. A crash, refresh, or accidental navigation during a 30-60 minute session loses the whole recording with no server-side trace.
**Why it happens:** Inherent to the "buffer in browser, upload once at the end" design that was explicitly chosen (D-10) over a more resilient chunked-upload alternative (explicitly rejected in discussion, see Deferred Ideas).
**How to avoid (CONTEXT.md flags this as a planner risk to address, not a locked decision):** At minimum, add a `beforeunload` confirmation prompt while `MediaRecorder.state === 'recording'` to prevent accidental navigation. A more robust (optional, discretionary) mitigation is periodic `requestData()` calls (e.g. every 60s) writing each chunk Blob to IndexedDB, reassembled on next load if the page detects an orphaned in-progress session — but per MDN/W3C docs there is no ready-made browser mechanism for this; it is nontrivial engineering with no off-the-shelf library. `[CITED: developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/dataavailable_event]` Recommend the planner scope a `beforeunload` guard as in-scope (cheap, high value) and treat IndexedDB buffering as an explicit descope-or-defer decision, not a silent gap.
**Warning signs:** A dosen reports "I recorded a whole session but there's no audio" after refreshing the active-session page mid-session.

### Pitfall 7: Consent is a client-attested boolean — backend should still sanity-check it
**What goes wrong:** Per D-06, a single lecturer click attests consent for both parties; nothing stops a client from sending `consent_given: true` while never actually attaching an audio file (e.g. a bug in the recording hook), silently producing a session that claims "consented, recorded" in the database with no actual recording.
**Why it happens:** `consent_given` and "an audio file was actually uploaded" are two independent facts, but only one (`consent_given`) is set at session-start time — the audio file only arrives at completion time.
**How to avoid:** Treat `consent_given=true` + no `audio_file` at completion as a valid, expected combination (mic failure mid-session, browser crash before upload, etc. — not an error) but log it distinctly (e.g. `SystemLog` event `RECORDING_MISSING_DESPITE_CONSENT`) so the Admin Dashboard (ADMIN-03, later phase) can surface these as anomalies, rather than silently treating them the same as an honest decline.
**Warning signs:** N/A for MVP correctness (session still completes fine) — this is an observability/audit-trail recommendation, not a blocking validation.

### Pitfall 8: Audio MIME/magic-byte validation needs its own check, not the PDF one
**What goes wrong:** `SubmissionCreateSerializer.validate_draft_file` checks for `application/pdf` / `%PDF-` magic bytes specifically — copying it unmodified for audio would reject every valid upload.
**Why it happens:** Copy-paste from the nearest existing validated-upload pattern without updating the expected signature.
**How to avoid:** WebM files begin with the EBML magic header `0x1A 0x45 0xDF 0xA3`; validate against that (or `audio/webm` via `python-magic` when available) using the same `_MAGIC_AVAILABLE` try/except fallback structure already established in `apps/submissions/serializers.py`.
**Warning signs:** Every legitimate audio upload gets rejected with a PDF-specific error message in testing.

## Code Examples

See Architecture Patterns section above (Patterns 1-4) — all four are concrete, project-specific code sketches mirroring existing verified patterns in this codebase (`StartSessionView`, `createSubmission`, `SubmissionCreateSerializer`), not generic library boilerplate.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Plain "Mulai" button (no consent, no recording) | "Mulai & Rekam" with consent gate + `MediaRecorder` capture | This phase (Phase 5) | Existing `StartSessionView`/`LecturerDashboard.tsx` button is extended in place, not replaced — minimizes risk to already-working SESSION-01/05/06 code paths that depend on the same `Session` model and endpoint. |

**Deprecated/outdated:** None — this is new functionality layered onto an already-implemented queue/session foundation, not a replacement of prior art.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Typical 15-60 min WebM/Opus voice recording at ~32-64kbps sizes to roughly 7-29MB | Common Pitfalls #4 | If real recordings are larger (e.g. higher bitrate default, background noise increasing entropy), the recommended settings bump may still be insufficient — plan should include a generous margin (e.g. 50-100MB) rather than a tight estimate-based number. |
| A2 | Desktop Chrome/Edge/Firefox are the realistic dosen browser environment (Safari WebM gap treated as an edge case, not primary) | Common Pitfalls #2 | If a meaningful share of lecturers use Safari/macOS or iPad as their primary device, "no recording on Safari" becomes a frequent, not rare, experience — worth an explicit product check with the user before implementation, not just an engineering fallback. |
| A3 | No existing IndexedDB/crash-recovery utility exists anywhere in this codebase to reuse | Common Pitfalls #6 | Confirmed by search — `grep -r "indexedDB"` returned no hits in `frontend/src` at time of research; if wrong, a lighter-weight fix might already exist to adapt. |

## Open Questions

1. **Should the "no recording despite consent" anomaly (Pitfall 7) be surfaced anywhere in Phase 5's UI, or only logged?**
   - What we know: CONTEXT.md's D-12 already covers the mic-permission-denied case with an inline dosen notification ("recording failed/unavailable"). The Pitfall 7 scenario (consent given, but upload arrives with no file for another reason) is a related-but-distinct edge case.
   - What's unclear: Whether the existing D-12 inline notification is meant to cover this too, or whether it's purely a client-side detection (mic denied at start) that can't detect a later silent recording failure.
   - Recommendation: Treat as the same D-12 UI path if detected client-side before upload; log server-side (SystemLog) as a fallback for cases the client can't detect (e.g. tab crash losing the Blob before the "Selesai" click ever happens — in which case there's no upload attempt to inspect at all, just a session that transitions to `DONE` with `consent_given=true` and no audio).

2. **Exact route/page architecture for the active-session page** — explicitly left to planner discretion in CONTEXT.md. This research recommends a dedicated route (`/dosen/session/:id`, added to `router.tsx` under the existing `requireRole('lecturer')` loader) over a modal-over-dashboard, because: (a) CONTEXT.md D-13 explicitly calls it a "dedicated active-session page," and (b) a full page survives more gracefully than a modal if the dosen accidentally navigates within the app (though not a full browser-close/refresh, per Pitfall 6).

3. **Where should `SessionRecording`/`consent_given`/`recording_status` fields live — directly on `Session`, or a new related model?**
   - What we know: D-16 says "New `Session.ts2` field required... analogous to existing `Session.ts1`," implying direct fields on `Session` are the intended pattern for `ts2` specifically.
   - What's unclear: Whether the audio file metadata (encrypted path, original size, nonce) should also be direct `Session` fields (matching `ts1`/`ts2`'s simplicity) or a separate one-to-one model (matching how `SubmissionFile` is split out from `Submission` in Phase 1's pattern).
   - Recommendation: Mirror the `Submission`/`SubmissionFile` split — add a new `SessionRecording` one-to-one model (uuid, encrypted file path, nonce, original size, consent_given, recording_status) rather than bloating `Session` directly, since Phase 6 will need to attach transcript/STT metadata to this same recording record and a dedicated model gives that a natural home. `ts2` itself stays a direct `Session` field per D-16's explicit wording.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Browser `MediaRecorder`/`getUserMedia` API | SESSION-03 client-side capture | N/A (runtime browser feature, not a CLI tool — verified via `isTypeSupported()` at runtime per Pattern 2) | Chrome 49+/Edge 79+/Firefox 29+/Safari 14.1+ (macOS)/14.5+ (iOS) support `MediaRecorder`; only Chromium/Firefox support `audio/webm` | Graceful no-recording fallback already designed (D-12 + Pitfall 2) |
| `cryptography` (Python) | AES-256 audio encryption | ✓ | 44.0.3 (`backend/.venv`) | — |
| `python-magic` / libmagic | Audio magic-byte validation | Conditionally available — existing `_MAGIC_AVAILABLE` try/except in `apps/submissions/serializers.py` already handles the DLL-missing case on Windows dev | Varies by machine | Manual header-byte check fallback already established in the codebase pattern |
| Node.js / npm | Frontend build/test | ✓ | Node v24.11.1 (verified in this session) | — |
| Python | Backend | ✓ | Python 3.11 (project venv, per user memory) / system Python 3.14 also present | — |
| Working microphone / virtual audio device | Local dev testing of the recording flow | Not verifiable via CLI — developer-machine dependent | — | Manual test-plan note: developers without a mic should exercise the D-12 permission-denied path instead |

**Missing dependencies with no fallback:** none — every dependency either exists already or has a designed fallback.

**Missing dependencies with fallback:** Safari WebM support (browser-level, not installable) — falls back to the existing no-recording UX path.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Backend framework | pytest + `pytest-django` (via `rest_framework.test.APIClient`), confirmed: `backend/.venv/Scripts/python.exe -m pytest -q` → **140 passed** on 2026-07-02 |
| Backend config | `backend/conftest.py` (shared fixtures: `api_client`, `student_user`, `lecturer_user`, `authenticated_lecturer`, etc.) |
| Frontend framework | Vitest + `@testing-library/react` + MSW (`msw` mocks HTTP in `src/test/setup.ts`) |
| Frontend config | `frontend/package.json` (`"test": "vitest run"`) |
| Quick run command (backend) | `backend/.venv/Scripts/python.exe -m pytest apps/bimbingan -q` |
| Quick run command (frontend) | `npm run test -- --run src/pages/lecturer/<file>.test.tsx` (from `frontend/`) |
| Full suite command (backend) | `backend/.venv/Scripts/python.exe -m pytest -q` |
| Full suite command (frontend) | `npm run test -- --run` (from `frontend/`) |

**Baseline note (important for the planner):** The frontend full suite currently has a **pre-existing, unrelated failure**: `src/pages/lecturer/LecturerDashboard.test.tsx` fails all 9 of its tests as of 2026-07-02 (`21 passed | 9 failed` across the suite) because the test file's expectations (e.g. `getByPlaceholderText('Cari NIM atau nama...')`, bottom-nav labels "Antrean"/"Riwayat") do not match the current `LecturerDashboard.tsx` implementation (labels are "Permintaan"/"Antrian", no search box on this page). This is **not caused by Phase 5** — it predates this research. Since Phase 5 extends this exact file (renaming "Mulai" → "Mulai & Rekam"), the planner should decide explicitly whether to (a) fix the stale test as part of Wave 0 so the phase has a green baseline to build on, or (b) explicitly document it as a known-pre-existing-failure the phase's new tests must not be confused with. `[VERIFIED: local test run, backend/.venv + frontend npm]`

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SESSION-02 | Consent modal shown before recording starts; declining still starts session with `consent_given=false` | unit (component) + integration (backend) | `npm run test -- --run src/components/ConsentModal.test.tsx` / `pytest apps/bimbingan/tests/test_session_execution.py -k consent` | ❌ Wave 0 (new files) |
| SESSION-03 | "Mulai & Rekam" sets `ts1` + starts `MediaRecorder`; permission-denied/codec-unsupported falls back gracefully to no-recording | unit (hook, with mocked `MediaRecorder`) + integration (backend `start/` accepting `consent_given`) | `npm run test -- --run src/hooks/useMediaRecorder.test.ts` / `pytest apps/bimbingan/tests/test_session_execution.py -k start` | ❌ Wave 0 (jsdom has no native `MediaRecorder` — needs a hand-rolled mock, see Wave 0 Gaps) |
| SESSION-04 | "Selesai" stops recording, uploads single audio file, sets `ts2`, accepts optional notes | integration (backend, `SimpleUploadedFile` audio fixture) + component (frontend, mocked `fetch`) | `pytest apps/bimbingan/tests/test_session_execution.py -k complete` / `npm run test -- --run src/pages/lecturer/ActiveSession.test.tsx` | ❌ Wave 0 (new files + new audio test fixture) |
| SESSION-01, 05, 06 | Already implemented | — | Already covered by existing `apps/bimbingan/tests/` (32 passing, per STATE.md) | ✅ existing |

### Sampling Rate
- **Per task commit:** targeted `pytest apps/bimbingan/tests/test_session_execution.py -q` / `npm run test -- --run <changed file>.test.tsx`
- **Per wave merge:** full backend suite (`pytest -q`) + full frontend suite (`npm run test -- --run`)
- **Phase gate:** Full suite green before `/gsd-verify-work` — **explicitly excluding** the pre-existing `LecturerDashboard.test.tsx` failure only if the planner chooses option (b) above (documented as known-pre-existing, not introduced by this phase); if option (a) is chosen, it must also be green.

### Wave 0 Gaps
- [ ] `backend/apps/bimbingan/tests/test_session_execution.py` — new test file covering consent, start-with-recording-flag, and complete/ts2/upload behaviors (mirrors `test_approval.py`'s `client_for()` + fixture style)
- [ ] A small valid-WebM byte fixture (analogous to the existing `pdf_file` fixture in `conftest.py`) — e.g. a `webm_audio_file` fixture yielding a `BytesIO` starting with the EBML magic header `\x1a\x45\xdf\xa3`, for `SimpleUploadedFile`-based upload tests
- [ ] `frontend/src/test/setup.ts` (or a new test-only shim) — a minimal `MediaRecorder`/`getUserMedia` mock, since **jsdom does not implement `MediaRecorder` at all**; component tests for the recording hook must stub `navigator.mediaDevices.getUserMedia` and a fake `MediaRecorder` class (start/stop/dataavailable/state)
- [ ] Decide and execute on the pre-existing `LecturerDashboard.test.tsx` failure (see Baseline note above) before or alongside Phase 5 changes to that same file

*(If no gaps: N/A — gaps listed above.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | No (unchanged) | Existing Django session-cookie auth (`IsLecturer` permission class) already covers this; no new auth surface introduced. |
| V3 Session Management | No (unchanged) | Same as above — no new session/auth mechanism. |
| V4 Access Control | Yes | New `complete/` endpoint and new audio-serving route must both reuse the existing ownership-check pattern: `request.user == session.submission.student.adviser` (mirrors `StartSessionView`) and the auth-gated file-serving pattern (mirrors `serve_submission_file` — owner/adviser/admin/kaprodi only, never a bare `MEDIA_URL` path, per D-29). |
| V5 Input Validation | Yes | Audio file: magic-byte validation (WebM EBML header) + size ceiling (raised `DATA_UPLOAD_MAX_MEMORY_SIZE`, still bounded — see Pitfall 4) before any disk write, mirroring `SubmissionCreateSerializer.validate_draft_file`'s validate-before-write order. |
| V6 Cryptography | Yes | Audio at rest MUST be AES-256 (PROJECT.md constraint) via `AESGCM`, not the existing AES-128 `Fernet` pattern (see Pitfall 5). Nonce must be freshly random per file, never reused with the same key — `os.urandom(12)`. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|----------------------|
| Unrestricted file upload (malicious file disguised as audio) | Tampering / Elevation of Privilege | Magic-byte validation before write (mirrors existing PDF pattern, adapted to WebM's EBML header), size cap, never trust client `Content-Type` (same lesson already codified in `apps/submissions`). |
| IDOR on audio-serving route (guessing another dosen/student pair's recording) | Information Disclosure | Reuse `serve_submission_file`'s ownership check pattern (owner student, their adviser, or admin/kaprodi only) — never expose a raw/guessable media path (D-29). |
| Session state-machine bypass (calling `complete/` on a `WAITING` or already-`DONE` session, e.g. replayed request) | Tampering | Explicit `status == IN_PROGRESS` guard on `CompleteSessionView` (see Pitfall 3), matching the one-way state machine already enforced elsewhere in this app. |
| Consent-flag tampering / inconsistency (client asserts `consent_given=true` with no actual recording ever uploaded) | Repudiation | Log the mismatch distinctly server-side (SystemLog `RECORDING_MISSING_DESPITE_CONSENT`) rather than silently accepting it as equivalent to an honest decline — supports future audit/Admin Dashboard visibility (see Pitfall 7). This is a low-severity, explicitly-accepted MVP tradeoff per D-06's single-lecturer-attestation model, not a blocking control. |
| At-rest key management for the new AESGCM key | Information Disclosure | Reuse the existing `settings.SECRET_KEY`-derived-key pattern's spirit (as `calendar.py` does for Fernet) but note: deriving a 32-byte AES-256 key from `SECRET_KEY` via a KDF (e.g. HKDF) is acceptable for MVP scope consistency with the existing token-encryption pattern; a dedicated encryption-key env var is a stronger long-term choice but is a judgment call for the planner/user, not something this research locks. |

## Sources

### Primary (HIGH confidence)
- None — no premium/authenticated documentation providers (Context7, Exa, Brave, Firecrawl) are configured in this project (`gsd-tools query init.phase-op` reports all `false`); all external research in this document was performed via the built-in `WebSearch` tool, which the `classify-confidence` seam rates LOW regardless of the target domain's authority. Codebase-internal findings (existing patterns, installed package versions, test-suite run results) are `[VERIFIED]` via direct tool execution in this session.

### Secondary (MEDIUM confidence, by source-domain authority — see Metadata note on tooling limits)
- MDN — MediaRecorder / MediaStream Recording API — `https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder`, `https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API`, `https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder/dataavailable_event`
- Chrome for Developers — MediaRecorder cross-browser codec support — `https://developer.chrome.com/blog/mediarecorder`
- Django REST Framework official docs — Parsers (`MultiPartParser`) — `https://www.django-rest-framework.org/api-guide/parsers/`
- `cryptography` (pyca) official docs — Fernet spec, AEAD/`AESGCM` — `https://cryptography.io/en/latest/fernet/`, `https://cryptography.io/en/latest/hazmat/primitives/aead/`

### Tertiary (LOW confidence — flagged for spot-check if precision matters)
- W3C MediaStream Recording spec (referenced, not directly fetched in full) — `https://www.w3.org/TR/mediastream-recording/`
- Assorted third-party blog posts surfaced by WebSearch (SitePoint, Medium, various codec-support round-ups) — used only to corroborate the MDN/Chrome-docs findings above, not as a sole source for any claim in this document.

## Metadata

**Confidence breakdown:**
- Standard stack (no new packages, `cryptography` already installed): HIGH — verified directly against the local venv and `requirements.txt` in this session.
- Existing-code patterns to mirror (`StartSessionView`, `createSubmission`, `serve_submission_file`, `SubmissionCreateSerializer`): HIGH — read directly from the codebase in this session, not inferred.
- MediaRecorder/getUserMedia API behavior, WebM/Opus browser support, Fernet-vs-AESGCM algorithm details: MEDIUM by source-domain authority (MDN, Chrome docs, cryptography.io are the canonical sources for these facts and were the top results returned) but the project's `classify-confidence` seam rates the `websearch`/`webfetch` providers LOW in this environment because no premium search API (Exa/Brave/Firecrawl/Context7) is configured — treat these specific claims as needing a quick spot-check against the linked official docs if a decision hinges precisely on them, rather than as independently re-verified this session.
- Pitfalls (Content-Type/multipart trap, DATA_UPLOAD_MAX_MEMORY_SIZE sizing, Fernet-is-AES-128, state-machine guard): HIGH — each is either read directly from existing code/settings in this session or is a direct mathematical/logical consequence of a HIGH-confidence fact (e.g., Fernet's documented AES-128 key size).

**Research date:** 2026-07-02
**Valid until:** 30 days (2026-08-01) for the browser-API and cryptography-library facts (stable, slow-moving); the codebase-internal findings (existing patterns, test-suite pass counts) should be treated as valid only until the next code change to those files — re-verify at planning time if this research is consumed more than a few days after 2026-07-02.
