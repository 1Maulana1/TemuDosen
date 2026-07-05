import { useState, useEffect, useCallback } from 'react';
import { Link, useLoaderData } from 'react-router';
import type { User } from '../../api/auth';
import { getAdminStats, adminEmergencyCancel, type AdminStats } from '../../api/stats';

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }); }
  catch { return iso; }
}

function fmtRupiah(n: number) {
  return `Rp ${Math.round(n).toLocaleString('id-ID')}`;
}

// D-10: same Phase-6 event_type set AdminStatsView aggregates into failed_fallback
const STT_LLM_EVENT_TYPES = new Set([
  'STT_FAILED', 'STT_TIMEOUT', 'STT_EMPTY', 'STT_DISABLED',
  'LLM_FAILED', 'LLM_TIMEOUT', 'LLM_VALIDATION_FAILED', 'LLM_DISABLED',
]);

// ── Emergency Cancel Modal (FR-AD02) ────────────────────────────────────────────

interface EmergencyCancelModalProps {
  dosenName: string;
  activeSessions: number;
  onConfirm: (alasan: string) => void;
  onClose: () => void;
  loading: boolean;
}

function EmergencyCancelModal({ dosenName, activeSessions, onConfirm, onClose, loading }: EmergencyCancelModalProps) {
  const [alasan, setAlasan] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (alasan.trim().length < 10) {
      setError('Alasan wajib diisi (minimal 10 karakter).');
      return;
    }
    setError('');
    onConfirm(alasan.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true" aria-label="Konfirmasi Emergency Cancel">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-error" aria-hidden="true">warning</span>
          </div>
          <h2 className="font-headline font-bold text-lg text-slate-900">Konfirmasi Emergency Cancel</h2>
        </div>
        <p className="text-sm text-slate-600 mb-1">
          Dosen: <span className="font-bold text-slate-800">{dosenName}</span>
        </p>
        <p className="text-sm text-slate-600 mb-4">
          <span className="font-bold text-error">{activeSessions}</span> antrian aktif akan dibatalkan.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label htmlFor="alasan" className="text-sm font-bold text-slate-700 block mb-1">
              Alasan <span className="text-error">*</span>
              <span className="font-normal text-neutral-gray ml-1">(min. 10 karakter)</span>
            </label>
            <textarea
              id="alasan"
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
              rows={3}
              placeholder="Contoh: Dosen berhalangan mendadak"
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
            />
          </div>

          {error && <p className="text-error text-sm">{error}</p>}

          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-slate-600 hover:bg-gray-50 min-h-[44px]">
              Batal
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-xl bg-error text-white text-sm font-bold hover:bg-red-700 disabled:opacity-60 min-h-[44px]">
              {loading ? 'Membatalkan...' : 'Emergency Cancel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const user = useLoaderData() as User;
  const [data, setData] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelMsg, setCancelMsg] = useState('');
  const [selectedDosenId, setSelectedDosenId] = useState<number | ''>('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    getAdminStats().then(setData).catch(() => null).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedDosen = data?.lecturers.find((l) => l.id === selectedDosenId) ?? null;

  const handleEmergencyCancel = async (alasan: string) => {
    if (!selectedDosen) return;
    setCancelling(true);
    try {
      const r = await adminEmergencyCancel(selectedDosen.id, alasan);
      setCancelMsg(`${r.message} — ${r.sessions_cancelled} sesi dosen ${r.dosen_name} dibatalkan.`);
      setShowCancelModal(false);
      setSelectedDosenId('');
      load();
    } catch (e) {
      setCancelMsg(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setCancelling(false);
      setTimeout(() => setCancelMsg(''), 5000);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 h-16 max-w-2xl mx-auto flex items-center justify-between px-4">
        <span className="font-headline font-bold text-lg text-primary">TemuDosen — Admin</span>
        <span className="text-sm text-neutral-gray">{user?.full_name}</span>
      </header>

      <main className="pt-20 pb-8 px-4 max-w-2xl mx-auto space-y-6">
        {cancelMsg && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 text-sm font-bold text-warning">{cancelMsg}</div>
        )}

        {loading && <p className="text-center py-16 text-neutral-gray text-sm">Memuat data...</p>}

        {!loading && data && (<>
          {/* Stat cards */}
          <section>
            <h2 className="font-headline font-bold text-lg text-slate-900 mb-3">Ringkasan Sistem</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Mahasiswa Aktif', value: data.total_students, icon: 'school', color: 'text-primary' },
                { label: 'Dosen Aktif', value: data.total_lecturers, icon: 'person_book', color: 'text-success' },
                { label: 'Menunggu Persetujuan', value: data.total_pending_users, icon: 'pending', color: 'text-warning' },
                { label: 'Sesi Aktif Sekarang', value: data.active_sessions_today, icon: 'schedule', color: 'text-error' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <span className={`material-symbols-outlined text-2xl ${c.color}`}>{c.icon}</span>
                  <p className={`font-headline font-bold text-3xl mt-1 ${c.color}`}>{c.value}</p>
                  <p className="text-[11px] text-neutral-gray mt-0.5">{c.label}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Status integrasi */}
          <section>
            <h2 className="font-headline font-bold text-lg text-slate-900 mb-3">Status Integrasi</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
                <span className={`material-symbols-outlined text-2xl ${data.integrations.google_calendar.enabled ? 'text-success' : 'text-gray-300'}`}>calendar_month</span>
                <div>
                  <p className="font-bold text-sm text-slate-800">Google Calendar</p>
                  <p className="text-[11px] text-neutral-gray">
                    {data.integrations.google_calendar.enabled
                      ? `Aktif · ${data.integrations.google_calendar.connected_dosens} dosen terhubung`
                      : 'Nonaktif'}
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
                <span className={`material-symbols-outlined text-2xl ${data.integrations.logbook.enabled ? 'text-success' : 'text-gray-300'}`}>menu_book</span>
                <div>
                  <p className="font-bold text-sm text-slate-800">Logbook Kampus</p>
                  <p className="text-[11px] text-neutral-gray">{data.integrations.logbook.enabled ? 'Aktif' : 'Nonaktif'}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Pemrosesan STT/AI (ADMIN-05, S-17) */}
          <section>
            <h2 className="font-headline font-bold text-lg text-slate-900 mb-3">Pemrosesan STT/AI</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Transkripsi Berhasil', value: data.stt_llm.transcription_success, icon: 'graphic_eq', color: 'text-success' },
                { label: 'Ringkasan Berhasil', value: data.stt_llm.summary_success, icon: 'auto_awesome', color: 'text-success' },
                { label: 'Gagal / Fallback Manual', value: data.stt_llm.failed_fallback, icon: 'error_outline', color: 'text-error' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                  <span className={`material-symbols-outlined text-2xl ${c.color}`}>{c.icon}</span>
                  <p className={`font-headline font-bold text-3xl mt-1 ${c.color}`}>{c.value}</p>
                  <p className="text-[11px] text-neutral-gray mt-0.5">{c.label}</p>
                </div>
              ))}
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                <span className="material-symbols-outlined text-2xl text-primary">payments</span>
                <p className="font-headline font-bold text-3xl mt-1 text-primary">
                  {fmtRupiah(data.stt_llm.monthly_cost_idr)}
                </p>
                <p className="text-[11px] text-neutral-gray mt-0.5">Estimasi Biaya Bulan Ini</p>
                <p className="text-[11px] text-neutral-gray">
                  rata-rata ~{fmtRupiah(data.stt_llm.avg_cost_per_session_idr)}/sesi
                </p>
              </div>
            </div>

            {(() => {
              const sttLlmErrors = data.recent_errors.filter((e) => STT_LLM_EVENT_TYPES.has(e.event_type));
              return sttLlmErrors.length > 0 ? (
                <div className="space-y-2 mt-3">
                  {sttLlmErrors.map(e => (
                    <div key={e.id} className="bg-white rounded-xl border border-error/10 p-3 flex items-start gap-3">
                      <span className="material-symbols-outlined text-error text-base mt-0.5 flex-shrink-0">error</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-800 truncate">{e.event_type}</p>
                        <p className="text-[11px] text-neutral-gray truncate">{e.message}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{fmtTime(e.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null;
            })()}
          </section>

          {/* Emergency Cancel (FR-AD02) */}
          <section className="bg-error/5 border border-error/20 rounded-xl p-4">
            <h2 className="font-headline font-bold text-base text-error mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined">warning</span>Emergency Cancel
            </h2>
            <p className="text-sm text-slate-600 mb-3">Batalkan semua sesi aktif milik satu dosen sekaligus. Gunakan hanya dalam keadaan darurat.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <select
                value={selectedDosenId}
                onChange={(e) => setSelectedDosenId(e.target.value ? Number(e.target.value) : '')}
                aria-label="Pilih dosen"
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-error/30 focus:border-error min-h-[44px]"
              >
                <option value="">Pilih dosen...</option>
                {data.lecturers.map((l) => (
                  <option key={l.id} value={l.id}>{l.full_name} ({l.active_sessions} antrian aktif)</option>
                ))}
              </select>
              <button type="button" onClick={() => setShowCancelModal(true)} disabled={!selectedDosen}
                className="px-4 py-2.5 bg-error text-white text-sm font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none">
                Emergency Cancel
              </button>
            </div>
          </section>

          {/* Log error terbaru (FR-AD03) */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-headline font-bold text-lg text-slate-900">Log Error Terbaru</h2>
              <Link to="/admin/logs" className="text-xs text-primary font-bold">Lihat Semua Log →</Link>
            </div>
            {data.recent_errors.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
                <span className="material-symbols-outlined text-success text-3xl block mb-1">check_circle</span>
                <p className="text-sm text-neutral-gray">Tidak ada error terbaru.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.recent_errors.map(e => (
                  <div key={e.id} className="bg-white rounded-xl border border-error/10 p-3 flex items-start gap-3">
                    <span className="material-symbols-outlined text-error text-base mt-0.5 flex-shrink-0">error</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800 truncate">{e.event_type}</p>
                      <p className="text-[11px] text-neutral-gray truncate">{e.message}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{fmtTime(e.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>)}

        {/* Nav links */}
        <section className="grid grid-cols-2 gap-3">
          <Link to="/admin/pengguna" className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow">
            <span className="material-symbols-outlined text-primary text-2xl">manage_accounts</span>
            <div><p className="font-bold text-sm text-slate-800">Kelola Pengguna</p><p className="text-[11px] text-neutral-gray">Setujui pendaftaran</p></div>
          </Link>
          <Link to="/admin/katalog-gejala" className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow">
            <span className="material-symbols-outlined text-primary text-2xl">category</span>
            <div><p className="font-bold text-sm text-slate-800">Katalog Gejala</p><p className="text-[11px] text-neutral-gray">Atur kategori</p></div>
          </Link>
          <Link to="/admin/logs" className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow">
            <span className="material-symbols-outlined text-primary text-2xl">receipt_long</span>
            <div><p className="font-bold text-sm text-slate-800">Log Sistem</p><p className="text-[11px] text-neutral-gray">Semua event & error</p></div>
          </Link>
        </section>
      </main>

      {showCancelModal && selectedDosen && (
        <EmergencyCancelModal
          dosenName={selectedDosen.full_name}
          activeSessions={selectedDosen.active_sessions}
          onConfirm={handleEmergencyCancel}
          onClose={() => setShowCancelModal(false)}
          loading={cancelling}
        />
      )}
    </div>
  );
}
