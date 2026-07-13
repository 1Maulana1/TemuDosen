/**
 * Sessions & queue API — Phase 2.
 */
import { apiRequest, resolveUrl } from './client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface SessionInfo {
  id: number;
  status: 'waiting' | 'in_progress' | 'done' | 'cancelled';
  method: 'offline' | 'online' | null;
  meeting_link: string | null;
  estimated_minutes: number;
  scheduled_at: string | null;
  queue_position: number | null;
  google_event_id: string | null;
  notification_sent: boolean;
}

export interface StudentQueueSession extends SessionInfo {
  estimated_wait_minutes: number;
  dosen_name: string;
  total_in_queue: number;
}

export interface LecturerQueueItem {
  position: number;
  id: number;
  mahasiswa_name: string;
  nim: string;
  symptom_name: string;
  estimated_minutes: number;
  scheduled_at: string;
  status: string;
  method: 'offline' | 'online' | null;
  meeting_link: string | null;
}

export interface ActiveSession extends LecturerQueueItem {
  ts1: string | null;
  consent_given: boolean;
}

export interface LecturerQueueResponse {
  totalWaiting: number;
  estimatedEndTime: string;
  queue: LecturerQueueItem[];
  activeSession: ActiveSession | null;
}

export interface StudentQueueResponse {
  hasActiveQueue: boolean;
  session: StudentQueueSession | null;
}

export interface ApprovePayload {
  method: 'offline' | 'online';
  meeting_link?: string | null;
}

export interface RejectPayload {
  action: 'REJECTED' | 'REVISION';
  reason: string;
}

// ── Student queue ──────────────────────────────────────────────────────────────

export async function getMyQueue(): Promise<StudentQueueResponse> {
  const res = await apiRequest('/api/queue/my/');
  if (!res.ok) throw new Error('Gagal memuat data antrian.');
  return res.json();
}

export async function cancelMyQueue(sessionId: number): Promise<void> {
  const res = await apiRequest(`/api/queue/${sessionId}/cancel/`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? 'Gagal membatalkan antrian.');
  }
}

// ── Lecturer queue ─────────────────────────────────────────────────────────────

export async function getLecturerQueue(): Promise<LecturerQueueResponse> {
  const res = await apiRequest('/api/queue/lecturer/');
  if (!res.ok) throw new Error('Gagal memuat antrian dosen.');
  return res.json();
}

// ── Dosen jadwalkan langsung (full control, tanpa approval mahasiswa) ─────────

export interface Advisee {
  id: number;
  full_name: string;
  nim: string | null;
}

export async function getAdvisees(): Promise<Advisee[]> {
  const res = await apiRequest('/api/queue/lecturer/advisees/');
  if (!res.ok) throw new Error('Gagal memuat daftar mahasiswa bimbingan.');
  const body = await res.json();
  return body.advisees;
}

export interface SchedulePayload {
  student_id: number;
  scheduled_at: string; // ISO datetime
  method: 'offline' | 'online';
  meeting_link?: string;
  note?: string;
}

export async function scheduleSession(payload: SchedulePayload): Promise<{ message: string }> {
  const res = await apiRequest('/api/queue/lecturer/schedule/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const b = body as Record<string, unknown>;
    const detail =
      (typeof b.detail === 'string' && b.detail) ||
      (Array.isArray(b.scheduled_at) && String(b.scheduled_at[0])) ||
      (Array.isArray(b.meeting_link) && String(b.meeting_link[0])) ||
      'Gagal menjadwalkan sesi.';
    throw new Error(detail);
  }
  return res.json();
}

// ── Kalender bimbingan (grid bulanan, halaman profil dosen) ───────────────────

export interface CalendarSession {
  id: number;
  scheduled_at: string;
  status: 'waiting' | 'in_progress' | 'done';
  method: 'offline' | 'online' | null;
  mahasiswa_name: string;
  nim: string | null;
}

/** @param month "YYYY-MM" */
export async function getLecturerCalendar(month: string): Promise<CalendarSession[]> {
  const res = await apiRequest(`/api/queue/lecturer/calendar/?month=${encodeURIComponent(month)}`);
  if (!res.ok) throw new Error('Gagal memuat kalender bimbingan.');
  const body = await res.json();
  return body.sessions;
}

// ── Selesai (SESSION-04) ───────────────────────────────────────────────────────

export interface CompleteSessionResult {
  message: string;
  ts2: string;
  has_recording: boolean;
}

/**
 * Selesaikan sesi: set TS2 + status DONE. `audio` (Blob hasil MediaRecorder)
 * hanya dikirim jika consent kedua pihak tercatat — server menolaknya jika tidak.
 */
