/**
 * Logbook API — Phase 6 (STT-04/05/06/07).
 */
import { apiRequest } from './client';

// ── Types ──────────────────────────────────────────────────────────────────────

export type LogbookStatus =
  | 'pending'
  | 'transcribing'
  | 'summarizing'
  | 'ready_for_review'
  | 'approved'
  | 'failed';

export interface AdvicePoint {
  topic: string;
  detail: string;
  grounded?: boolean;
}

export interface ImprovementNote {
  area: string;
  action: string;
  grounded?: boolean;
}

export interface LogbookSummary {
  advice_points: AdvicePoint[];
  improvement_notes: ImprovementNote[];
}

export interface ManualNotesSummary {
  manual_notes: string;
}

/** ManualNotesView (STT-07 fallback) stores {manual_notes} instead of the
 * structured {advice_points, improvement_notes} shape — callers must check
 * this before assuming either summary_raw or summary_edited has those keys. */
export function isManualNotesSummary(
  summary: LogbookSummary | ManualNotesSummary | null | undefined,
): summary is ManualNotesSummary {
  return !!summary && 'manual_notes' in summary;
}

export interface LogbookListItem {
  id: number;
  session_id: number;
  student_nim: string;
  student_name: string;
  session_date: string | null;
  status: LogbookStatus;
  is_manual: boolean;
}

export interface LogbookDetail extends LogbookListItem {
  source_mode: 'offline' | 'online';
  transcript: string;
  summary_raw: LogbookSummary;
  summary_edited: LogbookSummary | ManualNotesSummary | null;
  approved_at: string | null;
}

// ── Lecturer ───────────────────────────────────────────────────────────────────

export async function getLecturerLogbooks(): Promise<LogbookListItem[]> {
  const res = await apiRequest('/api/logbook/lecturer/');
  if (!res.ok) throw new Error('Gagal memuat daftar logbook.');
  return res.json();
}

export async function getLogbookDetail(sessionId: number): Promise<LogbookDetail> {
  const res = await apiRequest(`/api/logbook/${sessionId}/`);
  if (!res.ok) throw new Error('Gagal memuat detail logbook.');
  return res.json();
}

export async function approveLogbook(sessionId: number, summaryEdited: LogbookSummary): Promise<LogbookDetail> {
  const res = await apiRequest(`/api/logbook/${sessionId}/approve/`, {
    method: 'POST',
    body: JSON.stringify({ summary_edited: summaryEdited }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? 'Gagal menyetujui logbook.');
  }
  return res.json();
}

export async function rejectLogbook(sessionId: number): Promise<LogbookDetail> {
  const res = await apiRequest(`/api/logbook/${sessionId}/reject/`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? 'Gagal menolak logbook.');
  }
  return res.json();
}

export async function saveManualNotes(sessionId: number, notes: string): Promise<LogbookDetail> {
  const res = await apiRequest(`/api/logbook/${sessionId}/manual-notes/`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? 'Gagal menyimpan catatan manual.');
  }
  return res.json();
}

// ── Student ────────────────────────────────────────────────────────────────────

export async function getStudentLogbook(sessionId: number): Promise<LogbookDetail> {
  const res = await apiRequest(`/api/logbook/student/${sessionId}/`);
  if (!res.ok) throw new Error('Gagal memuat logbook.');
  return res.json();
}
