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

export interface LecturerQueueResponse {
  totalWaiting: number;
  estimatedEndTime: string;
  queue: LecturerQueueItem[];
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

// ── Calendar status ────────────────────────────────────────────────────────────

export async function getCalendarStatus(): Promise<{ enabled: boolean; connected: boolean }> {
  const res = await apiRequest('/api/calendar/status/');
  if (!res.ok) throw new Error('Gagal memeriksa status Calendar.');
  return res.json();
}

export function getCalendarAuthUrl(): string {
  return '/api/calendar/auth/';
}
