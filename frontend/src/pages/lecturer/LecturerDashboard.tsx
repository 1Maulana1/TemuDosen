import { useState, useEffect, useCallback } from 'react';
import { Link, useRouteLoaderData } from 'react-router';
import type { User } from '../../api/auth';
import { getLecturerQueue, type LecturerQueueItem, getCalendarStatus } from '../../api/sessions';
import { startSession } from '../../api/stats';
import { fetchLecturerSubmissions, type LecturerSubmissionItem } from '../../api/submissions';

// ── Utilities ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
  }) + ' · ' + fmtTime(iso) + ' WIB';
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PendingCard({ item }: { item: LecturerSubmissionItem }) {
  const symptomText = item.symptom_names.join(', ');
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm flex flex-col gap-4 hover:shadow-md transition-shadow">
      <div>
        <h3 className="font-semibold text-base text-gray-900">{item.student_name}</h3>
        <span className="inline-block bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-xs mt-1">
          NIM: {item.student_nim}
        </span>
      </div>
      {symptomText && (
        <p className="text-sm text-gray-700 line-clamp-2">"{symptomText}"</p>
      )}
      <div className="flex flex-col gap-1.5 text-gray-500 text-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">event</span>
          <span>Diajukan: {fmtDateTime(item.created_at)}</span>
        </div>
      </div>
      <div className="flex gap-3 pt-3 border-t border-gray-100">
        <Link
          to={`/dosen/requests?id=${item.id}&action=approve`}
          className="flex-1 bg-primary-light text-gray-900 font-semibold text-sm py-2 rounded-lg text-center hover:bg-amber-500 transition-colors"
        >
          Setujui
        </Link>
        <Link
          to={`/dosen/requests?id=${item.id}&action=reject`}
          className="flex-1 border border-error text-error font-semibold text-sm py-2 rounded-lg text-center hover:bg-red-50 transition-colors"
        >
          Tolak
        </Link>
      </div>
    </div>
  );
}

