# Phase 6: STT, AI Summarization & Logbook - Pattern Map

**Mapped:** 2026-07-05
**Files analyzed:** 27
**Analogs found:** 22 / 27

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `backend/config/celery.py` | config | event-driven | *(no analog — first Celery app in project)* | none |
| `backend/config/__init__.py` (add celery_app import) | config | — | existing file, trivial edit | n/a |
| `backend/config/settings/base.py` (add CELERY_*/STT_*/LLM_*/ANTHROPIC_* settings) | config | — | `backend/config/settings/base.py` lines 120-133 (GOOGLE_CALENDAR_ENABLED/DOSEN_DAILY_QUOTA_MINUTES block) | exact |
| `backend/apps/logbook/apps.py` | config | — | `backend/apps/bimbingan/apps.py` | role-match |
| `backend/apps/logbook/models.py` (`SessionLogbook`) | model | CRUD | `backend/apps/bimbingan/models.py` (`Session`, `SessionRecording`, `SystemLog`) | exact |
| `backend/apps/logbook/migrations/0001_initial.py` | migration | — | `backend/apps/bimbingan/migrations/0004_session_result_notes_session_ts2_sessionrecording.py` | role-match |
| `backend/apps/logbook/schemas.py` (`SessionSummary` Pydantic) | model (schema) | transform | *(no analog — first Pydantic model in project; DRF serializers are the closest sibling concept)* `backend/apps/bimbingan/serializers.py` | partial |
| `backend/apps/logbook/services/stt.py` (faster-whisper wrapper) | service | batch/transform | `backend/apps/bimbingan/services/calendar.py` (external-API service wrapper, graceful-degradation pattern) | role-match |
| `backend/apps/logbook/services/summarizer.py` (Anthropic client wrapper) | service | request-response | `backend/apps/bimbingan/services/calendar.py` | role-match |
| `backend/apps/logbook/tasks.py` (`transcribe_session`, `submit_summary_batch`, `poll_summary_batch`) | service (async task) | event-driven | `backend/apps/bimbingan/scheduler.py` (`check_h15_notifications`, `check_auto_cancel`, `_recalculate_queue`) — closest *async job* precedent even though APScheduler ≠ Celery | role-match |
| `backend/apps/logbook/views.py` (logbook list/detail/approve endpoints) | controller | CRUD | `backend/apps/bimbingan/views.py` (`AdminLogsView`, `CompleteSessionView`, `ApproveSubmissionView`) | exact |
| `backend/apps/logbook/serializers.py` | controller (serializer) | CRUD | `backend/apps/bimbingan/serializers.py` | exact |
| `backend/apps/logbook/urls.py` | route | — | `backend/apps/bimbingan/urls.py` | exact |
| `backend/apps/videocall/` (room/session identifier surface, minimal) | controller/model | request-response | `backend/apps/bimbingan/serializers.py` (`SessionDetailSerializer`) — thin field-passthrough pattern | partial |
| `backend/apps/bimbingan/views.py::CompleteSessionView` (MODIFY — add `.delay()` trigger) | controller | event-driven trigger | itself, lines 750-836 | exact (self-modify) |
| `backend/apps/bimbingan/views.py::AdminStatsView`/`AdminLogsView` (MODIFY — add STT/LLM counts + event_type filter) | controller | CRUD | itself, lines 898-1061 | exact (self-modify) |
| `backend/requirements.txt` (MODIFY — add celery, redis, faster-whisper, anthropic, pydantic) | config | — | itself | exact |
| `docker-compose.yml` / `docker-compose.dev.yml` (MODIFY — add `redis`, `celery-worker` services) | config | — | itself, `web`/`db` service blocks | exact |
| `backend/apps/logbook/evals/promptfooconfig.yaml` + `dataset.yaml` | test | batch | *(no analog — first eval harness in project)* | none |
| `frontend/src/components/video/VideoProvider.tsx` | component | event-driven | *(no analog — new abstraction, D-13)* | none |
| `frontend/src/components/video/JitsiVideoProvider.tsx` | component | event-driven | *(no analog)* — closest structural sibling: `frontend/src/components/ConsentModal.tsx` (self-contained stateful widget w/ loading/error overlay pattern) | partial |
| `frontend/src/components/LogbookStatusBadge.tsx` (or extend `StatusBadge.tsx`) | component | transform | `frontend/src/components/StatusBadge.tsx` | exact |
| `frontend/src/pages/lecturer/LecturerLogbookList.tsx` (S-12) | component | CRUD (read) | `frontend/src/components/SessionTable.tsx` (list+status+action-link pattern) | role-match |
| `frontend/src/pages/lecturer/LecturerLogbookReview.tsx` (S-13) | component | CRUD (edit) | `frontend/src/pages/lecturer/LecturerDashboard.tsx` (notes textarea, active-session card) + `frontend/src/pages/student/StudentDashboard.tsx` (split-pane PDF/notes layout referenced by UI-SPEC) | role-match |
| `frontend/src/components/ApproveLogbookModal.tsx` (S-14) | component | request-response | `frontend/src/components/ConsentModal.tsx` | exact |
| `frontend/src/pages/student/StudentLogbookView.tsx` (S-15) | component | CRUD (read) | `frontend/src/components/SessionTable.tsx` + `frontend/src/pages/student/StudentDashboard.tsx` | role-match |
| `frontend/src/pages/admin/AdminDashboard.tsx` (MODIFY — add "Pemrosesan STT/AI" section, S-17) | component | CRUD (read) | itself, lines 133-215 (`StatCard` grid + "Log Error Terbaru" list) | exact (self-modify) |
| `frontend/src/pages/lecturer/LecturerDashboard.tsx` (MODIFY — embed Jitsi in "Sesi Berlangsung" card, S-16) | component | event-driven | itself, lines 130-168 | exact (self-modify) |
| `frontend/src/pages/lecturer/LecturerQueue.tsx` / `LecturerRequests.tsx` (MODIFY — replace external link `<a>` with embed) | component | event-driven | itself, lines ~80-85 | exact (self-modify) |
| `frontend/src/pages/student/StudentQueue.tsx` (MODIFY — add active-session card, new) | component | event-driven | `frontend/src/pages/lecturer/LecturerDashboard.tsx`'s active-session card (mirrored, read-only-of-controls) | role-match |
| `frontend/src/hooks/useDualAudioRecorder.ts` (really: lecturer-mic-only passthrough, D-17) | hook | streaming | existing `useMediaRecorder` hook (referenced by `LecturerDashboard.tsx`'s `recorder.isRecording`) — **must locate and reuse verbatim, do not reimplement** | exact |
| `frontend/src/api/logbook.ts` (new API module) | service (client) | request-response | `frontend/src/api/sessions.ts` | exact |
| `frontend/src/api/stats.ts` (MODIFY — add STT/LLM/cost fields) | service (client) | request-response | itself | exact (self-modify) |
| `frontend/src/router.tsx` (MODIFY — add logbook routes + StudentQueue active-session wiring) | route | — | itself, existing Phase-2 route additions | exact (self-modify) |

## Pattern Assignments

### `backend/apps/logbook/models.py` — `SessionLogbook`

**Analog:** `backend/apps/bimbingan/models.py`

**Imports pattern** (lines 15-19):
```python
import uuid
from django.db import models
from django.conf import settings
```

**Model + TextChoices status pattern** (lines 21-68, `Session`):
```python
class Session(models.Model):
    class Status(models.TextChoices):
        WAITING = 'waiting', 'Menunggu'
        IN_PROGRESS = 'in_progress', 'Berlangsung'
        DONE = 'done', 'Selesai'
        CANCELLED = 'cancelled', 'Dibatalkan'

    submission = models.OneToOneField(
        'submissions.Submission', on_delete=models.CASCADE, related_name='session',
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.WAITING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['scheduled_at']

    def __str__(self):
        return f'Session #{self.pk} [{self.status}] – {self.submission}'
```
Apply this shape to `SessionLogbook`: `session = OneToOneField('bimbingan.Session', related_name='logbook')`, `class Status(TextChoices)` with `pending/transcribing/summarizing/ready_for_review/approved/failed` (D-06), plus `transcript`, `summary_raw` (JSONField, mirrors `SystemLog.context` JSONField usage below), `summary_edited` (JSONField), `batch_id`, `approved_at`, `approved_by` (FK to user), `source_mode` (`offline`/`online` — same TextChoices shape as `Session.Method`), and D-11's `llm_input_tokens`/`llm_output_tokens`/`llm_cost_estimate_idr`.

**JSONField pattern** (from `SystemLog`, lines 135-155):
```python
class SystemLog(models.Model):
    class Level(models.TextChoices):
        INFO = 'INFO', 'Info'
        WARNING = 'WARNING', 'Peringatan'
        ERROR = 'ERROR', 'Error'

    level = models.CharField(max_length=10, choices=Level.choices, default=Level.INFO)
    event_type = models.CharField(max_length=50, blank=True, default='')
    message = models.TextField()
    context = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
```
Reuse `SystemLog` as-is (D-10) — do not create a new logging model. New `event_type` values needed: `STT_FAILED`, `STT_TIMEOUT`, `STT_DISABLED`, `LLM_FAILED`, `LLM_TIMEOUT`, `LLM_VALIDATION_FAILED`, `LLM_DISABLED`.

**UUID file pattern** (from `SessionRecording`, lines 71-91) — apply the "never exposed via MEDIA_URL, UUID-named" discipline described in D-05/CONTEXT.md's Reusable Assets note if the planner adds any new file-backed field (unlikely for `SessionLogbook`, since transcript/summary are DB text/JSON fields, not files — noted here only as the governing discipline, not a required file field).

---

### `backend/apps/logbook/tasks.py` — Celery tasks

**Analog:** `backend/apps/bimbingan/scheduler.py` (closest *async background job* precedent, despite the broker being APScheduler not Celery) + AI-SPEC.md Section 4 (already-specified concrete code).

**Try/except-log-degrade pattern** (scheduler.py lines 20-58, `check_h15_notifications`):
```python
def check_h15_notifications():
    try:
        ...
        SystemLog.objects.create(
            level=SystemLog.Level.INFO,
            event_type='H15_NOTIFICATION',
            message=f'Notifikasi H-15 dikirim ke {student.email}',
            context={'session_id': session.id, 'student_id': student.id},
        )
    except Exception as e:
        logger.exception('check_h15_notifications error: %s', e)
```
Mirror this "wrap the whole job body, log to SystemLog on success path, log+swallow on exception" discipline inside every Celery task's failure branch (`_fail()` helper in AI-SPEC.md Section 4's Core Pattern already does this correctly — use it as written).

