import { useState, useEffect, useCallback } from 'react';
import { useRouteLoaderData, useSearchParams, useNavigate } from 'react-router';
import { logout, type User } from '../../api/auth';
import { getCalendarStatus, getCalendarAuthUrl } from '../../api/sessions';
import { AppNavbar, AppBottomNav, NAV_ITEMS } from '../../components/AppNav';

const CALLBACK_REASON: Record<string, string> = {
  disabled: 'Google Calendar tidak diaktifkan di server ini.',
  invalid_state: 'Sesi OAuth tidak valid, silakan coba lagi.',
  save_failed: 'Gagal menyimpan token Google. Silakan coba lagi.',
};

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

export default function LecturerSettings() {
  const user = useRouteLoaderData('dosen') as User;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<{ enabled: boolean; connected: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    getCalendarStatus().then(setStatus).catch(() => null).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const calendarResult = searchParams.get('calendar');
  const calendarReason = searchParams.get('reason');

  useEffect(() => {
    if (calendarResult) {
      const t = setTimeout(() => setSearchParams({}, { replace: true }), 5000);
      return () => clearTimeout(t);
    }
  }, [calendarResult, setSearchParams]);

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <AppNavbar items={NAV_ITEMS.dosen} active="profil" userName={user?.full_name ?? 'Dosen'} onLogout={handleLogout} />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-8 space-y-5">
        <h1 className="font-headline font-bold text-2xl text-on-surface">Profil Saya</h1>

        {calendarResult === 'connected' && (
          <div className="bg-success/10 border border-success/20 rounded-xl p-3 text-sm font-bold text-success">
            Google Calendar berhasil dihubungkan.
          </div>
        )}
        {calendarResult === 'error' && (
          <div className="bg-error/10 border border-error/20 rounded-xl p-3 text-sm font-bold text-error">
            {CALLBACK_REASON[calendarReason ?? ''] ?? 'Gagal menghubungkan Google Calendar.'}
          </div>
        )}

        {/* Identity hero — full width */}
        <section className="rounded-2xl shadow-sm p-6 flex items-center gap-4 bg-gradient-to-br from-primary to-primary-hover">
          <div className="w-16 h-16 rounded-full bg-white/20 ring-2 ring-white/40 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
            {initials(user?.full_name ?? 'D') || '?'}
          </div>
          <div className="min-w-0">
            <p className="font-headline font-bold text-lg text-white truncate">{user?.full_name}</p>
            <p className="text-sm text-white/80 truncate">{user?.email}</p>
            <span className="inline-block mt-1.5 text-[11px] font-bold text-white bg-white/20 rounded-full px-2 py-0.5">Dosen</span>
          </div>
        </section>

        {/* Info + Integrasi side by side, equal columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Informasi Akun */}
          <section>
            <h2 className="font-headline font-bold text-lg text-slate-900 mb-3">Informasi Akun</h2>
            <div className="bg-surface rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm text-on-surface-variant">NIDN</span>
                <span className="text-sm font-bold text-slate-800">{user?.nidn ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm text-on-surface-variant">Email</span>
                <span className="text-sm font-bold text-slate-800 truncate ml-4">{user?.email}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm text-on-surface-variant">Peran</span>
                <span className="text-sm font-bold text-slate-800">Dosen</span>
              </div>
            </div>
          </section>

          {/* Integrasi */}
          <section>
            <h2 className="font-headline font-bold text-lg text-slate-900 mb-3">Integrasi</h2>
            <div className="bg-surface rounded-2xl border border-gray-200 shadow-sm p-5 flex items-center gap-3">
              <span className={`material-symbols-outlined text-2xl ${status?.connected ? 'text-success' : 'text-gray-300'}`}>
                calendar_month
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-slate-800">Google Calendar</p>
                <p className="text-[11px] text-on-surface-variant">
                  {loading
                    ? 'Memeriksa status...'
                    : !status?.enabled
                    ? 'Integrasi belum diaktifkan di server ini.'
                    : status.connected
                    ? 'Terhubung — sesi yang disetujui otomatis muncul di kalender Anda.'
                    : 'Belum terhubung. Sesi tetap berjalan normal tanpa ini.'}
                </p>
              </div>
              {status?.enabled && !status.connected && (
                <a
                  href={getCalendarAuthUrl()}
                  className="px-3 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg hover:bg-primary-hover min-h-[44px] flex items-center flex-shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                >
                  Hubungkan
                </a>
              )}
            </div>
          </section>
        </div>

        {/* Logout */}
        <button type="button" onClick={handleLogout}
          className="w-full sm:max-w-xs py-3 rounded-xl border border-error/30 text-error text-sm font-bold hover:bg-error/5 min-h-[44px] flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none">
          <span className="material-symbols-outlined text-base" aria-hidden="true">logout</span>
          Keluar
        </button>
      </main>

      <AppBottomNav items={NAV_ITEMS.dosen} active="profil" />
    </div>
  );
}
