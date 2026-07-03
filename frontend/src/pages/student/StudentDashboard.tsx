import { useEffect, useState } from 'react';
import { Link, useRouteLoaderData } from 'react-router';
import type { User } from '../../api/auth';
import { fetchMySubmissions, type SubmissionSummary } from '../../api/submissions';
import { getMyQueue, type StudentQueueSession } from '../../api/sessions';
import PDFPreview from '../../components/PDFPreview';

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  pending:   'Menunggu',
  approved:  'Disetujui',
  rejected:  'Dibatalkan',
  revision:  'Revisi',
  cancelled: 'Dibatalkan',
};

const STATUS_BADGE: Record<string, string> = {
  pending:   'bg-[#FEF3C7] text-[#EA580C]',
  approved:  'bg-[#DBEAFE] text-[#1D4ED8]',
  rejected:  'bg-[#FEE2E2] text-[#B91C1C]',
  revision:  'bg-[#FEF3C7] text-[#B45309]',
  cancelled: 'bg-[#FEE2E2] text-[#B91C1C]',
};

const STATUS_ICON: Record<string, { icon: string; bg: string; fg: string }> = {
  pending:   { icon: 'schedule', bg: 'bg-[#FEF3C7]', fg: 'text-[#EA580C]' },
  approved:  { icon: 'check',    bg: 'bg-[#D1FAE5]', fg: 'text-[#065F46]' },
  rejected:  { icon: 'close',    bg: 'bg-[#FEE2E2]', fg: 'text-[#B91C1C]' },
  revision:  { icon: 'edit',     bg: 'bg-[#FEF3C7]', fg: 'text-[#B45309]' },
  cancelled: { icon: 'close',    bg: 'bg-[#FEE2E2]', fg: 'text-[#B91C1C]' },
};

// ── Utilities ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="flex-none w-[100px] bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col items-center justify-center">
      <span className={`text-2xl font-headline font-bold mb-1 ${color}`}>{value}</span>
      <span className="text-[11px] text-neutral-gray text-center leading-tight">{label}</span>
    </div>
  );
}

