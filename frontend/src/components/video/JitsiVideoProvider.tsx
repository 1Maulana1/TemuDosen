/**
 * JitsiVideoProvider — panggilan video sesi online lewat @jitsi/react-sdk
 * terhadap instance publik meet.jit.si (demo/MVP — belum self-hosted).
 *
 * Tidak ada mixing audio ganda di sini — External API Jitsi tidak mengekspos
 * remote MediaStreamTrack, hanya command/event level metadata.
 */
import { useState } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';
import type { VideoProviderProps } from './VideoProvider';

export default function JitsiVideoProvider({ roomName, displayName, onApiReady }: VideoProviderProps) {
  const [ready, setReady] = useState(false);
  const [errored, setErrored] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  return (
    <div
      role="group"
      aria-label="Panggilan video sesi bimbingan"
      className="w-full aspect-video rounded-xl overflow-hidden bg-slate-900 ring-1 ring-primary/20 relative"
    >
      {!errored && (
        <JitsiMeeting
          key={retryKey}
          domain="meet.jit.si"
          roomName={roomName}
          configOverwrite={{ startWithAudioMuted: false, prejoinPageEnabled: false }}
          userInfo={{ displayName, email: '' }}
          onApiReady={(api) => {
            setReady(true);
            onApiReady?.(api);
          }}
          getIFrameRef={(iframeEl) => {
            iframeEl.style.height = '100%';
            // External API tidak punya callback onError — error load iframe
            // adalah satu-satunya sinyal kegagalan yang tersedia.
            iframeEl.onerror = () => setErrored(true);
          }}
        />
      )}

      {!ready && !errored && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span className="material-symbols-outlined text-white text-3xl animate-spin" aria-hidden="true">
            progress_activity
          </span>
          <p className="text-white text-sm font-bold">Menghubungkan panggilan video…</p>
        </div>
      )}

      {errored && (
        <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center gap-2 px-4 text-center">
          <span className="material-symbols-outlined text-white text-4xl" aria-hidden="true">videocam_off</span>
          <p className="text-white text-sm">Panggilan video gagal dimuat.</p>
          <button
            type="button"
            onClick={() => { setErrored(false); setReady(false); setRetryKey((k) => k + 1); }}
            className="bg-primary text-on-primary text-sm font-bold rounded-lg px-4 py-2 mt-3 min-h-[44px]"
          >
            Coba Lagi
          </button>
        </div>
      )}
    </div>
  );
}
