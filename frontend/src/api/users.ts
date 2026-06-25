/**
 * User management API functions (Plan 02).
 *
 * register: POST /api/auth/register/ — student or lecturer self-registration
 * fetchLecturers: GET /api/users/lecturers/ — approved lecturers for dropdown
 * fetchPending: GET /api/users/pending/ — pending users list (admin only)
 * approveUser: POST /api/users/<id>/approve/ — admin approval action
 * rejectUser: POST /api/users/<id>/reject/ — admin rejection action
 */
import { apiRequest } from './client';
import type { User } from './auth';

export interface LecturerOption {
  id: number;
  full_name: string;
  nidn: string | null;
  email: string;
}

export interface StudentRegisterPayload {
  role: 'student';
  nim: string;
  full_name: string;
  email: string;
  password: string;
  adviser_id: number;
}

export interface LecturerRegisterPayload {
  role: 'lecturer';
  nidn: string;
  full_name: string;
  email: string;
  password: string;
}

export type RegisterPayload = StudentRegisterPayload | LecturerRegisterPayload;

export interface RegisterError {
  [field: string]: string[];
}

/**
 * POST /api/auth/register/
 * Returns the created User on success.
 * Throws { errors: RegisterError } on validation failure.
 */
export async function register(payload: RegisterPayload): Promise<User> {
  const response = await apiRequest('/api/auth/register/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error('Registrasi gagal.') as Error & { errors: RegisterError };
    error.errors = data as RegisterError;
    throw error;
  }

  return data as User;
}

/**
 * GET /api/users/lecturers/
 * Returns approved lecturers only — safe for the registration dropdown (Pitfall 7).
 * AllowAny on backend — no auth required.
 */
export async function fetchLecturers(): Promise<LecturerOption[]> {
  const response = await apiRequest('/api/users/lecturers/');

  if (!response.ok) {
    throw new Error('Gagal memuat daftar dosen.');
  }

  return response.json() as Promise<LecturerOption[]>;
}

/**
 * GET /api/users/pending/
 * Admin only — returns pending (unapproved) users.
 */
export async function fetchPending(): Promise<User[]> {
  const response = await apiRequest('/api/users/pending/');

  if (!response.ok) {
    throw new Error('Gagal memuat daftar pengguna menunggu.');
  }

  return response.json() as Promise<User[]>;
}

/**
 * POST /api/users/<id>/approve/
 * Admin only — approves a pending user.
 */
export async function approveUser(userId: number): Promise<User> {
  const response = await apiRequest(`/api/users/${userId}/approve/`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Gagal menyetujui pengguna.');
  }

  return response.json() as Promise<User>;
}

/**
 * POST /api/users/<id>/reject/
 * Admin only — rejects (deactivates) a pending user.
 */
export async function rejectUser(userId: number): Promise<User> {
  const response = await apiRequest(`/api/users/${userId}/reject/`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error('Gagal menolak pengguna.');
  }

  return response.json() as Promise<User>;
}