function NavItem({
  icon, label, to, active = false,
}: { icon: string; label: string; to: string; active?: boolean }) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-1 p-2 min-w-[64px] transition-colors ${active ? 'text-primary' : 'text-gray-400 hover:text-gray-700'}`}
    >
      <div className={`w-12 h-8 flex items-center justify-center rounded-full ${active ? 'bg-amber-100' : ''}`}>
        <span
          className="material-symbols-outlined text-xl"
          style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}
        >
          {icon}
        </span>
      </div>
      <span className={`text-[10px] ${active ? 'font-semibold' : 'font-medium'}`}>{label}</span>
    </Link>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function StudentDashboard() {
  const user = useRouteLoaderData('student-root') as User;
  const [subs, setSubs] = useState<SubmissionSummary[]>([]);
  const [queue, setQueue] = useState<StudentQueueSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<{ uuid: string; name: string } | null>(null);

  useEffect(() => {
    Promise.all([fetchMySubmissions(), getMyQueue()])
      .then(([s, q]) => { setSubs(s); setQueue(q.hasActiveQueue ? q.session : null); })
      .finally(() => setLoading(false));
  }, []);

  const first = user.full_name.split(' ')[0];
  const totalSesi = subs.length;
  const selesai  = subs.filter(s => s.status === 'approved').length;
  const menunggu = subs.filter(s => s.status === 'pending').length;
  const aktif    = subs.filter(s => s.status === 'pending' || s.status === 'approved');

  return (
    <div className="min-h-screen pb-24 max-w-[430px] mx-auto">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 flex justify-between items-center px-4 py-4 bg-white/90 backdrop-blur-sm shadow-sm border-b border-amber-100">
        <button className="p-2 -ml-2 text-gray-500 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-light">
          <span className="material-symbols-outlined text-2xl">menu</span>
        </button>
        <h1 className="font-headline font-bold text-xl text-primary-light">TemuDosen</h1>
        <div className="w-10 h-10 bg-primary-light rounded-full flex items-center justify-center text-gray-900 font-bold text-sm shadow-sm ring-2 ring-white">
          {initials(user.full_name)}
        </div>
      </header>

      <main className="px-4 pt-6 pb-4 space-y-5">

        {/* ── Greeting ── */}
        <div>
          <h2 className="font-headline font-bold text-[22px] text-gray-900 leading-tight mb-1">
            Halo, {first}! 👋
          </h2>
          <p className="text-sm text-neutral-gray">Pantau progres skripsimu.</p>
        </div>

        {/* ── CTA ── */}
        <Link
          to="/mahasiswa/ajukan"
          className="w-full bg-primary-light text-gray-900 font-bold text-base h-[52px] rounded-xl shadow-sm flex items-center justify-center gap-2 hover:bg-amber-500 transition-colors active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-light"
        >
          <span className="material-symbols-outlined text-xl">add</span>
          Ajukan Bimbingan Baru
        </Link>

        {/* ── Stats ── */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4">
          <StatCard value={loading ? '…' : String(totalSesi)} label="Total Sesi"  color="text-gray-900" />
          <StatCard value={loading ? '…' : String(selesai)}   label="Selesai"     color="text-success" />
          <StatCard value={loading ? '…' : String(menunggu)}  label="Menunggu"    color="text-warning" />
        </div>

        {/* ── Queue banner ── */}
        {queue && (
          <Link
            to="/mahasiswa/queue"
            className="block bg-primary rounded-2xl p-4 text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors"
          >
            <p className="text-xs text-amber-200 uppercase tracking-wider mb-1">Antrian Aktif</p>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-headline font-bold text-lg">Nomor #{queue.queue_position}</p>
                <p className="text-sm text-amber-100 mt-1">
                  {queue.dosen_name} · {queue.estimated_wait_minutes > 0 ? `±${queue.estimated_wait_minutes} menit` : 'Segera'}
                </p>
              </div>
              <span className="material-symbols-outlined text-white/70 text-3xl">queue</span>
            </div>
          </Link>
        )}

        {/* ── Antrean pengajuan aktif ── */}
        {!loading && aktif.length > 0 && (
          <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-sm text-gray-900">Antrean Aktif</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {aktif.map(s => (
                <div key={s.id} className="p-4 flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">
                      {s.symptoms.map(x => x.name).join(', ') || 'Tidak ada gejala'}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{fmt(s.created_at)}</p>
                  </div>
                  <span className={`px-2 py-1 text-[11px] font-semibold rounded-full whitespace-nowrap ${STATUS_BADGE[s.status]}`}>
                    {STATUS_LABEL[s.status]}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Riwayat Sesi ── */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="font-semibold text-sm text-gray-900">Riwayat Sesi</h3>
          </div>

          {loading && <p className="text-sm text-gray-400 py-6 text-center">Memuat...</p>}

          {!loading && subs.length === 0 && (
            <div className="py-10 flex flex-col items-center text-center px-4">
              <span className="material-symbols-outlined text-gray-300 text-4xl mb-3">description</span>
              <p className="font-bold text-sm text-gray-800">Belum Ada Pengajuan</p>
              <p className="text-xs text-gray-500 mt-1">Ajukan bimbingan pertama Anda.</p>
            </div>
          )}

          <div className="divide-y divide-gray-100">
            {subs.slice(0, 5).map(s => {
              const si = STATUS_ICON[s.status] ?? STATUS_ICON.pending;
              return (
                <div key={s.id} className="p-4 flex gap-3 items-start">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${si.bg} ${si.fg}`}>
                    <span className="material-symbols-outlined text-[18px]">{si.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 leading-tight mb-1 truncate">
                      {s.symptoms.map(x => x.name).join(', ') || 'Tidak ada gejala'}
                    </p>
                    <p className="text-xs text-gray-500 mb-2">{fmt(s.created_at)}</p>
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${STATUS_BADGE[s.status]}`}>
                        {STATUS_LABEL[s.status]}
                      </span>
                      {s.file_uuid && (
                        <button
                          type="button"
                          onClick={() => setPreview({ uuid: s.file_uuid!, name: s.file_name ?? 'draft.pdf' })}
                          className="text-xs font-medium text-primary hover:underline focus:outline-none"
                        >
                          Pratinjau
                        </button>
                      )}
                    </div>
                    {(s.status === 'rejected' || s.status === 'revision') && s.rejection_reason && (
                      <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 p-2">
                        <p className="text-[10px] font-bold text-amber-800">
                          {s.status === 'revision' ? 'Catatan Revisi' : 'Alasan Penolakan'}
                        </p>
                        <p className="text-[10px] text-amber-700 mt-0.5 whitespace-pre-wrap">{s.rejection_reason}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* ── Bottom Nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto bg-white border-t border-gray-200 flex justify-around items-center py-2 px-2">
        <NavItem icon="home"       label="Beranda" to="/mahasiswa"        active />
        <NavItem icon="add_circle" label="Ajukan"  to="/mahasiswa/ajukan" />
        <NavItem icon="queue"      label="Antrian" to="/mahasiswa/queue"  />
        <NavItem icon="person"     label="Profil"  to="#"                 />
      </nav>

      {preview && (
        <PDFPreview fileUuid={preview.uuid} fileName={preview.name} onClose={() => setPreview(null)} />
      )}
    </div>
  );
}
