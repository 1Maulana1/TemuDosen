import { useState, useEffect, useCallback } from 'react';
import { Link, useRouteLoaderData, useSearchParams } from 'react-router';
import type { User } from '../../api/auth';
import { getCalendarStatus, getCalendarAuthUrl } from '../../api/sessions';

const CALLBACK_REASON: Record<string, string> = {
  disabled: 'Google Calendar tidak diaktifkan di server ini.',
  invalid_state: 'Sesi OAuth tidak valid, silakan coba lagi.',
  save_failed: 'Gagal menyimpan token Google. Silakan coba lagi.',
};

export default function LecturerSettings() {
  const user = useRouteLoaderData('dosen') as User;
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<{ enabled: boolean; connected: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    getCalendarStatus().then(setStatus).catch(() => null).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const calendarResult = searchParams.get('calendar');
  const calendarReason = searchParams.get('reason');

  useEffect(() => {
    if (calendarResult) {
      const t = setTimeout(() => setSearchParams({}, { replace: true }), 5000);
      return () => clearTimeout(t);
    }
  }, [calendarResult, setSearchParams]);

  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 h-16 max-w-md mx-auto flex items-center px-4 gap-3">
        <Link to="/dosen" className="text-gray-400 flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <span className="font-headline font-bold text-lg text-primary">Pengaturan</span>
      </header>

      <main className="pt-20 pb-8 px-4 max-w-md mx-auto space-y-5">
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

        <section>
          <h2 className="font-headline font-bold text-lg text-slate-900 mb-1">{user?.full_name}</h2>
          <p className="text-sm text-neutral-gray">{user?.email}</p>
        </section>

        <section>
          <h2 className="font-headline font-bold text-lg text-slate-900 mb-3">Integrasi</h2>

          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex items-center gap-3">
            <span className={`material-symbols-outlined text-2xl ${status?.connected ? 'text-success' : 'text-gray-300'}`}>
              calendar_month
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-slate-800">Google Calendar</p>
              <p className="text-[11px] text-neutral-gray">
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
                className="px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-blue-700 min-h-[44px] flex items-center flex-shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                Hubungkan
              </a>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