export async function completeSession(
  sessionId: number,
  opts: { notes?: string; audio?: Blob | null } = {}
): Promise<CompleteSessionResult> {
  const form = new FormData();
  if (opts.notes) form.append('notes', opts.notes);
  if (opts.audio && opts.audio.size > 0) {
    const ext = opts.audio.type.includes('ogg') ? 'ogg' : opts.audio.type.includes('mp4') ? 'mp4' : 'webm';
    form.append('audio', opts.audio, `session_${sessionId}.${ext}`);
  }
  const res = await apiRequest(`/api/queue/${sessionId}/complete/`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? 'Gagal menyelesaikan sesi.');
  }
  return res.json();
}

// ── Approve / Reject ───────────────────────────────────────────────────────────

export async function approveSubmission(id: number, payload: ApprovePayload): Promise<{ message: string; session: SessionInfo }> {
  const res = await apiRequest(`/api/submissions/${id}/approve/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = body as Record<string, unknown>;
    throw new Error((err.detail as string) ?? JSON.stringify(err));
  }
  return res.json();
}

export async function rejectSubmission(id: number, payload: RejectPayload): Promise<{ message: string }> {
  const res = await apiRequest(`/api/submissions/${id}/reject/`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = body as Record<string, unknown>;
    throw new Error((err.detail as string) ?? JSON.stringify(err));
  }
  return res.json();
}

// ── Phase 6 (merge): riwayat sesi + logbook (STT/AI + fallback manual) ─────────
// Ringkasan kini disimpan di SessionLogbook (apps.logbook), bukan Session.summary.
// Detail/approve/manual pindah dari /api/queue/<id>/summary/ ke /api/logbook/.

export type LogbookStatus =
  | 'pending' | 'transcribing' | 'summarizing'
  | 'ready_for_review' | 'approved' | 'failed';

export interface SessionHistoryItem {
  id: number;
  scheduled_at: string | null;
  ts2: string | null;
  mahasiswa_name: string;
  nim: string;
  dosen_name: string;
  symptom_name: string;
  has_recording: boolean;
  summary_status: LogbookStatus | null; // dulu: has_summary (boolean)
  summary_approved_at: string | null;
}

// Ringkasan terstruktur hasil AI (schemas.SessionSummary). Untuk jalur manual,
// backend mengisi { manual_notes } sebagai gantinya.
export interface SessionSummaryContent {
  advice_points?: { topic: string; detail: string; grounded?: boolean }[];
  improvement_notes?: { area: string; action: string; grounded?: boolean }[];
  manual_notes?: string;
}

export interface LogbookDetail {
  session_id: number;
  mahasiswa_id: number;
  mahasiswa_name: string;
  nim: string;
  dosen_name: string;
  scheduled_at: string | null;
  ts1: string | null;
  ts2: string | null;
  has_recording: boolean;
  status: LogbookStatus;
  is_manual: boolean;
  transcript: string;
  summary_raw: SessionSummaryContent;
  summary_edited: SessionSummaryContent | null;
  approved_at: string | null;
  // Token/biaya LLM (D-11) — hanya dikirim di endpoint dosen; absen untuk mahasiswa.
  llm_input_tokens?: number | null;
  llm_output_tokens?: number | null;
  llm_cost_estimate_idr?: string | null;
  // Phase 7 SC3-5: status sinkron ke logbook kampus (Sekawan/KPTI).
  campus_sync_status?: CampusSyncStatus;
  campus_entry_id?: string;
  campus_synced_at?: string | null;
}

export type CampusSyncStatus = 'not_synced' | 'synced' | 'failed' | 'pending_retry';

/** URL unduhan ekspor CSV/PDF ringkasan (SC4) — fallback upload manual ke logbook kampus. */
export function getLogbookExportUrl(sessionId: number, format: 'csv' | 'pdf'): string {
  return resolveUrl(`/api/logbook/${sessionId}/export/?format=${format}`);
}

export async function getLecturerSessionHistory(): Promise<SessionHistoryItem[]> {
  const res = await apiRequest('/api/queue/lecturer/history/');
  if (!res.ok) throw new Error('Gagal memuat riwayat sesi.');
  return res.json();
}

export async function getStudentSessionHistory(): Promise<SessionHistoryItem[]> {
  const res = await apiRequest('/api/queue/my/history/');
  if (!res.ok) throw new Error('Gagal memuat riwayat sesi.');
  return res.json();
}

/** Dosen: detail logbook (transkrip + ringkasan raw/editan). */
export async function getLogbookDetail(sessionId: number): Promise<LogbookDetail> {
  const res = await apiRequest(`/api/logbook/${sessionId}/`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? 'Gagal memuat logbook.');
  }
  return res.json();
}

/** Mahasiswa: hanya logbook miliknya yang sudah disetujui. */
export async function getStudentLogbookDetail(sessionId: number): Promise<LogbookDetail> {
  const res = await apiRequest(`/api/logbook/student/${sessionId}/`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? 'Ringkasan belum tersedia.');
  }
  return res.json();
}

/** Dosen menyetujui logbook ready_for_review dengan ringkasan editan. */
export async function approveLogbook(
  sessionId: number,
  summaryEdited: SessionSummaryContent
): Promise<LogbookDetail> {
  const res = await apiRequest(`/api/logbook/${sessionId}/approve/`, {
    method: 'POST',
    body: JSON.stringify({ summary_edited: summaryEdited }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? 'Gagal menyetujui ringkasan.');
  }
  return res.json();
}

/** Gate tambahan (STT-04): dosen menolak draf AI ready_for_review, dialihkan ke jalur manual. */
export async function rejectLogbook(sessionId: number): Promise<LogbookDetail> {
  const res = await apiRequest(`/api/logbook/${sessionId}/reject/`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? 'Gagal menolak ringkasan.');
  }
  return res.json();
}

/** Fallback manual (STT-07): dosen menulis catatan bebas saat pipeline gagal/mati. */
export async function saveManualNotes(
  sessionId: number,
  notes: string
): Promise<LogbookDetail> {
  const res = await apiRequest(`/api/logbook/${sessionId}/manual-notes/`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? 'Gagal menyimpan catatan.');
  }
  return res.json();
}

/** URL untuk elemen <audio src=...> — cookie sesi ikut terkirim (same-origin via proxy). */
export function getSessionRecordingUrl(sessionId: number): string {
  return `/api/queue/${sessionId}/recording/`;
}

// ── Advice items (Phase 7, ADVICE-01/02) ────────────────────────────────────────

export interface ActionItem {
  id: number;
  description: string;
  is_completed: boolean;
  completion_note?: string;
  created_at: string;
  completed_at: string | null;
}

/** Dosen & mahasiswa (pemilik sesi): daftar saran untuk satu sesi. */
export async function getActionItems(sessionId: number): Promise<ActionItem[]> {
  const res = await apiRequest(`/api/queue/${sessionId}/action-items/`);
  if (!res.ok) throw new Error('Gagal memuat daftar saran.');
  return res.json();
}

/** Dosen: menambah satu saran untuk sesi ini. */
export async function addActionItem(sessionId: number, description: string): Promise<ActionItem> {
  const res = await apiRequest(`/api/queue/${sessionId}/action-items/`, {
    method: 'POST',
    body: JSON.stringify({ description }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? 'Gagal menambah saran.');
  }
  return res.json();
}

/** Dosen: mengubah teks satu saran (G1). */
export async function updateActionItem(sessionId: number, id: number, description: string): Promise<ActionItem> {
  const res = await apiRequest(`/api/queue/${sessionId}/action-items/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ description }),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error((b as { detail?: string }).detail ?? 'Gagal mengubah saran.');
  }
  return res.json();
}