**Notification-service call pattern** (scheduler.py lines 44-47, reuse `notify_student`/`notify_lecturer` from `services/notification.py` verbatim — do not build new notification plumbing for STT/LLM completion, if the planner decides sessions should notify on `ready_for_review`).

**Task/queue registration:** AI-SPEC.md Section 4's `submit_summary_batch`/`poll_summary_batch` and RESEARCH.md Pattern 2's `transcribe_session` are already fully specified — copy verbatim, they are the authoritative source for this file, not a re-derivation exercise.

---

### `backend/apps/logbook/services/stt.py` / `summarizer.py`

**Analog:** `backend/apps/bimbingan/services/calendar.py`

**Feature-flag / graceful-degradation pattern** (lines 118-136, `_calendar_enabled` + `check_free_busy`):
```python
def _calendar_enabled() -> bool:
    return getattr(settings, 'GOOGLE_CALENDAR_ENABLED', False)

def check_free_busy(dosen, start_time, end_time) -> dict:
    if not _calendar_enabled():
        logger.debug('Google Calendar dinonaktifkan — skip checkFreeBusy')
        return {'isFree': True, 'conflicts': []}
    try:
        ...
    except Exception as e:
        _log_error(f'checkFreeBusy gagal untuk {dosen.email}: {e}', {'dosen_id': dosen.id})
        return {'isFree': True, 'conflicts': []}
```
Apply identically for `STT_LLM_ENABLED` (D-04): every entry point in `stt.py`/`summarizer.py` must check the flag first and short-circuit to the failure/skip path, never raise past it.

