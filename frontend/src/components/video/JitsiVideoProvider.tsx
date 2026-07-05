/**
 * JitsiVideoProvider — VIDEO-01. Embeds a Jitsi call via @jitsi/react-sdk's
 * JitsiMeeting against the public meet.jit.si instance (D-12, MVP/demo-only —
 * see the accepted T-06-19/T-06-20 limitations in 06-08-PLAN.md).
 *
 * No dual-audio mixing here (D-16 cancelled) — the External API exposes no
 * remote MediaStreamTrack, only metadata-level commands/events.
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
            // The External API exposes no onError callback — the iframe's own
            // load-error event is the only signal available for a genuine
            // load failure (distinct from the mic-only useMediaRecorder
            // permission flow, per S-16/T-06-21).
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
