/**
 * StudentDashboard — /mahasiswa (S-06 desktop 2-column layout, aligned to
 * Referensi Tampilan/dashboard_mahasiswa mockup).
 *
 * FR coverage:
 *   FR-M01 — CTA "Ajukan Bimbingan Baru" disabled + tooltip saat mahasiswa masih
 *            punya submission 'pending' atau antrean aktif (waiting/in_progress).
 *   FR-M02 — "Antrean Aktif Saya" pakai data real-time dari GET /api/queue/my/.
 *   FR-M03 — Tombol "Batalkan" hanya tampil saat status sesi 'waiting' (bukan
 *            giliran/berlangsung), dengan modal konfirmasi sebelum POST cancel.
 *   FR-M05 — "Aksi" di tabel riwayat membuka pratinjau berkas draft (data nyata).
 *            Transkrip & ringkasan sesi BELUM didukung backend (tidak ada field
 *            transcript/summary di model Session) — lihat TODO di bawah.
 *   FR-M06 — Tidak diimplementasikan di layar ini: menandai action-item selesai
 *            butuh session_id yang tidak diekspos oleh SubmissionSummary. Perlu
 *            perubahan backend terpisah (di luar scope task ini, sudah dilaporkan).
 *
 * Data yang MASIH PENDEKATAN (bukan endpoint dedicated), didokumentasikan inline:
 *   - Kolom "Status" riwayat pakai status Submission (pending/approved/rejected/
 *     revision/cancelled), BUKAN status Session (waiting/in_progress/done/cancelled).
 *     Setelah 'approved', tidak ada cara membedakan "masih berjalan" vs "selesai"
 *     dari endpoint yang ada.
 *   - Stat "Sesi Selesai" = jumlah submission approved dikurangi 1 jika sedang ada
 *     antrean aktif (pendekatan, bisa sedikit meleset jika ada cancel pasca-approval).
 *   - "Topik" pada kartu Antrean Aktif diambil dari submission berstatus 'approved'
 *     (StudentQueueSession tidak mengekspos symptom/topik maupun submission id).
 *   - "Total bimbingan" di kartu dosen = jumlah submission approved (bukan dari
 *     endpoint hitung khusus).
 *   - "Progres Skripsi" — TODO(backend): statis/mock, belum ada model/endpoint.
 */
import { useEffect, useState } from 'react';
import { useRouteLoaderData, useLocation, useNavigate, Link } from 'react-router';
import type { User } from '../../api/auth';
import { logout } from '../../api/auth';
import { fetchMySubmissions, type SubmissionSummary } from '../../api/submissions';
import { getMyQueue, cancelMyQueue, type StudentQueueSession } from '../../api/sessions';
import StatusBadge from '../../components/StatusBadge';
import StatCard from '../../components/StatCard';
import SessionTable, { type SessionTableRow } from '../../components/SessionTable';
import DashboardNavbar from '../../components/DashboardNavbar';
import PDFPreview from '../../components/PDFPreview';
import Toast from '../../components/Toast';

type BadgeStatus = 'MENUNGGU' | 'DISETUJUI' | 'BERLANGSUNG' | 'SELESAI' | 'DIBATALKAN' | 'REVISI' | 'DITOLAK';

const SUBMISSION_STATUS_BADGE: Record<string, BadgeStatus> = {
  pending: 'MENUNGGU',
  approved: 'DISETUJUI',
  rejected: 'DITOLAK',
  revision: 'REVISI',
  cancelled: 'DIBATALKAN',
};

// Konvensi sama seperti StudentQueue.tsx — Session.status tidak punya nilai "approved".
const QUEUE_STATUS_BADGE: Record<string, BadgeStatus> = {
  waiting: 'MENUNGGU',
  in_progress: 'BERLANGSUNG',
  done: 'SELESAI',
};

// TODO(backend): checklist bab masih statis — belum ada model/endpoint progres skripsi.
const THESIS_CHAPTERS: { label: string; done: boolean; active?: boolean }[] = [
  { label: 'Bab I — Pendahuluan', done: true },
  { label: 'Bab II — Tinjauan Pustaka', done: true },
  { label: 'Bab III — Metodologi Penelitian', done: false, active: true },
  { label: 'Bab IV — Hasil & Pembahasan', done: false },
  { label: 'Bab V — Kesimpulan & Saran', done: false },
];

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return '-'; }
}

