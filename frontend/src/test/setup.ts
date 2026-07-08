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

  // Notifications — the NotificationBell in AppNavbar fetches this on every page
  // that renders the nav; default to empty so tests don't need to mock it.
  http.get('/api/notifications/', () => {
    return HttpResponse.json({ unread_count: 0, notifications: [] });
  }),
];

export const server = setupServer(...defaultHandlers);

// Start MSW before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// Reset handlers after each test so test-specific overrides don't leak
afterEach(() => server.resetHandlers());

// Stop MSW after all tests complete
afterAll(() => server.close());

// ── MediaRecorder / getUserMedia shim (Phase 5 Wave 0) ─────────────────────────
// jsdom tidak mengimplementasikan MediaRecorder sama sekali. Shim minimal ini
// membuat useMediaRecorder bisa diuji; test individual bisa override perilakunya
// (mis. getUserMedia reject untuk skenario izin ditolak).

export class MockMediaRecorder {
  static isTypeSupported = (type: string) => type.startsWith('audio/webm');

  stream: unknown;
  mimeType: string;
  state: 'inactive' | 'recording' | 'paused' = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(stream: unknown, options?: { mimeType?: string }) {
    this.stream = stream;
    this.mimeType = options?.mimeType ?? 'audio/webm';
  }

  start(_timesliceMs?: number) {
    this.state = 'recording';
  }

  stop() {
    this.state = 'inactive';
    // Emit satu chunk dummy lalu stop — meniru urutan event MediaRecorder asli
    this.ondataavailable?.({ data: new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])], { type: this.mimeType }) });
    this.onstop?.();
  }
}

export function makeMockStream() {
  return { getTracks: () => [{ stop: () => {} }] };
}

// @ts-expect-error — jsdom global has no MediaRecorder type
globalThis.MediaRecorder = MockMediaRecorder;

Object.defineProperty(globalThis.navigator, 'mediaDevices', {
  configurable: true,
  writable: true,
  value: {
    getUserMedia: async () => makeMockStream(),
  },
});
