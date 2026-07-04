/**
 * useMediaRecorder — SESSION-03/04: rekaman audio sesi bimbingan.
 *
 * Membungkus getUserMedia + MediaRecorder dengan graceful fallback:
 * jika browser tidak mendukung atau izin mikrofon ditolak, `start()`
 * mengembalikan false dan sesi tetap berjalan tanpa rekaman.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

export type RecorderState = 'idle' | 'recording' | 'error';

/** Pilih MIME type audio pertama yang didukung browser (Safari tidak punya WebM). */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return undefined;
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

export function useMediaRecorder() {
  const [state, setState] = useState<RecorderState>('idle');
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const cleanup = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  /** Minta izin mikrofon dan mulai merekam. Return true jika rekaman berjalan. */
  const start = useCallback(async (): Promise<boolean> => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError('Browser tidak mendukung perekaman audio.');
      setState('error');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(1000); // kumpulkan chunk tiap detik agar data tidak hilang total saat crash
      streamRef.current = stream;
      recorderRef.current = recorder;
      setError(null);
      setState('recording');
      return true;
    } catch {
      setError('Izin mikrofon ditolak — sesi berjalan tanpa rekaman.');
      setState('error');
      cleanup();
      return false;
    }
  }, [cleanup]);

  /** Hentikan rekaman dan kembalikan Blob audio (null jika tidak ada rekaman). */
  const stop = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        cleanup();
        setState('idle');
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm';
        const blob = chunksRef.current.length > 0 ? new Blob(chunksRef.current, { type }) : null;
        cleanup();
        setState('idle');
        resolve(blob);
      };
      recorder.stop();
    });
  }, [cleanup]);

  // Matikan mikrofon saat komponen unmount agar indikator rekaman browser tidak menggantung
  useEffect(() => cleanup, [cleanup]);

  return { state, error, start, stop, isRecording: state === 'recording' };
}
