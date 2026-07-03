/**
 * API client for SymptomCategory endpoints.
 *
 * Wraps:
 *   GET    /api/symptoms/              → fetchSymptoms
 *   POST   /api/symptoms/              → createSymptom
 *   PATCH  /api/symptoms/<id>/         → updateSymptom
 *   DELETE /api/symptoms/<id>/         → deleteSymptom
 *   POST   /api/symptoms/bulk-update/  → bulkUpdateSymptoms
 *
 * All calls go through the apiRequest wrapper (credentials:include + X-CSRFToken).
 */

import { apiRequest } from './client';

export interface SymptomCategory {
  id: number;
  name: string;
  category: string;
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BulkUpdateItem {
  id: number;
  name?: string;
  category?: string;
  duration_minutes?: number;
  is_active?: boolean;
}

/**
 * Fetch all symptom categories.
 * Requires IsApprovedUser (any authenticated + approved role).
 */
export async function fetchSymptoms(): Promise<SymptomCategory[]> {
  const response = await apiRequest('/api/symptoms/');
  if (!response.ok) {
    throw new Error(`Failed to fetch symptoms: ${response.status}`);
  }
  return response.json();
}

/**
 * Create a new symptom category.
 * Requires IsAdmin.
 */
export async function createSymptom(
  data: Pick<SymptomCategory, 'name' | 'category' | 'duration_minutes'> & Partial<Pick<SymptomCategory, 'is_active'>>
): Promise<SymptomCategory> {
  const response = await apiRequest('/api/symptoms/', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(JSON.stringify(error));
  }
  return response.json();
}

/**
 * Partially update a symptom category.
 * Requires IsAdmin.
 */
export async function updateSymptom(
  id: number,
  data: Partial<Pick<SymptomCategory, 'name' | 'category' | 'duration_minutes' | 'is_active'>>
): Promise<SymptomCategory> {
  const response = await apiRequest(`/api/symptoms/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(JSON.stringify(error));
  }
  return response.json();
}

/**
 * Delete a symptom category.
 * Requires IsAdmin.
 */
export async function deleteSymptom(id: number): Promise<void> {
  const response = await apiRequest(`/api/symptoms/${id}/`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete symptom ${id}: ${response.status}`);
  }
}

/**
 * Bulk-update symptom categories in one atomic request (D-07).
 * Requires IsAdmin.
 */
export async function bulkUpdateSymptoms(
  items: BulkUpdateItem[]
): Promise<SymptomCategory[]> {
  const response = await apiRequest('/api/symptoms/bulk-update/', {
    method: 'POST',
    body: JSON.stringify(items),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(JSON.stringify(error));
  }
  return response.json();
}