/** Dosen: menghapus satu saran (G1). */
export async function deleteActionItem(sessionId: number, id: number): Promise<void> {
  const res = await apiRequest(`/api/queue/${sessionId}/action-items/${id}/`, { method: 'DELETE' });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error((b as { detail?: string }).detail ?? 'Gagal menghapus saran.');
  }
}

/** Mahasiswa: menandai satu saran sebagai sudah ditindaklanjuti, dengan catatan/bukti opsional. */
export async function completeActionItem(
  id: number,
  note?: string
): Promise<{ id: number; is_completed: true; completion_note: string; completed_at: string }> {
  const res = await apiRequest(`/api/action-items/${id}/complete/`, {
    method: 'POST',
    body: JSON.stringify(note !== undefined ? { note } : {}),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? 'Gagal menandai saran selesai.');
  }
  return res.json();
}

// ── ADVICE-02 (Phase 7 SC2): rekap saran agregat per mahasiswa bimbingan ──────

export interface AdviceHistoryItem {
  id: number;
  session_id: number;
  description: string;
  is_completed: boolean;
  completion_note?: string;
  created_at: string;
  completed_at: string | null;
}

export interface AdviceHistoryStudent {
  student_id: number;
  nama: string;
  nim: string;
  total_saran: number;
  saran_selesai: number;
  items: AdviceHistoryItem[];
}

export interface LecturerAdviceHistory {
  total_saran: number;
  saran_selesai: number;
  compliance_rate: number;
  per_mahasiswa: AdviceHistoryStudent[];
}

/** Dosen: rekap saran lintas sesi & status tindak lanjut, dikelompokkan per mahasiswa bimbingan. */
export async function getLecturerAdviceHistory(): Promise<LecturerAdviceHistory> {
  const res = await apiRequest('/api/queue/lecturer/advice-history/');
  if (!res.ok) throw new Error('Gagal memuat riwayat saran.');
  return res.json();
}

// ── Calendar status ────────────────────────────────────────────────────────────

export async function getCalendarStatus(): Promise<{ enabled: boolean; connected: boolean }> {
  const res = await apiRequest('/api/calendar/status/');
  if (!res.ok) throw new Error('Gagal memeriksa status Calendar.');
  return res.json();
}

export function getCalendarAuthUrl(): string {
  return resolveUrl('/api/calendar/auth/');
}
