/**
 * StudentQueue — /mahasiswa/queue
 * Phase 2 (FR-M02, FR-S03):
 *  - Nomor antrian besar di tengah
 *  - Estimasi waktu tunggu real-time
 *  - Info dosen + metode (Offline/Online + link)
 *  - Auto-refresh setiap 30 detik
 *  - Tombol "Batalkan Antrian" dengan konfirmasi
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useRouteLoaderData } from 'react-router';
import { getMyQueue, cancelMyQueue, type StudentQueueSession } from '../../api/sessions';
import StatusBadge from '../../components/StatusBadge';
import VideoProvider from '../../components/video/VideoProvider';
import type { User } from '../../api/auth';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch { return '-'; }
}

// FR-M02: "Estimasi: 14:30 WIB"
function formatEstimateLabel(iso: string): string {
  return `Estimasi: ${formatTime(iso)} WIB`;
}

const QUEUE_STATUS_BADGE: Record<string, 'MENUNGGU' | 'BERLANGSUNG' | 'SELESAI'> = {
  waiting: 'MENUNGGU',
  in_progress: 'BERLANGSUNG',
  done: 'SELESAI',
};

// ── Confirm Dialog ─────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  dosenName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function ConfirmDialog({ dosenName, onConfirm, onCancel, loading }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6" role="dialog" aria-modal="true" aria-label="Konfirmasi Batalkan Antrian">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <div className="flex flex-col items-center text-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-error text-2xl" aria-hidden="true">warning</span>
          </div>
          <h2 className="font-headline font-bold text-lg text-slate-900">Batalkan Antrian?</h2>
          <p className="text-sm text-neutral-gray">
            Yakin ingin membatalkan antrian bimbingan dengan <span className="font-bold text-slate-700">{dosenName}</span>?
            Kamu harus mengajukan ulang jika ingin bimbingan lagi.
          </p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={loading}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-slate-600 hover:bg-gray-50 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
            Tidak
          </button>
          <button type="button" onClick={onConfirm} disabled={loading}
            className="flex-1 py-3 rounded-xl bg-error text-white text-sm font-bold hover:bg-red-700 disabled:opacity-60 min-h-[44px] focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none">
            {loading ? 'Membatalkan...' : 'Ya, Batalkan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Queue Card ────────────────────────────────────────────────────────────────

interface QueueInfoProps {
  session: StudentQueueSession;
  onCancelClick: () => void;
  displayName: string;
}

function QueueInfo({ session, onCancelClick, displayName }: QueueInfoProps) {
  const isWaiting = session.status === 'waiting';
  const isOnlineCallLive = session.status === 'in_progress' && session.method === 'online';

  return (
    <div className="flex flex-col items-center gap-6 pt-8">
      {/* Queue number */}
      <div className="text-center">
        <p className="text-sm text-neutral-gray mb-1">
          {isWaiting
            ? `Antrian ke-${session.queue_position ?? '-'} dari ${session.total_in_queue ?? '-'}`
            : 'Nomor Antrian Anda'}
        </p>
        <div className="w-36 h-36 rounded-full bg-primary/10 border-4 border-primary flex items-center justify-center mx-auto">
          <span className="font-headline font-bold text-6xl text-primary" aria-label={`Nomor antrian ${session.queue_position}`}>
            {session.queue_position ?? '-'}
          </span>
        </div>
        <div className="mt-3 flex justify-center">
          <StatusBadge status={QUEUE_STATUS_BADGE[session.status] ?? 'MENUNGGU'} />
        </div>
        {isWaiting && (
          <p className="text-sm text-neutral-gray mt-2">
            Estimasi tunggu:
            <span className="font-bold text-slate-800 ml-1">
              {session.estimated_wait_minutes > 0
                ? `±${session.estimated_wait_minutes} menit lagi`
                : 'Segera dipanggil'}
            </span>
          </p>
        )}
        {isWaiting && session.scheduled_at && (
          <p className="text-sm text-neutral-gray mt-0.5">{formatEstimateLabel(session.scheduled_at)}</p>
        )}
      </div>

      {/* Info card */}
      <div className="w-full bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4">
        {/* Dosen */}
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-primary text-xl mt-0.5" aria-hidden="true">person</span>
          <div>
            <p className="text-[11px] text-neutral-gray">Dosen Pembimbing</p>
            <p className="font-bold text-sm text-slate-900">{session.dosen_name}</p>
          </div>
        </div>

        {/* Metode */}
        <div className="flex items-start gap-3">
          <span className="material-symbols-outlined text-primary text-xl mt-0.5" aria-hidden="true">
            {session.method === 'online' ? 'videocam' : 'location_on'}
          </span>
          <div className="flex-1">
            <p className="text-[11px] text-neutral-gray">Metode Bimbingan</p>
            <p className="font-bold text-sm text-slate-900">
              {session.method === 'online' ? 'Online' : 'Offline (Tatap Muka)'}
            </p>
            {!isOnlineCallLive && session.method === 'online' && session.meeting_link && (
              <a href={session.meeting_link} target="_blank" rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 px-4 py-2.5 bg-success text-white text-sm font-bold rounded-xl hover:bg-green-700 min-h-[44px] focus-visible:ring-2 focus-visible:ring-success focus-visible:outline-none">
                <span className="material-symbols-outlined text-base" aria-hidden="true">videocam</span>
                Bergabung ke Meeting
              </a>
            )}
          </div>
        </div>

        {/* VIDEO-01/S-16: sesi online yang sedang berlangsung — embed panggilan
            video langsung, tanpa kontrol consent/notes/Selesai (dosen-only) */}
        {isOnlineCallLive && (
          <div className="w-full">
            <VideoProvider
              roomName={`temudosen-session-${session.id}`}
              displayName={displayName}
            />
          </div>
        )}

        {/* Notification status */}
        {session.notification_sent && (
          <div className="flex items-center gap-2 bg-success/5 border border-success/20 rounded-xl px-3 py-2">
            <span className="material-symbols-outlined text-success text-base" aria-hidden="true">notifications_active</span>
            <p className="text-xs text-success font-bold">Notifikasi H-15 menit telah dikirim</p>
          </div>
        )}
      </div>

      {/* Cancel button (only for WAITING) */}
      {isWaiting && (
        <button type="button" onClick={onCancelClick}
          className="w-full py-3 rounded-xl border-2 border-error/30 text-error text-sm font-bold hover:bg-error/5 min-h-[44px] focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none transition-colors">
          Batalkan Antrian
        </button>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function StudentQueue() {
  const navigate = useNavigate();
  const user = useRouteLoaderData('mahasiswa') as User;
  const [data, setData] = useState<Awaited<ReturnType<typeof getMyQueue>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadQueue = useCallback(async () => {
    setError(null);
    try {
      const res = await getMyQueue();
      setData(res);
      setLastUpdated(new Date());
    } catch {
      setError('Gagal memuat status antrian.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  useEffect(() => {
    refreshRef.current = setInterval(() => loadQueue(), 30_000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [loadQueue]);

  const handleCancelConfirm = async () => {
    if (!data?.session) return;
    setCancelling(true);
    try {
      await cancelMyQueue(data.session.id);
      navigate('/mahasiswa', { state: { toast: 'Antrian berhasil dibatalkan' } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membatalkan antrian.');
      setShowConfirm(false);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="fixed top-0 w-full z-50 bg-white border-b border-gray-200 shadow-sm max-w-md mx-auto left-0 right-0">
        <div className="flex items-center justify-between px-4 h-16">
          <span className="font-headline font-bold text-lg text-primary">Status Antrian</span>
          <button type="button" onClick={loadQueue} aria-label="Refresh"
            className="p-2 rounded-full hover:bg-gray-50 min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
            <span className="material-symbols-outlined text-gray-600">refresh</span>
          </button>
        </div>
      </nav>

      <main className="pt-16 pb-32 px-4 max-w-md mx-auto">
        {!loading && lastUpdated && (
          <p className="text-center text-[11px] text-gray-400 pt-3" aria-live="polite">
            Diperbarui pukul {formatTime(lastUpdated.toISOString())}
          </p>
        )}
        {loading && (
          <div className="text-center py-16 text-neutral-gray text-sm" aria-live="polite" aria-busy="true">
            <span className="material-symbols-outlined animate-spin text-3xl block mb-2">progress_activity</span>
            Memuat antrian...
          </div>
        )}

        {!loading && error && (
          <div className="bg-error/5 border border-error/20 rounded-xl p-4 text-center mt-6" aria-live="assertive">
            <p className="text-sm text-error">{error}</p>
            <button type="button" onClick={loadQueue} className="mt-2 text-sm text-primary font-bold underline">Coba Lagi</button>
          </div>
        )}

        {!loading && data && !data.hasActiveQueue && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined text-gray-300 text-6xl mb-4" aria-hidden="true">event_available</span>
            <h2 className="font-headline font-bold text-xl text-slate-900 mb-2">Tidak Ada Antrian Aktif</h2>
            <p className="text-sm text-neutral-gray mb-6 max-w-xs">
              Anda belum memiliki sesi bimbingan yang dijadwalkan.
            </p>
            <a href="/mahasiswa/ajukan"
              className="px-6 py-3 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary-hover min-h-[44px] flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
              <span className="material-symbols-outlined text-base" aria-hidden="true">add</span>
              Ajukan Bimbingan
            </a>
          </div>
        )}

        {!loading && data?.hasActiveQueue && data.session && (
          <QueueInfo
            session={data.session}
            onCancelClick={() => setShowConfirm(true)}
            displayName={user?.full_name ?? 'Mahasiswa'}
          />
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 w-full max-w-md mx-auto right-0 z-50 flex justify-around items-center px-2 py-3 bg-white border-t border-gray-200 rounded-t-xl">
        <a href="/mahasiswa" className="flex flex-col items-center text-gray-400 gap-0.5 min-h-[44px] min-w-[44px] px-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded">
          <span className="material-symbols-outlined">home</span>
          <span className="text-[11px]">Beranda</span>
        </a>
        <button type="button" aria-current="page" className="flex flex-col items-center text-primary gap-0.5 min-h-[44px] min-w-[44px]">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>queue</span>
          <span className="text-[11px] font-bold">Antrian</span>
        </button>
        <a href="/mahasiswa/ajukan" className="flex flex-col items-center text-gray-400 gap-0.5 min-h-[44px] min-w-[44px] px-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded">
          <span className="material-symbols-outlined">add_circle</span>
          <span className="text-[11px]">Ajukan</span>
        </a>
      </nav>

      {/* Confirm cancel dialog */}
      {showConfirm && data?.session && (
        <ConfirmDialog
          dosenName={data.session.dosen_name}
          onConfirm={handleCancelConfirm}
          onCancel={() => setShowConfirm(false)}
          loading={cancelling}
        />
      )}
    </div>
  );
}
