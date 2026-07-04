import { useState, useEffect, useCallback } from 'react';
import { Link, useRouteLoaderData } from 'react-router';
import type { User } from '../../api/auth';
import { getLecturerQueue, completeSession, type LecturerQueueItem, type LecturerQueueResponse } from '../../api/sessions';
import { getLecturerStats, startSession, type LecturerStats } from '../../api/stats';
import ConsentModal from '../../components/ConsentModal';
import { useMediaRecorder } from '../../hooks/useMediaRecorder';

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

        {/* SESSION-03/04: sesi yang sedang berlangsung — indikator rekaman + Selesai */}
        {queue?.activeSession && (
          <section className="bg-white rounded-xl border-2 border-primary/30 p-4 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase text-primary">Sesi Berlangsung</p>
                <p className="font-bold text-base text-slate-900 truncate mt-0.5">{queue.activeSession.mahasiswa_name}</p>
                <p className="text-[11px] text-neutral-gray">
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
                <span className="text-[11px] text-neutral-gray bg-gray-100 rounded-full px-3 py-1.5 flex-shrink-0">
                  Tanpa rekaman
                </span>
              )}
            </div>

            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan hasil bimbingan (opsional)…"
              rows={2}
              className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />

            <button type="button" disabled={completing} onClick={handleComplete}
              className="w-full py-3 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary-hover disabled:opacity-60 min-h-[44px] flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
              <span className="material-symbols-outlined text-base" aria-hidden="true">stop_circle</span>
              {completing ? 'Menyimpan…' : 'Selesai'}
            </button>
          </section>
        )}

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
        <Link to="/dosen/pengaturan" className="flex flex-col items-center text-gray-400 hover:text-primary min-h-[44px] min-w-[44px]">
          <span className="material-symbols-outlined text-xl">person</span>
          <span className="text-[11px]">Profil</span>
        </Link>
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
