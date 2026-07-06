/**
 * VideoProvider — abstraksi penyedia panggilan video. JitsiVideoProvider adalah
 * satu-satunya implementasi saat ini; pemanggil bergantung pada interface ini,
 * bukan langsung ke @jitsi/react-sdk, supaya penyedia lain bisa disubstitusi
 * tanpa menyentuh LecturerQueue.tsx/StudentQueue.tsx.
 */
import JitsiVideoProvider from './JitsiVideoProvider';

export interface VideoProviderProps {
  roomName: string;
  displayName: string;
  onApiReady?: (api: unknown) => void;
}

export default function VideoProvider(props: VideoProviderProps) {
  return <JitsiVideoProvider {...props} />;
}
