import { useEffect, useState } from 'react';
import { Link, useLoaderData } from 'react-router';
import type { User } from '../../api/auth';
import { fetchMySubmissions, type SubmissionSummary } from '../../api/submissions';
import { getMyQueue, type StudentQueueSession } from '../../api/sessions';
import StatusBadge from '../../components/StatusBadge';
import PDFPreview from '../../components/PDFPreview';

const STATUS_MAP: Record<string, 'MENUNGGU'|'DISETUJUI'|'DIBATALKAN'|'REVISI'> = {
  pending:'MENUNGGU', approved:'DISETUJUI', rejected:'DIBATALKAN', revision:'REVISI', cancelled:'DIBATALKAN',
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
}

function greeting() {
  const h = new Date().getHours();
  return h < 11 ? 'Selamat Pagi' : h < 15 ? 'Selamat Siang' : h < 18 ? 'Selamat Sore' : 'Selamat Malam';
}

export default function StudentDashboard() {
  const user = useLoaderData() as User;
  const [subs, setSubs] = useState<SubmissionSummary[]>([]);
  const [queue, setQueue] = useState<StudentQueueSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<{uuid:string;name:string}|null>(null);

  useEffect(() => {
    Promise.all([fetchMySubmissions(), getMyQueue()])
      .then(([s, q]) => { setSubs(s); setQueue(q.hasActiveQueue ? q.session : null); })
      .finally(() => setLoading(false));
  }, []);

  const first = user.full_name.split(' ')[0];

  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 h-16 max-w-md mx-auto flex items-center justify-between px-4">
        <span className="font-headline font-bold text-xl text-primary">TemuDosen</span>
        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-lg">person</span>
        </div>
      </header>

      <main className="pt-20 pb-24 px-4 max-w-md mx-auto space-y-5">
        <section className="pt-2">
          <h1 className="font-headline font-bold text-2xl text-slate-900">{greeting()}, {first}!</h1>
          <p className="text-sm text-gray-500 mt-0.5">Selamat datang kembali di TemuDosen.</p>
        </section>

        {/* Kartu antrian aktif */}
        {!loading && queue && (
          <Link to="/mahasiswa/queue" className="block bg-primary rounded-2xl p-4 text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors">
            <p className="text-xs text-blue-200 uppercase tracking-wider mb-1">Antrian Aktif</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-headline font-bold text-lg">Nomor Antrian: #{queue.queue_position}</p>
                <p className="text-sm text-blue-100 mt-1">
                  {queue.dosen_name} · {queue.estimated_wait_minutes > 0 ? `±${queue.estimated_wait_minutes} menit` : 'Segera'}
                </p>
              </div>
              <span className="material-symbols-outlined text-white/70 text-3xl">queue</span>
            </div>
          </Link>
        )}

        {/* Tombol ajukan (jika tidak ada antrian) */}
        {!loading && !queue && (
          <Link to="/mahasiswa/ajukan"
            className="block p-4 bg-primary rounded-2xl text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors active:scale-[0.98]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-200 uppercase tracking-wider mb-1">Mulai Sekarang</p>
                <h2 className="font-headline font-bold text-lg">Ajukan Bimbingan Baru</h2>
                <p className="text-xs text-blue-100 mt-1">Pilih gejala akademik dan unggah draft</p>
              </div>
              <span className="material-symbols-outlined text-white/70 text-3xl">add_circle</span>
            </div>
          </Link>
        )}

        {/* Riwayat 5 terakhir */}
        <section className="space-y-3">
          <h2 className="font-headline font-bold text-lg text-slate-900">Riwayat Pengajuan</h2>
          {loading && <p className="text-sm text-gray-400 py-4 text-center">Memuat...</p>}
          {!loading && subs.length === 0 && (
            <div className="py-10 flex flex-col items-center text-center">
              <span className="material-symbols-outlined text-gray-300 text-4xl mb-3">description</span>
              <h3 className="font-bold text-slate-800">Belum Ada Pengajuan</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-xs">Ajukan bimbingan pertama Anda dengan memilih gejala akademik dan mengunggah draft.</p>
            </div>
          )}
          {!loading && subs.slice(0, 5).map((s) => (
            <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {s.symptoms.map(x => x.name).join(', ') || 'Tidak ada gejala'}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmt(s.created_at)}</p>
                </div>
                <StatusBadge status={STATUS_MAP[s.status] ?? 'MENUNGGU'} />
              </div>
              {(s.status === 'rejected' || s.status === 'revision') && s.rejection_reason && (
                <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                  <p className="text-xs font-bold text-amber-800">
                    {s.status === 'revision' ? 'Catatan Revisi dari Dosen' : 'Alasan Penolakan'}
                  </p>
                  <p className="text-xs text-amber-700 mt-1 whitespace-pre-wrap">{s.rejection_reason}</p>
                </div>
              )}
              {s.file_uuid && (
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500 truncate flex-1">{s.file_name ?? 'draft.pdf'}</span>
                  <button type="button" onClick={() => setPreview({ uuid: s.file_uuid!, name: s.file_name ?? 'draft.pdf' })}
                    className="ml-3 px-3 py-1.5 rounded-lg text-xs font-bold text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 min-h-[44px] flex items-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
                    Pratinjau
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around bg-white border-t border-gray-200 px-2 py-3 rounded-t-xl max-w-md mx-auto">
        <button type="button" aria-current="page" className="flex flex-col items-center text-primary min-h-[44px] min-w-[44px]">
          <span className="material-symbols-outlined text-xl" style={{fontVariationSettings:"'FILL' 1"}}>home</span>
          <span className="text-[11px]">Beranda</span>
        </button>
        <Link to="/mahasiswa/ajukan" className="flex flex-col items-center text-gray-400 hover:text-primary min-h-[44px] min-w-[44px]">
          <span className="material-symbols-outlined text-xl">add_circle</span>
          <span className="text-[11px]">Ajukan</span>
        </Link>
        <Link to="/mahasiswa/queue" className="flex flex-col items-center text-gray-400 hover:text-primary min-h-[44px] min-w-[44px]">
          <span className="material-symbols-outlined text-xl">queue</span>
          <span className="text-[11px]">Antrian</span>
        </Link>
        <button type="button" className="flex flex-col items-center text-gray-400 min-h-[44px] min-w-[44px]">
          <span className="material-symbols-outlined text-xl">person</span>
          <span className="text-[11px]">Profil</span>
        </button>
      </nav>

      {preview && <PDFPreview fileUuid={preview.uuid} fileName={preview.name} onClose={() => setPreview(null)} />}
    </div>
  );
}