**Centralized error-logging helper pattern** (lines 104-115, `_log_error`):
```python
def _log_error(message: str, context: dict):
    from apps.bimbingan.models import SystemLog
    try:
        SystemLog.objects.create(
            level=SystemLog.Level.ERROR, event_type='CALENDAR_ERROR',
            message=message, context=context,
        )
    except Exception:
        pass
    logger.error('[CalendarService] %s', message)
```
Copy this shape for `_log_error` in `stt.py`/`summarizer.py`, swapping `event_type` per D-08's stage-specific values (`STT_FAILED`/`LLM_FAILED`/etc.) — note the deliberate `except: pass` around the `SystemLog.objects.create` call itself, so a logging failure never masks the original error.

**Encryption note (do NOT copy for new secrets):** `calendar.py` lines 21-28 use Fernet (AES-128-CBC) — `CLAUDE.md`'s STATUS AUDIT flags this as *not* meeting the AES-256 requirement. If any new field in `SessionLogbook` needs at-rest encryption beyond what plain DB storage + access control provides, do not silently copy this Fernet helper as if it were AES-256-compliant — flag it the same way `CLAUDE.md` already does.

---

### `backend/apps/logbook/views.py` / `serializers.py` / `urls.py`

**Analog:** `backend/apps/bimbingan/views.py`, `serializers.py`, `urls.py`

