/**
 * Thesis (skripsi) progress checklist — audit T2.
 * Replaces the previously-static "Progres Skripsi" mock on the student dashboard.
 */
import { apiRequest } from './client';

export interface ThesisChapter {
  id: number;
  order: number;
  title: string;
  is_completed: boolean;
}

export interface ThesisProgress {
  chapters: ThesisChapter[];
  total: number;
  completed: number;
  percent: number;
}

export async function getThesisProgress(): Promise<ThesisProgress> {
  const res = await apiRequest('/api/thesis-progress/');
  if (!res.ok) throw new Error('Gagal memuat progres skripsi.');
  return res.json();
}

export async function updateThesisChapter(id: number, isCompleted: boolean): Promise<ThesisChapter> {
  const res = await apiRequest(`/api/thesis-progress/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ is_completed: isCompleted }),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error((b as { detail?: string }).detail ?? 'Gagal memperbarui progres.');
  }
  return res.json();
}

// ── Lecturer-side (dosen menandai bab skripsi mahasiswa bimbingannya) ──────────

export async function getStudentThesisProgress(studentId: number): Promise<ThesisProgress> {
  const res = await apiRequest(`/api/thesis-progress/lecturer/${studentId}/`);
  if (!res.ok) throw new Error('Gagal memuat progres skripsi mahasiswa.');
  return res.json();
}

export async function updateStudentThesisChapter(
  studentId: number,
  chapterId: number,
  isCompleted: boolean,
): Promise<ThesisChapter> {
  const res = await apiRequest(`/api/thesis-progress/lecturer/${studentId}/${chapterId}/`, {
    method: 'PATCH',
    body: JSON.stringify({ is_completed: isCompleted }),
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new Error((b as { detail?: string }).detail ?? 'Gagal memperbarui progres.');
  }
  return res.json();
}
