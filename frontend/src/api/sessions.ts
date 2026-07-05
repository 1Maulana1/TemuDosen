/**
 * Sessions & queue API — Phase 2.
 */
import { apiRequest } from './client';

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

// ── Phase 6 (partial): riwayat sesi, rekaman, ringkasan manual ─────────────────
// STT/LLM otomatis belum ada — dosen mengisi ringkasan secara manual sebagai
// fallback resmi selama pipeline otomatis belum dibangun (lihat backend).

export interface SessionHistoryItem {
  id: number;
  scheduled_at: string | null;
  ts2: string | null;
  mahasiswa_name: string;
  nim: string;
  dosen_name: string;
  symptom_name: string;
  has_recording: boolean;
  has_summary: boolean;
  summary_approved_at: string | null;
}

export interface SessionSummaryDetail {
  id: number;
  mahasiswa_name: string;
  nim: string;
  dosen_name: string;
  scheduled_at: string | null;
  ts1: string | null;
  ts2: string | null;
  has_recording: boolean;
  summary: string;
  summary_approved_at: string | null;
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

export async function getSessionSummary(sessionId: number): Promise<SessionSummaryDetail> {
  const res = await apiRequest(`/api/queue/${sessionId}/summary/`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? 'Gagal memuat ringkasan sesi.');
  }
  return res.json();
}

export async function saveSessionSummary(
  sessionId: number,
  opts: { summary?: string; approve?: boolean }
): Promise<SessionSummaryDetail> {
  const res = await apiRequest(`/api/queue/${sessionId}/summary/`, {
    method: 'PATCH',
    body: JSON.stringify(opts),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? 'Gagal menyimpan ringkasan.');
  }
  return res.json();
}

/** URL untuk elemen <audio src=...> — cookie sesi ikut terkirim (same-origin via proxy). */
export function getSessionRecordingUrl(sessionId: number): string {
  return `/api/queue/${sessionId}/recording/`;
}

// ── Calendar status ────────────────────────────────────────────────────────────

export async function getCalendarStatus(): Promise<{ enabled: boolean; connected: boolean }> {
  const res = await apiRequest('/api/calendar/status/');
  if (!res.ok) throw new Error('Gagal memeriksa status Calendar.');
  return res.json();
}

export function getCalendarAuthUrl(): string {
  return '/api/calendar/auth/';
}
