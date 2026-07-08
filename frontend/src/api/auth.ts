/**
 * Authentication API functions.
 *
 * getCSRFToken: call on app mount to force Django to set the csrftoken cookie
 * login: POST /api/auth/login/ — returns User on success
 * logout: POST /api/auth/logout/
 * getCurrentUser: GET /api/auth/me/ — returns User or null
 */
import { apiRequest } from './client';

export interface AdviserInfo {
  id: number;
  full_name: string;
  nidn: string | null;
  email: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'student' | 'lecturer' | 'admin' | 'ketua_jurusan';
  nim: string | null;
  nidn: string | null;
  is_approved: boolean;
  is_active: boolean;
  created_at: string;
  /** Adviser info (only populated for students with an assigned adviser, D-24) */
  adviser?: AdviserInfo | null;
}

/**
 * Fetch GET /api/csrf/ to force Django to set the csrftoken cookie.
 * Must be awaited before any POST/PUT/PATCH/DELETE (Pitfall 3 prevention).
 * Called in main.tsx before rendering the React tree.
 */
export async function getCSRFToken(): Promise<void> {
  try {
    await apiRequest('/api/csrf/');
  } catch {
    // Non-fatal: cookie may already be set from a previous visit.
    // The request will fail gracefully if the backend is unreachable.
    console.warn('[auth] Failed to fetch CSRF token. Proceeding anyway.');
  }
}

/**
 * POST /api/auth/login/
 * Returns the User object on success.
 * Throws an Error with the server's detail message on failure.
 */
export async function login(email: string, password: string): Promise<User> {
  const response = await apiRequest('/api/auth/login/', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    // U5: pesan throttle DRF (429) berbahasa Inggris — ganti copy Indonesia.
    if (response.status === 429) {
      throw new Error('Terlalu banyak percobaan masuk. Tunggu sebentar lalu coba lagi.');
    }
    throw new Error(data.detail ?? 'Login gagal. Periksa email dan password Anda.');
  }

  return data as User;
}

/**
 * POST /api/auth/logout/
 * Ends the current session. No-op if not logged in.
 */
export async function logout(): Promise<void> {
  await apiRequest('/api/auth/logout/', { method: 'POST' });
}

/**
 * GET /api/auth/me/
 * Returns the current authenticated User, or null if not logged in (403).
 * Also surfaces is_approved so the router can redirect unapproved users (Pitfall 8).
 */
export async function getCurrentUser(): Promise<User | null> {
  const response = await apiRequest('/api/auth/me/');

  if (response.status === 403 || response.status === 401) {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<User>;
}
