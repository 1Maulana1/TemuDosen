/**
 * Vitest test setup (Wave 0).
 * - @testing-library/jest-dom: adds custom matchers (toBeInTheDocument, etc.)
 * - MSW: Mock Service Worker for API mocking in tests
 */
import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Default MSW handlers — override in individual test files as needed
const defaultHandlers = [
  // CSRF endpoint — always returns 200
  http.get('/api/csrf/', () => {
    return HttpResponse.json({ detail: 'CSRF cookie set' });
  }),

  // Me endpoint — returns 403 by default (unauthenticated)
  http.get('/api/auth/me/', () => {
    return HttpResponse.json({ detail: 'Authentication credentials were not provided.' }, { status: 403 });
  }),
];

export const server = setupServer(...defaultHandlers);

// Start MSW before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// Reset handlers after each test so test-specific overrides don't leak
afterEach(() => server.resetHandlers());

// Stop MSW after all tests complete
afterAll(() => server.close());
