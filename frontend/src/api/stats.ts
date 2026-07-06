import { apiRequest } from './client';

export interface LecturerStats {
  total_sessions_week: number;
  done_sessions_week: number;
  avg_duration_minutes: number;
}

export interface AdminLecturerOption {
  id: number;
  full_name: string;
  active_sessions: number;
}

export interface AdminStats {
  total_students: number;
  total_lecturers: number;
  total_pending_users: number;
  active_sessions_today: number;
  recent_errors: { id: number; event_type: string; message: string; created_at: string }[];
  lecturers: AdminLecturerOption[];
  stt_llm: {
    transcription_success: number;
    summary_success: number;
    failed_fallback: number;
    monthly_cost_idr: number;
    avg_cost_per_session_idr: number;
  };
  integrations: {
    google_calendar: { enabled: boolean; connected_dosens: number };
    logbook: { enabled: boolean };
  };
}

export type ReportPeriod = 'weekly' | 'monthly' | 'semester';

export interface DosenWorkload {
  dosen_id: number;
  dosen_name: string;
  total_sesi: number;
  total_durasi_menit: number;
  rata_rata_durasi: number;
  kuota_harian_menit: number;
}

export interface KetuaJurusanStats {
  period: ReportPeriod;
  period_label: string;
  total_sesi: number;
  rata_rata_waktu_tunggu: number;
  sesi_selesai: number;
  sesi_dibatalkan: number;
  beban_per_dosen: DosenWorkload[];
}

export interface ComplianceRow {
  nama?: string;
  nim?: string;
  dosen_name?: string;
  total_saran: number;
  saran_selesai: number;
  compliance_rate: number;
}

export interface KetuaJurusanCompliance {
  period: ReportPeriod;
  period_label: string;
  compliance_rate: number;
  per_dosen: ComplianceRow[];
  per_mahasiswa: ComplianceRow[];
}

export interface AdminLogEntry {
  id: number;
  type: string;
  level: string;
  message: string;
  created_at: string;
}

export interface AdminLogsResponse {
  total: number;
  page: number;
  limit: number;
  logs: AdminLogEntry[];
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

export async function adminEmergencyCancel(
  dosenId: number,
  alasan: string
): Promise<{ message: string; dosen_name: string; sessions_cancelled: number; alasan: string }> {
  const r = await apiRequest('/api/admin/emergency-cancel/', {
    method: 'POST',
    body: JSON.stringify({ dosen_id: dosenId, alasan }),
  });
  if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error((b as {detail?:string}).detail ?? 'Gagal.'); }
  return r.json();
}

export async function getAdminLogs(params: { type?: string; page?: number; limit?: number } = {}): Promise<AdminLogsResponse> {
  const query = new URLSearchParams();
  if (params.type) query.set('type', params.type);
  query.set('page', String(params.page ?? 1));
  query.set('limit', String(params.limit ?? 50));
  const r = await apiRequest(`/api/admin/logs/?${query.toString()}`);
  if (!r.ok) throw new Error('Gagal memuat log sistem.');
  return r.json();
}

export async function cleanupAdminLogs(): Promise<{ deleted: number }> {
  const r = await apiRequest('/api/admin/logs/cleanup/', { method: 'POST' });
  if (!r.ok) throw new Error('Gagal menghapus log lama.');
  return r.json();
}

export async function getKetuaJurusanStats(period: ReportPeriod = 'monthly'): Promise<KetuaJurusanStats> {
  const r = await apiRequest(`/api/ketua-jurusan/stats/?period=${period}`);
  if (!r.ok) throw new Error('Gagal memuat statistik ketua jurusan.');
  return r.json();
}

export async function getKetuaJurusanCompliance(period: ReportPeriod = 'monthly'): Promise<KetuaJurusanCompliance> {
  const r = await apiRequest(`/api/ketua-jurusan/compliance/?period=${period}`);
  if (!r.ok) throw new Error('Gagal memuat data kepatuhan.');
  return r.json();
}

export function getKetuaJurusanExportUrl(period: ReportPeriod = 'monthly', format: 'csv' | 'pdf' = 'csv'): string {
  return `/api/ketua-jurusan/export/?period=${period}&format=${format}`;
}

export interface StartSessionConsent {
  consent_by_dosen: boolean;
  consent_by_mahasiswa: boolean;
}

export async function startSession(sessionId: number, consent?: StartSessionConsent): Promise<void> {
  const r = await apiRequest(`/api/queue/${sessionId}/start/`, {
    method: 'POST',
    body: JSON.stringify(consent ?? { consent_by_dosen: false, consent_by_mahasiswa: false }),
  });
  if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error((b as {detail?:string}).detail ?? 'Gagal.'); }
}
