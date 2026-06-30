/**
 * API client for Submission endpoints.
 *
 * Wraps:
 *   POST /api/submissions/           → createSubmission (multipart FormData — must NOT force application/json)
 *   GET  /api/submissions/           → fetchMySubmissions (student's own submissions)
 *   GET  /api/submissions/lecturer/  → fetchLecturerSubmissions (lecturer's advisees' submissions)
 *
 * IMPORTANT: createSubmission uses FormData so the browser sets the correct
 * multipart/form-data boundary. Do NOT set Content-Type manually for this call.
 *
 * All calls send credentials:include + X-CSRFToken (inherited from apiRequest except
 * for the Content-Type override for multipart, handled below).
 */

import { getCsrfToken } from './client';

export interface SubmissionSymptom {
  id: number;
  name: string;
  duration_minutes: number;
}

export interface SubmissionSummary {
  id: number;
  status: 'pending' | 'approved' | 'rejected' | 'revision' | 'cancelled';
  description: string;
  symptoms: SubmissionSymptom[];
  file_uuid: string | null;
  file_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateSubmissionResult {
  id: number;
  status: string;
  file_uuid: string;
  created_at: string;
}

export interface CreateSubmissionPayload {
  symptom_ids: number[];
  description?: string;
  draft_file: File;
}

/**
 * Submit a new guidance request (multipart POST).
 *
 * Uses raw fetch (not apiRequest) because we need the browser to set the
 * multipart/form-data Content-Type with the correct boundary automatically.
 * Still sends credentials:include and X-CSRFToken.
 */
export async function createSubmission(
  payload: CreateSubmissionPayload
): Promise<CreateSubmissionResult> {
  const formData = new FormData();

  // Append each symptom_id individually — DRF ListField expects multiple values
  // with the same key name in multipart data
  payload.symptom_ids.forEach((id) => {
    formData.append('symptom_ids', String(id));
  });

  if (payload.description) {
    formData.append('description', payload.description);
  }

  formData.append('draft_file', payload.draft_file);

  const response = await fetch('/api/submissions/', {
    method: 'POST',
    credentials: 'include',
    headers: {
      // Do NOT set Content-Type here — browser must set it with boundary
      'X-CSRFToken': getCsrfToken(),
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(JSON.stringify(error));
  }

  return response.json();
}

/**
 * Fetch the authenticated student's own submissions (for the dashboard S-06).
 * Requires IsStudent permission (authenticated + approved student).
 */
export async function fetchMySubmissions(): Promise<SubmissionSummary[]> {
  const response = await fetch('/api/submissions/', {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch submissions: ${response.status}`);
  }

  return response.json();
}

// ── Lecturer API types (Plan 05 — D-10 columns) ───────────────────────────────

export interface LecturerSubmissionItem {
  id: number;
  student_nim: string;
  student_name: string;
  symptom_names: string[];
  status: 'pending' | 'approved' | 'rejected' | 'revision' | 'cancelled';
  created_at: string;
  original_filename: string | null;
  file_url: string | null;
}

export interface FetchLecturerSubmissionsParams {
  status?: string;
  search?: string;
  ordering?: string;
}

/**
 * Fetch the authenticated lecturer's advisees' submissions (for lecturer dashboard S-08).
 *
 * Calls GET /api/submissions/lecturer/ with optional filter/search/ordering params (D-09, D-11).
 * Requires IsLecturer permission (authenticated + approved lecturer).
 *
 * Security: The backend enforces student__adviser == request.user (REVIEW-01 isolation, T-1-21).
 * The frontend only passes query params — it cannot override the adviser filter.
 */
export async function fetchLecturerSubmissions(
  params: FetchLecturerSubmissionsParams = {}
): Promise<LecturerSubmissionItem[]> {
  const query = new URLSearchParams();

  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);
  if (params.ordering) query.set('ordering', params.ordering);

  const url = `/api/submissions/lecturer/${query.toString() ? '?' + query.toString() : ''}`;

  const response = await fetch(url, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch lecturer submissions: ${response.status}`);
  }

  return response.json();
}
