/**
 * Vitest test setup (Wave 0).
 * - @testing-library/jest-dom: adds custom matchers (toBeInTheDocument, etc.)
 * - MSW: Mock Service Worker for API mocking in tests
 */
import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import React from 'react';

// ── @jitsi/react-sdk shim (Phase 6 Wave 5) ─────────────────────────────────────
// A real Jitsi iframe cannot mount in jsdom. This stub renders a marker element
// (asserting roomName/domain were passed through) plus a hidden test-only
// button that fires onApiReady when clicked — letting tests drive the
// loading -> ready transition deliberately instead of it firing before the
// test can observe the loading state.
vi.mock('@jitsi/react-sdk', () => ({
  JitsiMeeting: (props: {
    roomName: string;
    domain?: string;
    onApiReady?: (api: unknown) => void;
    getIFrameRef?: (el: HTMLDivElement) => void;
  }) => {
    props.getIFrameRef?.(document.createElement('div') as unknown as HTMLDivElement);
    return React.createElement('button', {
      'data-testid': 'jitsi-mock-fire-ready',
      'data-room-name': props.roomName,
      'data-domain': props.domain,
      onClick: () => props.onApiReady?.({}),
    }, 'mock-jitsi-meeting');
  },
}));

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
