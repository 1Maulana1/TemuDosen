/**
 * StudentHistory — /mahasiswa/riwayat
 *
 * Phase 6 (UI-first, partial): daftar sesi bimbingan mahasiswa yang sudah
 * selesai. Ringkasan hanya terlihat setelah dosen menyetujuinya.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useRouteLoaderData, useNavigate } from 'react-router';
import { getStudentSessionHistory, type SessionHistoryItem } from '../../api/sessions';
import { logout, type User } from '../../api/auth';
import { AppNavbar, AppBottomNav, NAV_ITEMS } from '../../components/AppNav';

function fmtDate(iso: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '-'; }
}

export default function StudentHistory() {
  const user = useRouteLoaderData('mahasiswa') as User;
  const navigate = useNavigate();
  const [items, setItems] = useState<SessionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getStudentSessionHistory()
      .then(setItems)
      .catch(() => setError('Gagal memuat riwayat sesi.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <AppNavbar items={NAV_ITEMS.mahasiswa} active="riwayat" userName={user?.full_name ?? 'Mahasiswa'} onLogout={handleLogout} />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-8">
        <h1 className="font-headline font-bold text-2xl text-on-surface mb-6">Riwayat Sesi Bimbingan</h1>

        {loading && (
          <div className="text-center py-16 text-on-surface-variant text-sm" aria-live="polite" aria-busy="true">
            <span className="material-symbols-outlined animate-spin text-3xl block mb-2">progress_activity</span>
            Memuat riwayat...
          </div>
        )}

        {!loading && error && (
          <div className="bg-error/5 border border-error/20 rounded-xl p-4 text-center" aria-live="assertive">
            <p className="text-sm text-error">{error}</p>
            <button type="button" onClick={load} className="mt-2 text-sm text-primary font-bold underline">Coba Lagi</button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="material-symbols-outlined text-gray-300 text-5xl mb-4" aria-hidden="true">history</span>
            <h3 className="font-headline font-bold text-lg text-slate-900 mb-2">Belum Ada Riwayat Sesi</h3>
            <p className="text-sm text-on-surface-variant max-w-xs">Sesi bimbingan yang sudah selesai akan muncul di sini.</p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="list">
            {items.map((item) => (
              <Link
                key={item.id}
                to={`/mahasiswa/sesi/${item.id}`}
                role="listitem"
                className="bg-surface rounded-xl border border-gray-200 shadow-sm p-4 flex items-start gap-3 hover:shadow-md transition-shadow focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                <div className="w-10 h-10 min-w-[40px] rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm flex-shrink-0">
                  {item.dosen_name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm text-slate-900 truncate">{item.dosen_name}</p>
                  <p className="text-[11px] text-on-surface-variant">{fmtDate(item.ts2)}</p>
                  <p className="text-[11px] text-on-surface-variant truncate mt-0.5">{item.symptom_name}</p>
                  <div className="mt-2">
                    {item.summary_approved_at ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success bg-success/10 rounded-full px-2 py-0.5">
                        <span className="material-symbols-outlined text-sm" aria-hidden="true">check_circle</span>Ringkasan tersedia
                      </span>
                    ) : (
                      <span className="text-[11px] text-on-surface-variant bg-gray-100 rounded-full px-2 py-0.5">Menunggu ringkasan dosen</span>
                    )}
                  </div>
                </div>
                <span className="material-symbols-outlined text-gray-300 flex-shrink-0" aria-hidden="true">chevron_right</span>
              </Link>
            ))}
          </div>
        )}
      </main>

      <AppBottomNav items={NAV_ITEMS.mahasiswa} active="riwayat" />
    </div>
  );
}