**Permission-per-view pattern** (views.py, `AdminLogsView` lines 1023-1029):
```python
class AdminLogsView(APIView):
    def get_permissions(self):
        from apps.accounts.permissions import IsAdmin
        return [IsAdmin()]

    def get(self, request):
        qs = SystemLog.objects.all()
        log_type = request.query_params.get('type')
        if log_type:
            qs = qs.filter(event_type__iexact=log_type)
        ...
        return Response({'total': total, 'page': page, 'limit': limit, 'logs': logs})
```
Use this exact `get_permissions()` override style for lecturer-vs-admin-vs-student view classes rather than a flat `permission_classes = [...]` when the check needs to branch. For the simple case, `permission_classes = [IsLecturer]` (used throughout, e.g. `ApproveSubmissionView` line 168, `CompleteSessionView` line 759) is the default pattern.

**Ownership-check + state-machine-guard pattern** (views.py, `CompleteSessionView` lines 761-808):
```python
def post(self, request, pk):
    try:
        session = Session.objects.select_related('submission__student__adviser').get(pk=pk)
    except Session.DoesNotExist:
        return Response({'detail': 'Sesi tidak ditemukan.'}, status=status.HTTP_404_NOT_FOUND)

    if session.submission.student.adviser != request.user:
        return Response({'detail': 'Anda tidak memiliki izin.'}, status=status.HTTP_403_FORBIDDEN)

    if session.status != Session.Status.IN_PROGRESS:
        return Response({'detail': 'Hanya sesi yang sedang berlangsung yang dapat diselesaikan.'},
                         status=status.HTTP_400_BAD_REQUEST)
    ...
    session.status = Session.Status.DONE
    session.save(update_fields=['status', 'ts2', 'result_notes', 'updated_at'])
```
Apply this exact 404 → 403-ownership → 400-state-guard → mutate-with-`update_fields` sequence to the logbook approve endpoint (ownership: lecturer must be `logbook.session.submission.student.adviser`; state guard: `status` must be `ready_for_review` before allowing approve).

