import { useState, useEffect, useCallback } from 'react';
import { Link, useRouteLoaderData, useNavigate } from 'react-router';
import type { User } from '../../api/auth';
import { logout } from '../../api/auth';
import { getLecturerQueue, completeSession, type LecturerQueueItem, type LecturerQueueResponse } from '../../api/sessions';
import { getLecturerStats, startSession, type LecturerStats } from '../../api/stats';
import ConsentModal from '../../components/ConsentModal';
import { AppNavbar, AppBottomNav, NAV_ITEMS } from '../../components/AppNav';
import { useMediaRecorder } from '../../hooks/useMediaRecorder';
import VideoProvider from '../../components/video/VideoProvider';
import ScheduleSessionCard from '../../components/ScheduleSessionCard';

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
function greeting() {
  const h = new Date().getHours();
  return h < 11 ? 'Selamat Pagi' : h < 15 ? 'Selamat Siang' : h < 18 ? 'Selamat Sore' : 'Selamat Malam';
}

export default function LecturerDashboard() {
  const user = useRouteLoaderData('dosen') as User;
  const navigate = useNavigate();
  const [queue, setQueue] = useState<LecturerQueueResponse|null>(null);
  const [stats, setStats] = useState<LecturerStats|null>(null);
  const [starting, setStarting] = useState<number|null>(null);
  const [msg, setMsg] = useState('');
  const [consentTarget, setConsentTarget] = useState<LecturerQueueItem | null>(null);
  const [notes, setNotes] = useState('');
  const [completing, setCompleting] = useState(false);
  const recorder = useMediaRecorder();

  const load = useCallback(async () => {
    const [q, s] = await Promise.all([
      getLecturerQueue().catch(() => null),
      getLecturerStats().catch(() => null),
    ]);
    setQueue(q); setStats(s);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  // FR-M04: dosen menekan "Mulai" → tampilkan modal consent sebelum sesi benar-benar dimulai.
  // SESSION-03: jika kedua pihak setuju, "Mulai & Rekam" juga menyalakan mikrofon (TS1 + rekaman).
  const handleStart = async (withRecording: boolean) => {
    if (!consentTarget) return;
    const id = consentTarget.id;
    setStarting(id);
    try {
      await startSession(id, {
        consent_by_dosen: withRecording,
        consent_by_mahasiswa: withRecording,
      });
      if (withRecording) {
        const ok = await recorder.start();
        setMsg(ok ? 'Sesi dimulai — rekaman berjalan.' : 'Sesi dimulai TANPA rekaman (mikrofon tidak tersedia/ditolak).');
      } else {
        setMsg('Sesi berhasil dimulai!');
      }
      setConsentTarget(null);
      setNotes('');
      load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Gagal.'); }
    finally { setStarting(null); setTimeout(() => setMsg(''), 5000); }
  };

  // SESSION-04: "Selesai" menghentikan rekaman + upload audio + set TS2 dalam satu aksi
  const handleComplete = async () => {
    const active = queue?.activeSession;
    if (!active || completing) return;
    setCompleting(true);
    try {
      const audio = await recorder.stop(); // null jika tidak sedang merekam
      const result = await completeSession(active.id, {
        notes: notes.trim() || undefined,
        // Server menolak audio tanpa consent — jangan kirim jika consent tidak tercatat
        audio: active.consent_given ? audio : null,
      });
      setMsg(result.has_recording ? 'Sesi selesai — rekaman tersimpan.' : 'Sesi selesai.');
      setNotes('');
      load();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Gagal menyelesaikan sesi.'); }
    finally { setCompleting(false); setTimeout(() => setMsg(''), 5000); }
  };

  const today = new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long' });

  const stat = (label: string, value: string | number, sub: string, accent = 'text-slate-800') => (
    <div className="bg-surface rounded-xl border border-gray-200 p-4 shadow-sm">
      <p className="text-[11px] text-on-surface-variant">{label}</p>
      <p className={`font-headline font-bold text-3xl mt-1 ${accent}`}>{value}</p>
      <p className="text-[11px] text-on-surface-variant">{sub}</p>
    </div>
  );

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <AppNavbar items={NAV_ITEMS.dosen} active="beranda" userName={user?.full_name ?? 'Dosen'} onLogout={handleLogout} />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-8 space-y-6">
        {msg && <div className="bg-success/10 border border-success/20 rounded-xl p-3 text-sm text-success font-bold">{msg}</div>}

        <section>
          <h1 className="font-headline font-bold text-2xl text-on-surface">{greeting()}, {user?.full_name?.split(',')[0] ?? 'Dosen'}!</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">{today}</p>
        </section>

        {/* Ringkasan antrian */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {stat('Antrian Hari Ini', queue?.totalWaiting ?? '-', 'mahasiswa', 'text-primary')}
          {stat('Estimasi Selesai', queue?.estimatedEndTime ? fmt(queue.estimatedEndTime) : '--:--', 'WIB')}
          {stat('Sesi Minggu Ini', stats?.total_sessions_week ?? '-', 'total')}
          {stat('Rata-rata Durasi', stats?.avg_duration_minutes ?? '-', 'menit')}
        </section>

        {/* Desktop: 2 kolom (daftar tunggu + sesi berlangsung). Mobile: menumpuk. */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Daftar mahasiswa menunggu */}
          <section className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-headline font-bold text-lg text-on-surface">Mahasiswa Menunggu</h2>
              <Link to="/dosen/requests" className="text-xs text-primary font-bold">Lihat Semua →</Link>
            </div>

            {!queue || queue.queue.length === 0 ? (
              <div className="bg-surface rounded-xl border border-gray-200 p-6 text-center">
                <span className="material-symbols-outlined text-gray-300 text-4xl block mb-2">queue</span>
                <p className="text-sm text-on-surface-variant">Antrian kosong hari ini.</p>
              </div>
            ) : queue.queue.map((item, idx) => (
              <div key={item.id} className="bg-surface rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 min-w-[32px] rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-sm">{item.position}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-slate-900 truncate">{item.mahasiswa_name}</p>
                    <p className="text-[11px] text-on-surface-variant">{item.nim} · {item.symptom_name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] text-on-surface-variant flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-sm">timer</span>{item.estimated_minutes} mnt
                      </span>
                      <span className="text-[11px] text-on-surface-variant flex items-center gap-0.5">
                        <span className="material-symbols-outlined text-sm">{item.method==='online'?'videocam':'person'}</span>
                        {item.method==='online'?'Online':'Offline'}
                      </span>
                    </div>
                  </div>
                  {idx === 0 && !queue?.activeSession && (
                    <button type="button" disabled={starting === item.id} onClick={() => setConsentTarget(item)}
                      className="px-3 py-2 bg-success text-white text-xs font-bold rounded-lg hover:bg-green-700 disabled:opacity-60 min-h-[44px] flex items-center gap-1 flex-shrink-0 focus-visible:ring-2 focus-visible:ring-success focus-visible:outline-none">
                      <span className="material-symbols-outlined text-sm">play_arrow</span>
                      Mulai & Rekam
                    </button>
                  )}
                </div>
              </div>
            ))}
          </section>

          {/* Sidebar: sesi berlangsung */}
          <div className="space-y-3 lg:sticky lg:top-20">
            <h2 className="font-headline font-bold text-lg text-on-surface">Sesi Berlangsung</h2>
            {/* SESSION-03/04: sesi yang sedang berlangsung — indikator rekaman + Selesai */}
            {queue?.activeSession ? (
              <section className="bg-surface rounded-xl border-2 border-primary/30 p-4 shadow-sm space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-base text-slate-900 truncate">{queue.activeSession.mahasiswa_name}</p>
                    <p className="text-[11px] text-on-surface-variant">
                      {queue.activeSession.nim}
                      {queue.activeSession.ts1 ? ` · mulai ${fmt(queue.activeSession.ts1)}` : ''}
                    </p>
                  </div>
                  {recorder.isRecording ? (
                    <span className="flex items-center gap-1.5 bg-error/10 text-error text-[11px] font-bold rounded-full px-3 py-1.5 flex-shrink-0" role="status">
                      <span className="w-2 h-2 rounded-full bg-error animate-pulse" aria-hidden="true" />
                      Merekam…
                    </span>
                  ) : (
                    <span className="text-[11px] text-on-surface-variant bg-gray-100 rounded-full px-3 py-1.5 flex-shrink-0">
                      Tanpa rekaman
                    </span>
                  )}
                </div>

                {queue.activeSession.method === 'online' && (
                  <VideoProvider
                    roomName={`temudosen-session-${queue.activeSession.id}`}
                    displayName={user?.full_name ?? 'Dosen'}
                  />
                )}

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Catatan hasil bimbingan (opsional)…"
                  rows={3}
                  className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />

                <button type="button" disabled={completing} onClick={handleComplete}
                  className="w-full py-3 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary-hover disabled:opacity-60 min-h-[44px] flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
                  <span className="material-symbols-outlined text-base" aria-hidden="true">stop_circle</span>
                  {completing ? 'Menyimpan…' : 'Selesai'}
                </button>
              </section>
            ) : (
              <section className="bg-surface rounded-xl border border-gray-200 p-4 shadow-sm text-center">
                <span className="material-symbols-outlined text-gray-300 text-3xl block mb-1">coffee</span>
                <p className="text-sm text-on-surface-variant">Tidak ada sesi berlangsung.</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5">Mulai sesi dari daftar mahasiswa menunggu.</p>
              </section>
            )}

            {/* Dosen full control: assign jadwal langsung ke mahasiswa bimbingan */}
            <ScheduleSessionCard onScheduled={load} />
          </div>
        </div>
      </main>

      <AppBottomNav items={NAV_ITEMS.dosen} active="beranda" />

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
