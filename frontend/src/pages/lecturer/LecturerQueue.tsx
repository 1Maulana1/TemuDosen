/**
 * LecturerQueue — /dosen/queue
 * Phase 2: Dosen melihat antrian mahasiswa hari ini.
 * Auto-refresh setiap 30 detik.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouteLoaderData, useNavigate } from 'react-router';
import { getLecturerQueue, type LecturerQueueItem } from '../../api/sessions';
import { AppNavbar, AppBottomNav, NAV_ITEMS } from '../../components/AppNav';
import { logout, type User } from '../../api/auth';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  } catch { return '-'; }
}

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Menunggu',
  in_progress: 'Berlangsung',
  done: 'Selesai',
  cancelled: 'Batal',
};

const STATUS_COLOR: Record<string, string> = {
  waiting: 'bg-warning/10 text-warning',
  in_progress: 'bg-success/10 text-success',
  done: 'bg-green-100 text-green-800',
  cancelled: 'bg-error/10 text-error',
};

// ── Queue Card ────────────────────────────────────────────────────────────────

function QueueCard({ item }: { item: LecturerQueueItem }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-start gap-4">
      {/* Position badge */}
      <div className="w-10 h-10 min-w-[40px] rounded-full bg-primary flex items-center justify-center font-bold text-on-primary text-base flex-shrink-0">
        {item.position}
      </div>

      <div className="flex-1 min-w-0">
        {/* Name + NIM */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-sm text-slate-900 truncate">{item.mahasiswa_name}</p>
            <p className="text-[11px] text-neutral-gray">{item.nim}</p>
          </div>
          <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold uppercase flex-shrink-0 ${STATUS_COLOR[item.status] ?? 'bg-gray-100 text-gray-600'}`}>
            {STATUS_LABEL[item.status] ?? item.status}
          </span>
        </div>

        {/* Symptom */}
        {item.symptom_name && (
          <p className="text-[11px] text-slate-500 mt-1 truncate">{item.symptom_name}</p>
        )}

        {/* Time + duration + method */}
        <div className="flex items-center flex-wrap gap-3 mt-2">
          <div className="flex items-center gap-1 text-[11px] text-neutral-gray">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">schedule</span>
            {item.scheduled_at ? formatTime(item.scheduled_at) : '-'}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-neutral-gray">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">timer</span>
            {item.estimated_minutes} menit
          </div>
          <div className="flex items-center gap-1 text-[11px] text-neutral-gray">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">
              {item.method === 'online' ? 'videocam' : 'person'}
            </span>
            {item.method === 'online' ? 'Online' : 'Offline'}
          </div>
        </div>

        {/* Meeting link */}
        {item.method === 'online' && item.meeting_link && (
          <a href={item.meeting_link} target="_blank" rel="noopener noreferrer"
            className="mt-2 text-[11px] text-primary underline block truncate focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded">
            {item.meeting_link}
          </a>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function LecturerQueue() {
  const user = useRouteLoaderData('dosen') as User;
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof getLecturerQueue>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadQueue = useCallback(async () => {
    setError(null);
    try {
      const res = await getLecturerQueue();
      setData(res);
    } catch {
      setError('Gagal memuat antrian. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadQueue(); }, [loadQueue]);

  useEffect(() => {
    refreshRef.current = setInterval(() => loadQueue(), 30_000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [loadQueue]);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  function formatEndTime(iso: string): string {
    try {
      return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch { return '-'; }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <AppNavbar items={NAV_ITEMS.dosen} active="antrian" userName={user?.full_name ?? 'Dosen'} onLogout={handleLogout} />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-8">
        <h1 className="font-headline font-bold text-2xl text-on-surface mb-4">Antrian Hari Ini</h1>
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

        {!loading && data && (
          <div className="space-y-4 pt-6">
            {/* Summary card */}
            <div className="bg-primary/5 border border-primary/10 rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm text-neutral-gray">Total Menunggu</p>
                  <p className="font-headline font-bold text-3xl text-primary">{data.totalWaiting}</p>
                  <p className="text-[11px] text-neutral-gray">mahasiswa</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-neutral-gray">Perkiraan Selesai</p>
                  <p className="font-bold text-lg text-slate-800">{formatEndTime(data.estimatedEndTime)}</p>
                </div>
              </div>
            </div>

            {/* Queue list */}
            {data.queue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <span className="material-symbols-outlined text-gray-300 text-5xl mb-4" aria-hidden="true">queue</span>
                <h3 className="font-headline font-bold text-lg text-slate-900 mb-2">Antrian Kosong</h3>
                <p className="text-sm text-neutral-gray">Belum ada mahasiswa dalam antrian.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3" role="list" aria-label={`${data.queue.length} mahasiswa dalam antrian`}>
                {data.queue.map((item) => (
                  <div key={item.id} role="listitem">
                    <QueueCard item={item} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      <AppBottomNav items={NAV_ITEMS.dosen} active="antrian" />
    </div>
  );
}
