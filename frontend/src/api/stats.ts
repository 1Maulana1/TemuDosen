import { apiRequest } from './client';

export interface LecturerStats {
  total_sessions_week: number;
  done_sessions_week: number;
  avg_duration_minutes: number;
}

export interface AdminStats {
  total_students: number;
  total_lecturers: number;
  total_pending_users: number;
  active_sessions_today: number;
  recent_errors: { id: number; event_type: string; message: string; created_at: string }[];
  integrations: {
    google_calendar: { enabled: boolean; connected_dosens: number };
    logbook: { enabled: boolean };
  };
}

export interface DosenWorkload {
  dosen_id: number;
  dosen_name: string;
  total_sessions: number;
  avg_duration: number;
}

export interface KaprodiStats {
  total_sessions_month: number;
  avg_wait_minutes: number;
  dosen_workload: DosenWorkload[];
  month_label: string;
}

export async function getLecturerStats(): Promise<LecturerStats> {
  const r = await apiRequest('/api/stats/lecturer/');
  if (!r.ok) throw new Error('Gagal memuat statistik dosen.');
  return r.json();
}

export async function getAdminStats(): Promise<AdminStats> {
  const r = await apiRequest('/api/stats/admin/');
  if (!r.ok) throw new Error('Gagal memuat statistik admin.');
  return r.json();
}

export async function adminEmergencyCancel(dosenId: number): Promise<{ message: string; cancelled: number }> {
  const r = await apiRequest('/api/stats/admin/emergency-cancel/', {
    method: 'POST',
    body: JSON.stringify({ dosen_id: dosenId }),
  });
  if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error((b as {detail?:string}).detail ?? 'Gagal.'); }
  return r.json();
}

export async function getKaprodiStats(): Promise<KaprodiStats> {
  const r = await apiRequest('/api/stats/kaprodi/');
  if (!r.ok) throw new Error('Gagal memuat statistik kaprodi.');
  return r.json();
}

export function getKaprodiExportUrl(): string {
  return '/api/stats/kaprodi/export/';
}

export async function startSession(sessionId: number): Promise<void> {
  const r = await apiRequest(`/api/queue/${sessionId}/start/`, { method: 'POST' });
  if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error((b as {detail?:string}).detail ?? 'Gagal.'); }
}
