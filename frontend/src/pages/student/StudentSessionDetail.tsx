/**
 * StudentSessionDetail — /mahasiswa/sesi/:id
 *
 * Phase 6 (UI-first, partial): mahasiswa mendengar rekaman sesinya (jika ada)
 * dan melihat ringkasan hasil bimbingan — HANYA setelah dosen menyetujuinya.
 * Read-only; tidak ada aksi edit di sisi mahasiswa.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams, useRouteLoaderData } from 'react-router';
import { getSessionSummary, getSessionRecordingUrl, type SessionSummaryDetail } from '../../api/sessions';
import { logout, type User } from '../../api/auth';
import { AppNavbar, AppBottomNav, NAV_ITEMS } from '../../components/AppNav';

function fmtDateTime(iso: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return '-'; }
}

export default function StudentSessionDetail() {
  const user = useRouteLoaderData('mahasiswa') as User;
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const sessionId = Number(id);

  const [data, setData] = useState<SessionSummaryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getSessionSummary(sessionId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat sesi.'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const isApproved = !!data?.summary_approved_at;

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <AppNavbar items={NAV_ITEMS.mahasiswa} active="riwayat" userName={user?.full_name ?? 'Mahasiswa'} onLogout={handleLogout} />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-8 space-y-5">
        <Link to="/mahasiswa/riwayat" className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded">
          <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>
          Kembali ke Riwayat
        </Link>

        {loading && (
          <div className="text-center py-16 text-on-surface-variant text-sm" aria-live="polite" aria-busy="true">
            <span className="material-symbols-outlined animate-spin text-3xl block mb-2">progress_activity</span>
            Memuat sesi...
          </div>
        )}

        {!loading && error && (
          <div className="bg-error/5 border border-error/20 rounded-xl p-4 text-center" aria-live="assertive">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {/* Info sesi */}
            <section className="bg-surface rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary flex-shrink-0">
                  {data.dosen_name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')}
                </div>
                <div className="min-w-0">
                  <p className="font-headline font-bold text-lg text-slate-900 truncate">{data.dosen_name}</p>
                  <p className="text-sm text-on-surface-variant">Selesai {fmtDateTime(data.ts2)}</p>
                </div>
              </div>
            </section>

            {/* Rekaman */}
            <section>
              <h2 className="font-headline font-bold text-lg text-slate-900 mb-3">Rekaman</h2>
              <div className="bg-surface rounded-2xl border border-gray-200 shadow-sm p-5">
                {data.has_recording ? (
                  <audio controls className="w-full" src={getSessionRecordingUrl(sessionId)}>
                    Browser Anda tidak mendukung pemutaran audio.
                  </audio>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-gray-300" aria-hidden="true">mic_off</span>
                    Sesi ini tidak memiliki rekaman.
                  </div>
                )}
              </div>
            </section>

            {/* Ringkasan */}
            <section>
              <h2 className="font-headline font-bold text-lg text-slate-900 mb-3">Ringkasan Hasil Bimbingan</h2>
              <div className="bg-surface rounded-2xl border border-gray-200 shadow-sm p-5">
                {isApproved ? (
                  <>
                    <div className="flex items-center gap-1.5 mb-3 text-[11px] font-bold text-success bg-success/10 rounded-full px-2 py-1 w-fit">
                      <span className="material-symbols-outlined text-sm" aria-hidden="true">check_circle</span>
                      Disetujui dosen {fmtDateTime(data.summary_approved_at)}
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{data.summary}</p>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-center py-6">
                    <span className="material-symbols-outlined text-gray-300 text-3xl mb-2" aria-hidden="true">hourglass_top</span>
                    <p className="text-sm text-on-surface-variant">Ringkasan belum tersedia — menunggu dosen mengisi dan menyetujuinya.</p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <AppBottomNav items={NAV_ITEMS.mahasiswa} active="riwayat" />
    </div>
  );
}
