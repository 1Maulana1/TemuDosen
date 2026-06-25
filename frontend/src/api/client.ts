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
export function getCsrfToken(): string {
  return (
    document.cookie
      .split(';')
      .find((c) => c.trim().startsWith('csrftoken='))
      ?.split('=')[1] ?? ''
  );
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

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

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  if (isUnsafe) {
    headers['X-CSRFToken'] = getCsrfToken();
  }

  return fetch(url, {
    ...options,
    credentials: 'include', // always send session cookie (Pitfall 2 prevention)
    headers,
  });
}