// ── Cancel confirm dialog (pola sama seperti StudentQueue.tsx, disalin lokal) ──

interface CancelConfirmDialogProps {
  dosenName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function CancelConfirmDialog({ dosenName, onConfirm, onCancel, loading }: CancelConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6" role="dialog" aria-modal="true" aria-label="Konfirmasi Batalkan Antrian">
      <div className="bg-surface rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <div className="flex flex-col items-center text-center gap-3 mb-6">
          <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-error text-2xl" aria-hidden="true">warning</span>
          </div>
          <h2 className="font-headline font-bold text-lg text-slate-900">Batalkan Antrian?</h2>
          <p className="text-sm text-on-surface-variant">
            Yakin ingin membatalkan antrian bimbingan dengan{' '}
            <span className="font-bold text-slate-700">{dosenName}</span>? Anda harus mengajukan ulang
            jika ingin bimbingan lagi.
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

// ── Page ────────────────────────────────────────────────────────────────────────

export default function StudentDashboard() {
  const user = useRouteLoaderData('mahasiswa') as User;
  const location = useLocation();
  const navigate = useNavigate();

  const [subs, setSubs] = useState<SubmissionSummary[]>([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [subsError, setSubsError] = useState<string | null>(null);

  const [queue, setQueue] = useState<StudentQueueSession | null>(null);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);

  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const [preview, setPreview] = useState<{ uuid: string; name: string } | null>(null);
  const [toast, setToast] = useState<string | null>(
    (location.state as { toast?: string } | null)?.toast ?? null
  );

  useEffect(() => {
    fetchMySubmissions()
      .then(setSubs)
      .catch(() => setSubsError('Gagal memuat riwayat sesi. Coba muat ulang halaman.'))
      .finally(() => setSubsLoading(false));
  }, []);

  useEffect(() => {
    getMyQueue()
      .then((q) => setQueue(q.hasActiveQueue ? q.session : null))
      .catch(() => setQueueError('Gagal memuat antrean aktif.'))
      .finally(() => setQueueLoading(false));
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  async function handleCancelConfirmed() {
    if (!queue) return;
    setCancelling(true);
    try {
      await cancelMyQueue(queue.id);
      setQueue(null);
      setShowCancelConfirm(false);
    } catch (err) {
      setQueueError(err instanceof Error ? err.message : 'Gagal membatalkan antrean.');
    } finally {
      setCancelling(false);
    }
  }

  function handleViewRow(row: SessionTableRow) {
    if (!row.fileUuid) return;
    setPreview({ uuid: row.fileUuid, name: row.fileName ?? 'draft.pdf' });
  }

  const firstName = user?.full_name?.split(' ')?.[0] ?? 'Mahasiswa';

  // FR-M01: blokir CTA jika ada submission menunggu keputusan dosen ATAU antrean aktif berjalan
  const hasPendingSubmission = subs.some((s) => s.status === 'pending');
  const isCtaBlocked = !subsLoading && !queueLoading && (hasPendingSubmission || !!queue);

  const totalSesi = subs.length;
  const menungguKonfirmasi = subs.filter((s) => s.status === 'pending').length;
  const approvedSubs = subs.filter((s) => s.status === 'approved');
  // Pendekatan: submission approved yang bukan sesi aktif saat ini dianggap "selesai".
  const sesiSelesai = Math.max(0, approvedSubs.length - (queue ? 1 : 0));

  // Topik antrean aktif: correlate dari submission approved (lihat catatan di header file).
  const activeSubmission = approvedSubs[0];
  const activeTopic = activeSubmission?.symptoms.map((x) => x.name).join(', ') || 'Bimbingan Skripsi';

  const historyRows: SessionTableRow[] = subs.slice(0, 3).map((s) => ({
    id: s.id,
    date: s.created_at,
    topic: s.symptoms.map((x) => x.name).join(', ') || 'Bimbingan Skripsi',
    dosen: user.adviser?.full_name ?? '-',
    status: SUBMISSION_STATUS_BADGE[s.status] ?? 'MENUNGGU',
    fileUuid: s.file_uuid,
    fileName: s.file_name,
    // STT-06 entry point (Phase 6): SubmissionSummary doesn't expose a linked
    // Session id or logbook status yet, so the second "Aksi" icon in
    // SessionTable stays disabled here — closing this needs a backend
    // serializer change, out of scope for this frontend-only plan.
    sessionId: null,
    logbookStatus: null,
  }));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <DashboardNavbar userName={user.full_name} onLogout={handleLogout} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-headline font-bold text-2xl text-on-surface">
              Selamat datang, {firstName}! 👋
            </h1>
            <p className="text-sm text-on-surface-variant mt-1">
              Berikut ringkasan aktivitas bimbingan skripsi Anda.
            </p>
          </div>

          {isCtaBlocked ? (
            <button
              type="button"
              disabled
              title="Anda masih memiliki pengajuan yang menunggu konfirmasi atau sedang berlangsung"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm min-h-[44px]
                         bg-primary/30 text-on-primary/60 cursor-not-allowed flex-shrink-0"
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">add</span>
              Ajukan Bimbingan Baru
            </button>
          ) : (
            <Link
              to="/mahasiswa/ajukan"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm min-h-[44px]
                         bg-primary text-on-primary hover:bg-primary-hover shadow-lg shadow-primary/25
                         active:scale-[0.98] transition-all flex-shrink-0
                         focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              <span className="material-symbols-outlined text-lg" aria-hidden="true">add</span>
              Ajukan Bimbingan Baru
            </Link>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard icon="folder_open" label="Total Sesi" value={subsLoading ? '—' : totalSesi} />
          <StatCard icon="task_alt" label="Sesi Selesai" value={subsLoading ? '—' : sesiSelesai} />
          <StatCard icon="hourglass_top" label="Menunggu Konfirmasi" value={subsLoading ? '—' : menungguKonfirmasi} />
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Antrean Aktif Saya */}
            <section className="bg-surface rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-headline font-bold text-lg text-on-surface mb-4">Antrean Aktif Saya</h2>

              {queueLoading && (
                <div className="animate-pulse space-y-2" aria-label="Memuat antrean aktif">
                  <div className="h-16 rounded-xl bg-gray-100" />
                </div>
              )}

              {!queueLoading && queueError && (
                <p className="text-sm text-error">{queueError}</p>
              )}

              {!queueLoading && !queueError && !queue && (
                <div className="py-8 flex flex-col items-center text-center">
                  <span className="material-symbols-outlined text-gray-300 text-4xl mb-2" aria-hidden="true">event_available</span>
                  <h3 className="font-bold text-slate-800 text-sm">Tidak Ada Antrean Aktif</h3>
                  <p className="text-xs text-on-surface-variant mt-1 max-w-xs">
                    Ajukan bimbingan baru untuk mulai mengantre.
                  </p>
                </div>
              )}

              {!queueLoading && !queueError && queue && (
                <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-gray-100 bg-gray-50">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{activeTopic}</p>
                    <p className="text-sm text-on-surface-variant mt-0.5">
                      {queue.dosen_name}
                      {queue.status === 'waiting' && queue.estimated_wait_minutes > 0 && (
                        <> · ±{queue.estimated_wait_minutes} menit</>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <StatusBadge status={QUEUE_STATUS_BADGE[queue.status] ?? 'MENUNGGU'} />
                    {queue.status === 'waiting' && (
                      <button
                        type="button"
                        onClick={() => setShowCancelConfirm(true)}
                        className="text-xs font-bold text-error hover:underline min-h-[44px] px-1
                                   focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none rounded"
                      >
                        Batalkan
                      </button>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Riwayat Sesi Bimbingan */}
            <section className="bg-surface rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-headline font-bold text-lg text-on-surface">Riwayat Sesi Bimbingan</h2>
                <span
                  className="text-sm font-bold text-on-surface-variant/50 cursor-not-allowed"
                  title="Halaman riwayat lengkap belum tersedia"
                >
                  Lihat Semua
                </span>
              </div>

              {subsLoading && (
                <div className="animate-pulse space-y-2" aria-label="Memuat riwayat sesi">
                  <div className="h-10 rounded-lg bg-gray-100" />
                  <div className="h-10 rounded-lg bg-gray-100" />
                  <div className="h-10 rounded-lg bg-gray-100" />
                </div>
              )}

              {!subsLoading && subsError && (
                <p className="text-sm text-error">{subsError}</p>
              )}

              {!subsLoading && !subsError && (
                <SessionTable rows={historyRows} onView={handleViewRow} fmtDate={fmtDate} />
              )}
            </section>
          </div>

          {/* Right column (sidebar) */}
          <div className="space-y-6">
            {/* Dosen Pembimbing Saya */}
            <section className="bg-surface rounded-2xl border border-gray-200 shadow-sm p-6">
              <h2 className="font-headline font-bold text-lg text-on-surface mb-4">Dosen Pembimbing Saya</h2>

              {user.adviser ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-lg flex-shrink-0">
                      {getInitials(user.adviser.full_name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{user.adviser.full_name}</p>
                      {user.adviser.nidn && (
                        <p className="text-xs text-on-surface-variant">NIDN {user.adviser.nidn}</p>
                      )}
                    </div>
                  </div>

                  {/* TODO(backend): total bimbingan belum punya endpoint hitung — pendekatan dari histori submission approved */}
                  <p className="text-sm text-on-surface-variant mb-4">
                    Total bimbingan bersama Anda:{' '}
                    <span className="font-bold text-slate-800">{subsLoading ? '—' : approvedSubs.length}</span>
                  </p>

                  <a
                    href={`mailto:${user.adviser.email}`}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-primary
                               text-accent-link text-sm font-bold hover:bg-primary/10 transition-colors min-h-[44px]
                               focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">mail</span>
                    Hubungi via Email
                  </a>
                </>
              ) : (
                <div className="py-6 flex flex-col items-center text-center">
                  <span className="material-symbols-outlined text-gray-300 text-4xl mb-2" aria-hidden="true">person_off</span>
                  <h3 className="font-bold text-slate-800 text-sm">Belum Ada Dosen Pembimbing</h3>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Hubungi admin untuk penempatan dosen pembimbing.
                  </p>
                </div>
              )}
            </section>

            {/* Progres Skripsi (mock/static — lihat TODO di header file) */}
            <section className="bg-surface rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 className="font-headline font-bold text-lg text-on-surface">Progres Skripsi</h2>
                <span className="text-sm font-bold text-primary">
                  {Math.round((THESIS_CHAPTERS.filter((c) => c.done).length / THESIS_CHAPTERS.length) * 100)}%
                </span>
              </div>
              <p className="text-xs text-on-surface-variant mb-4">Data contoh — belum terhubung ke backend</p>
              <div className="w-full h-2 rounded-full bg-gray-100 mb-5 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{
                    width: `${Math.round((THESIS_CHAPTERS.filter((c) => c.done).length / THESIS_CHAPTERS.length) * 100)}%`,
                  }}
                />
              </div>
              <ul className="space-y-3">
                {THESIS_CHAPTERS.map((c) => (
                  <li key={c.label} className="flex items-center gap-3">
                    {c.done ? (
                      <span className="material-symbols-outlined text-success text-xl flex-shrink-0" aria-hidden="true">
                        check_circle
                      </span>
                    ) : (
                      <span
                        className={`material-symbols-outlined text-xl flex-shrink-0 ${c.active ? 'text-primary' : 'text-gray-300'}`}
                        aria-hidden="true"
                      >
                        {c.active ? 'radio_button_checked' : 'radio_button_unchecked'}
                      </span>
                    )}
                    <span
                      className={[
                        'text-sm',
                        c.done ? 'line-through text-on-surface-variant' : c.active ? 'text-slate-900 font-bold' : 'text-on-surface-variant',
                      ].join(' ')}
                    >
                      {c.label}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-surface">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-on-surface-variant">
          <span className="font-bold text-slate-600">TemuDosen</span>
          <div className="flex items-center gap-4">
            <span className="cursor-not-allowed" title="Segera hadir">Tentang</span>
            <span className="cursor-not-allowed" title="Segera hadir">Panduan</span>
            <span className="cursor-not-allowed" title="Segera hadir">Kontak</span>
          </div>
          <span>&copy; {new Date().getFullYear()} TemuDosen. Semua hak dilindungi.</span>
        </div>
      </footer>

      {preview && (
        <PDFPreview fileUuid={preview.uuid} fileName={preview.name} onClose={() => setPreview(null)} />
      )}

      {showCancelConfirm && queue && (
        <CancelConfirmDialog
          dosenName={queue.dosen_name}
          loading={cancelling}
          onConfirm={handleCancelConfirmed}
          onCancel={() => setShowCancelConfirm(false)}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