function QueueCard({ item, onStart, starting }: {
  item: LecturerQueueItem;
  onStart: (id: number) => void;
  starting: number | null;
}) {
  const isFirst = item.position === 1;
  const isInProgress = item.status === 'in_progress';

  return (
    <div className={`bg-white rounded-xl p-6 border shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center ${isFirst ? 'border-l-4 border-l-primary-light border-gray-100' : 'border-gray-100 opacity-85'}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-headline font-bold text-xl shrink-0 ${isFirst ? 'bg-primary-light text-gray-900' : 'bg-gray-100 text-gray-500'}`}>
        {item.position}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-gray-900">{item.mahasiswa_name}</h3>
          <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded text-xs">{item.nim}</span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5 truncate">{item.symptom_name}</p>
        <div className="flex items-center gap-1.5 text-gray-400 text-sm mt-1">
          <span className="material-symbols-outlined text-[16px]">schedule</span>
          <span>
            {item.estimated_minutes} menit
            {item.scheduled_at && ` · ${fmtTime(item.scheduled_at)}`}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0 w-full md:w-auto">
        {isInProgress ? (
          <>
            <span className="bg-[#D1FAE5] text-[#065F46] px-3 py-1 rounded-full text-xs font-semibold">Berlangsung</span>
            <Link
              to="/dosen/queue"
              className="w-full md:w-auto bg-success hover:bg-green-700 text-white font-semibold text-sm px-5 py-2 rounded-lg text-center transition-colors"
            >
              Lihat Sesi
            </Link>
          </>
        ) : (
          <>
            <span className="bg-[#DBEAFE] text-[#1D4ED8] px-3 py-1 rounded-full text-xs font-semibold">Disetujui</span>
            <button
              type="button"
              disabled={starting === item.id}
              onClick={() => onStart(item.id)}
              className="w-full md:w-auto bg-primary-light hover:bg-amber-500 text-gray-900 font-semibold text-sm px-5 py-2 rounded-lg transition-colors disabled:opacity-60"
            >
              {starting === item.id ? 'Memulai...' : 'Mulai Sesi'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function LecturerDashboard() {
  const user = useRouteLoaderData('lecturer-root') as User;

  const [pending, setPending] = useState<LecturerSubmissionItem[]>([]);
  const [queue, setQueue] = useState<{ totalWaiting: number; estimatedEndTime: string; queue: LecturerQueueItem[] } | null>(null);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [starting, setStarting] = useState<number | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const [p, q, cal] = await Promise.all([
      fetchLecturerSubmissions({ status: 'pending' }).catch(() => []),
      getLecturerQueue().catch(() => null),
      getCalendarStatus().catch(() => ({ enabled: false, connected: false })),
    ]);
    setPending(p);
    setQueue(q);
    setCalendarConnected(cal.connected);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const handleStart = async (id: number) => {
    setStarting(id);
    try {
      await startSession(id);
      setMsg('Sesi berhasil dimulai!');
      load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal memulai sesi.');
    } finally {
      setStarting(null);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  return (
    <div className="min-h-screen">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-amber-100 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/dosen" className="font-headline font-bold text-xl text-primary-light shrink-0">
            TemuDosen
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link to="/dosen" className="font-semibold text-primary border-b-2 border-primary-light pb-0.5">Dashboard</Link>
            <Link to="/dosen/requests" className="text-gray-500 hover:text-gray-900 transition-colors">Permintaan</Link>
            <Link to="/dosen/queue" className="text-gray-500 hover:text-gray-900 transition-colors">Antrian</Link>
          </nav>
          <div className="flex items-center gap-3">
            <button className="p-1.5 text-gray-400 hover:text-gray-700 focus:outline-none">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center text-gray-900 font-bold text-sm">
                {initials(user?.full_name ?? 'D')}
              </div>
              <span className="hidden md:block text-sm font-medium text-gray-700">{user?.full_name}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">

        {/* ── Flash message ── */}
        {msg && (
          <div className="bg-green-50 border border-green-200 text-green-800 rounded-xl p-3 text-sm font-semibold">
            {msg}
          </div>
        )}

        {/* ── Google Calendar banner ── */}
        <section className="bg-white rounded-xl p-5 flex items-center justify-between border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-[#1D4ED8] w-12 h-12 rounded-lg flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_month</span>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Google Calendar</h2>
              <p className="text-sm text-gray-500">Sinkronisasi jadwal bimbingan otomatis</p>
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5 ${calendarConnected ? 'bg-[#D1FAE5] text-[#065F46]' : 'bg-gray-100 text-gray-500'}`}>
            <span className="text-[10px]">●</span>
            {calendarConnected ? 'Terhubung' : 'Tidak Terhubung'}
          </span>
        </section>

        {/* ── Perlu Ditinjau ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="font-headline font-bold text-lg text-gray-900">Perlu Ditinjau</h2>
            {pending.length > 0 && (
              <span className="bg-primary-light text-gray-900 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">
                {pending.length}
              </span>
            )}
          </div>
          {pending.length === 0 ? (
            <div className="bg-white rounded-xl p-8 border border-gray-100 shadow-sm text-center">
              <span className="material-symbols-outlined text-gray-300 text-4xl block mb-2">inbox</span>
              <p className="text-sm text-gray-500">Tidak ada pengajuan yang perlu ditinjau.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pending.map(item => <PendingCard key={item.id} item={item} />)}
            </div>
          )}
        </section>

        {/* ── Antrean Aktif ── */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="font-headline font-bold text-lg text-gray-900">Antrean Aktif</h2>
            {queue && queue.totalWaiting > 0 && (
              <span className="bg-primary-light text-gray-900 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs">
                {queue.totalWaiting}
              </span>
            )}
          </div>
          {(!queue || queue.queue.length === 0) ? (
            <div className="bg-white rounded-xl p-8 border border-gray-100 shadow-sm text-center">
              <span className="material-symbols-outlined text-gray-300 text-4xl block mb-2">queue</span>
              <p className="text-sm text-gray-500">Antrian kosong hari ini.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {queue.queue.map(item => (
                <QueueCard key={item.id} item={item} onStart={handleStart} starting={starting} />
              ))}
            </div>
          )}
        </section>

      </main>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-gray-200 mt-16 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <span className="font-headline font-bold text-primary-light">TemuDosen</span>
          <p>© 2024 TemuDosen. Semua hak dilindungi.</p>
          <nav className="flex gap-6">
            <a href="#" className="hover:text-gray-900 transition-colors">Tentang Kami</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Panduan</a>
            <a href="#" className="hover:text-gray-900 transition-colors">Kontak</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
