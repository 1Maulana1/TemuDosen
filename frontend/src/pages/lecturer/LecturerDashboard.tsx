import { useState, useEffect, useCallback } from 'react';
import { Link, useRouteLoaderData } from 'react-router';
import type { User } from '../../api/auth';
import { getLecturerQueue, type LecturerQueueItem } from '../../api/sessions';
import { getLecturerStats, startSession, type LecturerStats } from '../../api/stats';
import ConsentModal from '../../components/ConsentModal';

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
function greeting() {
  const h = new Date().getHours();
  return h < 11 ? 'Selamat Pagi' : h < 15 ? 'Selamat Siang' : h < 18 ? 'Selamat Sore' : 'Selamat Malam';
}
function initials(name: string) {
  return name.split(' ').slice(0,2).map(w=>w[0]?.toUpperCase()??'').join('');
}

export default function LecturerDashboard() {
  const user = useRouteLoaderData('dosen') as User;
  const [queue, setQueue] = useState<{totalWaiting:number;estimatedEndTime:string;queue:LecturerQueueItem[]}|null>(null);
  const [stats, setStats] = useState<LecturerStats|null>(null);
  const [starting, setStarting] = useState<number|null>(null);
  const [msg, setMsg] = useState('');
  const [consentTarget, setConsentTarget] = useState<LecturerQueueItem | null>(null);

  const load = useCallback(async () => {
    const [q, s] = await Promise.all([
      getLecturerQueue().catch(() => null),
      getLecturerStats().catch(() => null),
    ]);
    setQueue(q); setStats(s);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  // FR-M04: dosen menekan "Mulai" → tampilkan modal consent sebelum sesi benar-benar dimulai
  const handleStart = async (withRecording: boolean) => {
    if (!consentTarget) return;
    const id = consentTarget.id;
    setStarting(id);
    try {
      await startSession(id, {
        consent_by_dosen: withRecording,
        consent_by_mahasiswa: withRecording,
      });
      setMsg('Sesi berhasil dimulai!');
      setConsentTarget(null);
      load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Gagal.'); }
    finally { setStarting(null); setTimeout(() => setMsg(''), 3000); }
  };

  const today = new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long' });

  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 h-16 max-w-md mx-auto flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">{initials(user?.full_name??'D')}</div>
          <span className="font-headline font-bold text-lg text-primary">TemuDosen</span>
        </div>
        <span className="material-symbols-outlined text-gray-500">notifications</span>
      </header>

      <main className="pt-20 pb-24 px-4 max-w-md mx-auto space-y-5">
        {msg && <div className="bg-success/10 border border-success/20 rounded-xl p-3 text-sm text-success font-bold">{msg}</div>}

        <section className="pt-2">
          <h1 className="font-headline font-bold text-2xl text-slate-900">{greeting()}, {user?.full_name?.split(' ')[0]}!</h1>
          <p className="text-sm text-gray-500 mt-0.5">{today}</p>
        </section>

        {/* Ringkasan antrian */}
        <section className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-[11px] text-neutral-gray">Antrian Hari Ini</p>
            <p className="font-headline font-bold text-3xl text-primary mt-1">{queue?.totalWaiting ?? '-'}</p>
            <p className="text-[11px] text-neutral-gray">mahasiswa</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-[11px] text-neutral-gray">Estimasi Selesai</p>
            <p className="font-headline font-bold text-2xl text-slate-800 mt-1">
              {queue?.estimatedEndTime ? fmt(queue.estimatedEndTime) : '--:--'}
            </p>
            <p className="text-[11px] text-neutral-gray">WIB</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-[11px] text-neutral-gray">Sesi Minggu Ini</p>
            <p className="font-headline font-bold text-3xl text-slate-800 mt-1">{stats?.total_sessions_week ?? '-'}</p>
            <p className="text-[11px] text-neutral-gray">total</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-[11px] text-neutral-gray">Rata-rata Durasi</p>
            <p className="font-headline font-bold text-3xl text-slate-800 mt-1">{stats?.avg_duration_minutes ?? '-'}</p>
            <p className="text-[11px] text-neutral-gray">menit</p>
          </div>
        </section>

        {/* Antrian mahasiswa */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-headline font-bold text-lg text-slate-900">Mahasiswa Menunggu</h2>
            <Link to="/dosen/requests" className="text-xs text-primary font-bold">Lihat Semua →</Link>
          </div>

          {!queue || queue.queue.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
              <span className="material-symbols-outlined text-gray-300 text-4xl block mb-2">queue</span>
              <p className="text-sm text-neutral-gray">Antrian kosong hari ini.</p>
            </div>
          ) : queue.queue.map((item, idx) => (
            <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 min-w-[32px] rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-sm">{item.position}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-900 truncate">{item.mahasiswa_name}</p>
                  <p className="text-[11px] text-neutral-gray">{item.nim} · {item.symptom_name}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[11px] text-neutral-gray flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-sm">timer</span>{item.estimated_minutes} mnt
                    </span>
                    <span className="text-[11px] text-neutral-gray flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-sm">{item.method==='online'?'videocam':'person'}</span>
                      {item.method==='online'?'Online':'Offline'}
                    </span>
                  </div>
                </div>
                {idx === 0 && (
                  <button type="button" disabled={starting === item.id} onClick={() => setConsentTarget(item)}
                    className="px-3 py-2 bg-success text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-60 min-h-[44px] flex items-center gap-1 flex-shrink-0 focus-visible:ring-2 focus-visible:ring-success focus-visible:outline-none">
                    <span className="material-symbols-outlined text-sm">play_arrow</span>
                    Mulai
                  </button>
                )}
              </div>
            </div>
          ))}
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around bg-white border-t border-gray-200 px-2 py-3 rounded-t-xl max-w-md mx-auto">
        <button type="button" aria-current="page" className="flex flex-col items-center text-primary min-h-[44px] min-w-[44px]">
          <span className="material-symbols-outlined text-xl" style={{fontVariationSettings:"'FILL' 1"}}>home</span>
          <span className="text-[11px] font-bold">Beranda</span>
        </button>
        <Link to="/dosen/requests" className="flex flex-col items-center text-gray-400 hover:text-primary min-h-[44px] min-w-[44px]">
          <span className="material-symbols-outlined text-xl">inbox</span>
          <span className="text-[11px]">Permintaan</span>
        </Link>
        <Link to="/dosen/queue" className="flex flex-col items-center text-gray-400 hover:text-primary min-h-[44px] min-w-[44px]">
          <span className="material-symbols-outlined text-xl">format_list_numbered</span>
          <span className="text-[11px]">Antrian</span>
        </Link>
        <button type="button" className="flex flex-col items-center text-gray-400 min-h-[44px] min-w-[44px]">
          <span className="material-symbols-outlined text-xl">person</span>
          <span className="text-[11px]">Profil</span>
        </button>
      </nav>

      {consentTarget && (
        <ConsentModal
          studentName={consentTarget.mahasiswa_name}
          dosenName={user?.full_name ?? 'Dosen'}
          onConfirm={handleStart}
          onClose={() => setConsentTarget(null)}
          loading={starting === consentTarget.id}
        />
      )}
    </div>
  );
}
