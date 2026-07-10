/**
 * Core API request wrapper for TemuDosen.
 *
 * Key behaviors (RESEARCH Pattern 2):
 * - credentials: 'include' on every request so the session cookie is always sent (Pitfall 2)
 * - X-CSRFToken header injected on all unsafe methods (POST, PUT, PATCH, DELETE)
 * - getCsrfToken() reads the csrftoken cookie set by GET /api/csrf/ on app mount
 */

/**
 * Read the csrftoken cookie value.
 * Django sets this via GET /api/csrf/ before the first POST (Pitfall 3 prevention).
 */
// Fallback in-memory token: saat backend di domain lain (cross-site, mis.
// Vercel ↔ Railway), document.cookie tidak bisa membaca cookie csrftoken milik
// domain backend, jadi nilai token diambil dari body respons /api/csrf/.
let csrfTokenMemory = '';

/** Simpan token CSRF dari body respons /api/csrf/ (dipakai saat cross-site). */
export function setCsrfToken(token: string): void {
  csrfTokenMemory = token;
}

export function getCsrfToken(): string {
  return (
    document.cookie
      .split(';')
      .find((c) => c.trim().startsWith('csrftoken='))
      ?.split('=')[1] ?? csrfTokenMemory
  );
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Base URL for the Django backend.
 *
 * - Dev: leave VITE_API_URL unset → stays '' so relative '/api/*' paths go
 *   through the Vite proxy (see vite.config.ts).
 * - Prod (Cloudflare Pages): set VITE_API_URL to the backend origin, e.g.
 *   https://api.temudosen.com → requests become absolute cross-origin calls.
 *
 * Trailing slash is stripped so we never produce a double slash.
 */
const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/** Prepend API_BASE to root-relative ('/...') URLs; leave absolute URLs as-is. */
export function resolveUrl(url: string): string {
  return url.startsWith('/') ? API_BASE + url : url;
}

/**
 * Central fetch wrapper — wraps all API calls in the frontend.
 *
 * @param url   Relative or absolute URL (relative paths go through Vite proxy → Django)
 * @param options  Standard RequestInit options (method, body, headers, etc.)
 * @returns     The raw Response — callers should check response.ok and parse JSON as needed
 */
export async function apiRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method ?? 'GET').toUpperCase();
  const isUnsafe = UNSAFE_METHODS.has(method);

  // FormData bodies must NOT get an explicit Content-Type — the browser sets
  // multipart/form-data with the correct boundary itself.
  const isFormData = options.body instanceof FormData;

  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (isUnsafe) {
    headers['X-CSRFToken'] = getCsrfToken();
  }

  return fetch(resolveUrl(url), {
    ...options,
    credentials: 'include', // always send session cookie (Pitfall 2 prevention)
    headers,
  });
}