**Celery-trigger-from-view pattern (NEW for this project, but same call shape as** the existing `CompleteSessionView` calling `notify_student(...)` synchronously — the difference is `.delay()` instead of a direct call): add `from apps.logbook.tasks import transcribe_session` then `transcribe_session.delay(logbook.id)` immediately after creating the `SessionLogbook` row inside `CompleteSessionView.post()`, following the "fire and return immediately, never await" discipline already established by every synchronous external call in this view being non-blocking (Google Calendar calls are the one counter-example flagged in `CLAUDE.md` as NFR-01 outstanding — do not repeat that mistake here; Celery's `.delay()` is the correct fix per D-06/D-07).

**Serializer validation pattern** (serializers.py, `ApproveSubmissionSerializer` lines 13-28):
```python
class ApproveSubmissionSerializer(serializers.Serializer):
    method = serializers.ChoiceField(choices=[('offline', 'Offline'), ('online', 'Online')])
    meeting_link = serializers.URLField(required=False, allow_null=True, allow_blank=True, ...)

    def validate(self, attrs):
        if attrs['method'] == 'online' and not attrs.get('meeting_link'):
            raise serializers.ValidationError({'meeting_link': 'Link meeting wajib diisi jika metode Online.'})
        return attrs
```
Use `serializers.Serializer` (not `ModelSerializer`) for the approve-logbook action payload (e.g. accepting edited `summary_edited` JSON) — cross-field validation via `validate()`, matching this exact shape.

**URL registration pattern** (urls.py lines 30-40):
```python
stats_urlpatterns = [
    path('lecturer/', LecturerStatsView.as_view(), name='stats-lecturer'),
    path('admin/', AdminStatsView.as_view(), name='stats-admin'),
]
admin_urlpatterns = [
    path('emergency-cancel/', AdminEmergencyCancelView.as_view(), name='admin-emergency-cancel'),
    path('logs/', AdminLogsView.as_view(), name='admin-logs'),
]
```
Create a `logbook_urlpatterns` list in the same style, included into `config/urls.py` the same way `queue_urlpatterns`/`calendar_urlpatterns`/`stats_urlpatterns` already are (check `backend/config/urls.py` for the exact `include()` calls used for Phase 2's lists).

---

### `frontend/src/components/StatusBadge.tsx` → new `SessionLogbook` status badge

**Analog:** `frontend/src/components/StatusBadge.tsx` (full file, 47 lines)

```tsx
type BadgeStatus = 'MENUNGGU' | 'DISETUJUI' | 'BERLANGSUNG' | 'SELESAI' | 'DIBATALKAN' | 'REVISI' | 'DITOLAK';

const STATUS_STYLES: Record<BadgeStatus, string> = {
  MENUNGGU: 'bg-status-pending-bg text-status-pending-text',
  ...
};
const STATUS_LABELS: Record<BadgeStatus, string> = { ... };

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES['MENUNGGU'];
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span className={`inline-block rounded px-2 py-1 text-[11px] font-bold uppercase ${style} ${className}`}>
      {label}
    </span>
  );
}
```
UI-SPEC.md explicitly mandates a **separate** badge vocabulary for `SessionLogbook` status (do not add `pending`/`transcribing`/etc. into the existing `BadgeStatus` union — it's a different lifecycle). Create a sibling component (e.g. `LogbookStatusBadge.tsx`) with the same `Record<Status, string>` lookup-table structure, but add the icon + `animate-pulse` + `role="status" aria-live="polite"` wrapper for the two in-progress states (`transcribing`/`summarizing`) per UI-SPEC's Status Badge Contract — this is the one structural addition beyond the copied pattern.

---

### `frontend/src/components/ConsentModal.tsx` → `ApproveLogbookModal.tsx` (S-14)

**Analog:** `frontend/src/components/ConsentModal.tsx` (full file, 94 lines)

**Modal shell pattern** (lines 24-31):
```tsx
<div
  className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
  role="dialog"
  aria-modal="true"
  aria-label="Persetujuan Perekaman Sesi"
>
  <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 shadow-xl">
```

**Primary/secondary/cancel button stack pattern** (lines 65-90):
```tsx
<div className="flex flex-col gap-3">
  <button
    type="button"
    disabled={!bothChecked || loading}
    onClick={() => onConfirm(true)}
    className="w-full py-3 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
  >
    {loading ? 'Memulai...' : 'Setuju & Mulai Rekam'}
  </button>
  <button type="button" disabled={loading} onClick={() => onConfirm(false)} className="w-full py-3 rounded-xl border border-gray-200 text-slate-600 text-sm font-bold hover:bg-gray-50 min-h-[44px] ...">
    Lanjut Tanpa Rekaman
  </button>
  <button type="button" disabled={loading} onClick={onClose} className="w-full py-2 text-neutral-gray text-xs font-normal hover:text-slate-600">
    Batal
  </button>
</div>
```
Copy this exact shell + button-stack for S-14: replace the two-checkbox gate with the transcript-expanded gate (already enforced at S-13's button level per UI-SPEC, so S-14 itself has no additional gating condition beyond `loading`), add the conditional "N item masih ditandai 'Perlu Verifikasi'" warning line (UI-SPEC S-14) above the button stack, rename buttons to "Batal" / "Setujui & Kunci" per the Copywriting Contract.

---

### `frontend/src/components/SessionTable.tsx` → `LecturerLogbookList.tsx` (S-12) / student logbook entry point extension

**Analog:** `frontend/src/components/SessionTable.tsx` (full file, 84 lines)

**Empty-state pattern** (lines 29-39):
```tsx
if (rows.length === 0) {
  return (
    <div className="py-10 flex flex-col items-center text-center">
      <span className="material-symbols-outlined text-gray-300 text-4xl mb-3" aria-hidden="true">history</span>
      <h3 className="font-bold text-slate-800">Belum Ada Riwayat Sesi</h3>
      <p className="text-sm text-on-surface-variant mt-1 max-w-xs">...</p>
    </div>
  );
}
```
Use this exact shape for S-12's empty state ("Belum Ada Logbook" copy per UI-SPEC Copywriting Contract).

**Row-action-button-with-disabled-state pattern** (lines 62-76):
```tsx
<button
  type="button"
  onClick={() => onView(row)}
  disabled={!row.fileUuid}
  aria-label={`Lihat detail sesi ${row.topic}`}
  title={row.fileUuid ? 'Lihat detail' : 'Tidak ada berkas untuk sesi ini'}
  className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-on-surface-variant hover:bg-primary/10 hover:text-accent-link transition-colors disabled:opacity-30 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
>
  <span className="material-symbols-outlined text-xl" aria-hidden="true">visibility</span>
</button>
```
For S-15's entry point, add a **second** icon-button following this exact pattern (`description` icon, enabled only when `SessionLogbook.status === 'approved'`) — per UI-SPEC S-15's explicit instruction to extend `SessionTable.tsx`, not replace it. The `SessionTable.tsx` comment at line 6 ("Transkrip & ringkasan sesi belum didukung backend") is the TODO this phase closes — remove/update that comment when implementing.

---

### `frontend/src/pages/lecturer/LecturerDashboard.tsx` → S-16 Jitsi embed insertion point

**Analog:** `frontend/src/pages/lecturer/LecturerDashboard.tsx` lines 130-168 (`Sesi Berlangsung` card)

```tsx
{queue?.activeSession && (
  <section className="bg-white rounded-xl border-2 border-primary/30 p-4 shadow-sm space-y-3">
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase text-primary">Sesi Berlangsung</p>
        <p className="font-bold text-base text-slate-900 truncate mt-0.5">{queue.activeSession.mahasiswa_name}</p>
        ...
      </div>
      {recorder.isRecording ? (
        <span className="flex items-center gap-1.5 bg-error/10 text-error text-[11px] font-bold rounded-full px-3 py-1.5 flex-shrink-0" role="status">
          <span className="w-2 h-2 rounded-full bg-error animate-pulse" aria-hidden="true" />
          Merekam…
        </span>
      ) : ( ... )}
    </div>

    <textarea value={notes} onChange={...} placeholder="Catatan hasil bimbingan (opsional)…" rows={2}
      className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary resize-none" />

    <button type="button" disabled={completing} onClick={handleComplete} ...>Selesai</button>
  </section>
)}
```
Per UI-SPEC S-16, insert the `JitsiVideoProvider` container **between** the header row (student name + "Merekam…" chip) and the `<textarea>` — do not touch the recording-badge logic (`recorder.isRecording`) or the `handleComplete`/"Selesai" flow at all (D-17: recording path is unchanged for online sessions). Only render the video container when `queue.activeSession.method === 'online'`.

**Locate and reuse `useMediaRecorder` verbatim** (referenced via `recorder.isRecording` at line 142) — this is the existing hook D-17 mandates reusing as-is for online sessions; do not write a new "dual audio" hook that diverges from it, per D-16's cancellation.

---

## Shared Patterns

### Graceful Degradation / Feature Flags
**Source:** `backend/apps/bimbingan/services/calendar.py` lines 118-155 (`_calendar_enabled()` guard + safe-default return on every public function)
**Apply to:** `services/stt.py`, `services/summarizer.py`, `tasks.py` — every entry point must check `STT_LLM_ENABLED` (D-04) and `ANTHROPIC_API_KEY` presence first, matching the exact "flag off → log at debug, return safe default immediately" shape.

### SystemLog Audit Logging
**Source:** `backend/apps/bimbingan/models.py` lines 135-155 (`SystemLog` model) + usage throughout `views.py`/`scheduler.py`/`calendar.py`
**Apply to:** All STT/LLM/Jitsi failure and success logging (D-10) — reuse the model verbatim, only add new `event_type` string values. Never create a second logging table.

### Ownership + State-Machine Guard in Views
**Source:** `backend/apps/bimbingan/views.py` `CompleteSessionView.post()` lines 761-776 (404 → 403 → 400 sequence)
**Apply to:** Every logbook controller action (review, approve, manual-notes save) — lecturer must own the session via `.submission.student.adviser`, and the action must be rejected with 400 if `SessionLogbook.status` isn't in the expected pre-state.

### DRF `Serializer` (not `ModelSerializer`) for Action Payloads
**Source:** `backend/apps/bimbingan/serializers.py` `ApproveSubmissionSerializer`/`RejectSubmissionSerializer` lines 13-40
**Apply to:** Approve-logbook and manual-notes-save request bodies.

### Modal Shell (dialog/aria-modal, bottom-sheet-on-mobile)
**Source:** `frontend/src/components/ConsentModal.tsx` lines 24-31
**Apply to:** `ApproveLogbookModal.tsx` (S-14) — exact `fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40` + `bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 shadow-xl` shell.

### StatCard Grid + Section Heading (Admin Dashboard extension)
**Source:** `frontend/src/pages/admin/AdminDashboard.tsx` lines 133-137 (`Ringkasan Sistem` section) using `frontend/src/components/StatCard.tsx`
**Apply to:** S-17's new "Pemrosesan STT/AI" section — identical `grid grid-cols-2 sm:grid-cols-4 gap-3` + `StatCard` usage, inserted between "Status Integrasi" and "Emergency Cancel" per UI-SPEC.

### API Client Module Shape
**Source:** `frontend/src/api/sessions.ts` (full file) — typed interfaces, `apiRequest()` wrapper, `if (!res.ok) throw new Error(...)` per function
**Apply to:** New `frontend/src/api/logbook.ts` module for logbook list/detail/approve/manual-notes calls.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `backend/config/celery.py` | config | event-driven | First Celery app definition in this project — zero prior Celery infra (D-07). Use RESEARCH.md Pattern 1 verbatim (already fully specified) instead of a codebase analog. |
| `backend/apps/logbook/schemas.py` (`SessionSummary` Pydantic) | model (schema) | transform | First Pydantic model in this codebase — DRF serializers are structurally the closest sibling but a different library; AI-SPEC.md Section 4b already gives the exact code to use. |
| `frontend/src/components/video/VideoProvider.tsx` / `JitsiVideoProvider.tsx` | component | event-driven | No prior `VideoProvider`/video-embed code anywhere in the repo (confirmed by RESEARCH.md/CONTEXT.md D-13). RESEARCH.md Pattern 3 gives the exact `@jitsi/react-sdk` code to use. |
| `backend/apps/logbook/evals/promptfooconfig.yaml` + gold dataset | test | batch | First eval harness in this project — AI-SPEC.md Section 5's Eval Tooling subsection is the authoritative source, not a codebase analog. |
| `backend/apps/videocall/` app | controller/model | request-response | New minimal app for Jitsi room/session identifiers — RESEARCH.md's Recommended Project Structure notes this is "likely just serializer fields on Session, no heavy backend logic"; `SessionDetailSerializer` (bimbingan/serializers.py lines 45-67) is the nearest structural precedent for a thin field-passthrough serializer, but there is no directly analogous view/model to copy wholesale. |

## Metadata

**Analog search scope:** `backend/apps/bimbingan/` (models, views, serializers, urls, scheduler, services, apps.py), `backend/config/settings/base.py`, `backend/requirements.txt`, `docker-compose.yml`, `frontend/src/components/` (StatusBadge, ConsentModal, StatCard, SessionTable), `frontend/src/pages/admin/AdminDashboard.tsx`, `frontend/src/pages/lecturer/LecturerDashboard.tsx`, `frontend/src/api/sessions.ts`
**Files scanned:** 18 read directly (full or targeted sections); several more located via Glob/Grep for structural confirmation (StudentQueue.tsx, LecturerQueue.tsx, router.tsx referenced but not deep-read — their patterns are already fully described in 06-UI-SPEC.md itself)
**Pattern extraction date:** 2026-07-05
