/**
 * VideoProvider — D-13 abstraction. JitsiVideoProvider is the only
 * implementation today; call sites depend on this interface, not on
 * @jitsi/react-sdk directly, so a future provider could be swapped in
 * without touching LecturerDashboard.tsx/StudentQueue.tsx.
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
