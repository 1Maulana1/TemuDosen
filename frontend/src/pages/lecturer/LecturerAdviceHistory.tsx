/**
 * LecturerAdviceHistory — /dosen/saran
 *
 * Phase 7 SC2 (ADVICE-02): rekap seluruh saran/tindak-lanjut yang dosen berikan
 * lintas sesi, dikelompokkan per mahasiswa bimbingan, dengan status kepatuhannya.
 * Melengkapi UI per-sesi (LecturerSessionDetail) dengan pandangan agregat.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useRouteLoaderData, useNavigate } from 'react-router';
import { getLecturerAdviceHistory, type LecturerAdviceHistory } from '../../api/sessions';
import { logout, type User } from '../../api/auth';
import { AppNavbar, AppBottomNav, NAV_ITEMS } from '../../components/AppNav';

function fmtDate(iso: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '-'; }
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

export default function LecturerAdviceHistory() {
  const user = useRouteLoaderData('dosen') as User;
  const navigate = useNavigate();
  const [data, setData] = useState<LecturerAdviceHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getLecturerAdviceHistory()
      .then(setData)
      .catch(() => setError('Gagal memuat riwayat saran.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const isEmpty = !loading && !error && data !== null && data.per_mahasiswa.length === 0;

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <AppNavbar items={NAV_ITEMS.dosen} active="saran" userName={user?.full_name ?? 'Dosen'} onLogout={handleLogout} />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-8">
        <h1 className="font-headline font-bold text-2xl text-on-surface mb-1">Riwayat Saran</h1>
        <p className="text-sm text-on-surface-variant mb-6">
          Rekap saran yang Anda berikan dan status tindak lanjut mahasiswa bimbingan.
        </p>

        {loading && (
          <div className="text-center py-16 text-on-surface-variant text-sm" aria-live="polite" aria-busy="true">
            <span className="material-symbols-outlined animate-spin text-3xl block mb-2">progress_activity</span>
            Memuat riwayat saran...
          </div>
        )}

        {!loading && error && (
          <div className="bg-error/5 border border-error/20 rounded-xl p-4 text-center" aria-live="assertive">
            <p className="text-sm text-error">{error}</p>
            <button type="button" onClick={load} className="mt-2 text-sm text-primary font-bold underline">Coba Lagi</button>
          </div>
        )}

        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="material-symbols-outlined text-gray-300 text-5xl mb-4" aria-hidden="true">checklist</span>
            <h3 className="font-headline font-bold text-lg text-slate-900 mb-2">Belum Ada Saran</h3>
            <p className="text-sm text-on-surface-variant max-w-xs">
              Saran yang Anda tambahkan pada detail sesi akan terkumpul di sini per mahasiswa.
            </p>
          </div>
        )}

        {!loading && !error && data !== null && data.per_mahasiswa.length > 0 && (
          <>
            {/* Ringkasan keseluruhan */}
            <div className="bg-surface rounded-xl border border-gray-200 shadow-sm p-4 mb-6 flex flex-wrap items-center gap-x-8 gap-y-3">
              <div>
                <p className="text-2xl font-bold text-on-surface">{data.total_saran}</p>
                <p className="text-[11px] text-on-surface-variant">Total saran</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-success">{data.saran_selesai}</p>
                <p className="text-[11px] text-on-surface-variant">Ditindaklanjuti</p>
              </div>
              <div className="flex-1 min-w-[140px]">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-on-surface-variant">Kepatuhan</span>
                  <span className="text-[11px] font-bold text-primary">{data.compliance_rate}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden" role="progressbar" aria-valuenow={data.compliance_rate} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full bg-primary rounded-full" style={{ width: `${data.compliance_rate}%` }} />
                </div>
              </div>
            </div>

            {/* Per mahasiswa */}
            <div className="space-y-4" role="list">
              {data.per_mahasiswa.map((mhs) => (
                <section key={mhs.student_id} role="listitem" className="bg-surface rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <header className="flex items-center gap-3 p-4 border-b border-gray-100">
                    <div className="w-10 h-10 min-w-[40px] rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                      {initials(mhs.nama)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-sm text-slate-900 truncate">{mhs.nama}</p>
                      <p className="text-[11px] text-on-surface-variant">{mhs.nim}</p>
                    </div>
                    <span className="text-[11px] font-bold text-on-surface-variant bg-gray-100 rounded-full px-2.5 py-1 whitespace-nowrap">
                      {mhs.saran_selesai}/{mhs.total_saran} selesai
                    </span>
                  </header>

                  <ul className="divide-y divide-gray-100">
                    {mhs.items.map((item) => (
                      <li key={item.id} className="flex items-start gap-3 p-4">
                        <span
                          className={`material-symbols-outlined text-xl mt-0.5 flex-shrink-0 ${item.is_completed ? 'text-success' : 'text-gray-300'}`}
                          style={item.is_completed ? { fontVariationSettings: "'FILL' 1" } : undefined}
                          aria-hidden="true"
                        >
                          {item.is_completed ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-on-surface">{item.description}</p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                            <span className="text-[11px] text-on-surface-variant">Diberi {fmtDate(item.created_at)}</span>
                            {item.is_completed ? (
                              <span className="text-[11px] font-bold text-success">Selesai {fmtDate(item.completed_at)}</span>
                            ) : (
                              <span className="text-[11px] font-bold text-warning">Belum ditindaklanjuti</span>
                            )}
                            <Link to={`/dosen/sesi/${item.session_id}`} className="text-[11px] font-bold text-primary underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded">
                              Lihat sesi
                            </Link>
                          </div>
                          {item.completion_note && (
                            <p className="mt-1.5 text-[13px] text-slate-600 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                              <span className="font-bold text-on-surface-variant">Catatan mahasiswa: </span>{item.completion_note}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </main>

      <AppBottomNav items={NAV_ITEMS.dosen} active="saran" />
    </div>
  );
}
