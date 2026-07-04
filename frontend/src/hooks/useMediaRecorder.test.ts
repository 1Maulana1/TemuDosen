/**
 * useMediaRecorder — SESSION-03: rekaman mulai/berhenti + fallback tanpa izin mic.
 * MediaRecorder/getUserMedia di-shim di src/test/setup.ts (jsdom tidak punya keduanya).
 */
import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useMediaRecorder } from './useMediaRecorder';
import { makeMockStream } from '../test/setup';

function mockGetUserMedia(impl: () => Promise<unknown>) {
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    writable: true,
    value: { getUserMedia: impl },
  });
}

afterEach(() => {
  // Kembalikan implementasi default (berhasil) agar test lain tidak terpengaruh
  mockGetUserMedia(async () => makeMockStream());
  vi.restoreAllMocks();
});

describe('useMediaRecorder (SESSION-03)', () => {
  it('start() begins recording and sets isRecording', async () => {
    const { result } = renderHook(() => useMediaRecorder());
    expect(result.current.state).toBe('idle');

    let ok = false;
    await act(async () => { ok = await result.current.start(); });

    expect(ok).toBe(true);
    expect(result.current.isRecording).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('stop() resolves with an audio Blob after recording', async () => {
    const { result } = renderHook(() => useMediaRecorder());
    await act(async () => { await result.current.start(); });

    let blob: Blob | null = null;
    await act(async () => { blob = await result.current.stop(); });

    expect(blob).not.toBeNull();
    expect(blob!.size).toBeGreaterThan(0);
    expect(result.current.state).toBe('idle');
  });

  it('stop() without start resolves null (sesi tanpa rekaman)', async () => {
    const { result } = renderHook(() => useMediaRecorder());

    let blob: Blob | null = new Blob(['x']);
    await act(async () => { blob = await result.current.stop(); });

    expect(blob).toBeNull();
  });

  it('permission denied → start() returns false with error, no crash', async () => {
    mockGetUserMedia(async () => { throw new DOMException('Permission denied', 'NotAllowedError'); });

    const { result } = renderHook(() => useMediaRecorder());
    let ok = true;
    await act(async () => { ok = await result.current.start(); });

    expect(ok).toBe(false);
    expect(result.current.state).toBe('error');
    expect(result.current.error).toMatch(/mikrofon/i);
  });

  it('browser without MediaRecorder → start() returns false gracefully', async () => {
    const original = globalThis.MediaRecorder;
    // @ts-expect-error — simulate Safari-tanpa-dukungan / browser lama
    delete globalThis.MediaRecorder;
    try {
      const { result } = renderHook(() => useMediaRecorder());
      let ok = true;
      await act(async () => { ok = await result.current.start(); });

      expect(ok).toBe(false);
      expect(result.current.state).toBe('error');
    } finally {
      globalThis.MediaRecorder = original;
    }
  });
});
