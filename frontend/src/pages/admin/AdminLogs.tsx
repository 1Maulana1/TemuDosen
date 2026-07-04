/**
 * AdminLogs — /admin/logs
 * FR-AD03: log error/event sistem, berpaginasi, auto-refresh, filter by type, cleanup >30 hari.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouteLoaderData, useNavigate } from 'react-router';
import { logout, type User } from '../../api/auth';
import { AppNavbar, AppBottomNav, NAV_ITEMS } from '../../components/AppNav';
import { getAdminLogs, cleanupAdminLogs, type AdminLogEntry } from '../../api/stats';

const KNOWN_TYPES = [
  'CALENDAR_ERROR', 'STT_ERROR', 'LLM_ERROR', 'LOGBOOK_SYNC_ERROR', 'EMERGENCY_CANCEL', 'INFO',
];

const TYPE_BADGE: Record<string, string> = {
  CALENDAR_ERROR: 'bg-error/10 text-error',
  STT_ERROR: 'bg-orange-100 text-orange-700',
  LLM_ERROR: 'bg-orange-100 text-orange-700',
  LOGBOOK_SYNC_ERROR: 'bg-yellow-100 text-yellow-800',
  EMERGENCY_CANCEL: 'bg-red-200 text-red-900',
  INFO: 'bg-blue-100 text-blue-700',
};

function badgeClass(type: string): string {
  return TYPE_BADGE[type] ?? 'bg-gray-100 text-gray-600';
}

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('id-ID', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch { return iso; }
}

export default function AdminLogs() {
  const user = useRouteLoaderData('admin') as User;
  const navigate = useNavigate();
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupMsg, setCleanupMsg] = useState('');
  const limit = 50;
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await getAdminLogs({ type: typeFilter || undefined, page, limit });
      setLogs(res.logs);
      setTotal(res.total);
    } catch {
      setError('Gagal memuat log sistem.');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, page]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    refreshRef.current = setInterval(() => load(), 60_000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [load]);

  const handleCleanup = async () => {
    setCleaning(true);
    try {
      const r = await cleanupAdminLogs();
      setCleanupMsg(`${r.deleted} log lama berhasil dihapus.`);
      setPage(1);
      load();
    } catch {
      setCleanupMsg('Gagal menghapus log lama.');
    } finally {
      setCleaning(false);
      setTimeout(() => setCleanupMsg(''), 4000);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <AppNavbar items={NAV_ITEMS.admin} active="log" userName={user?.full_name ?? 'Admin'} onLogout={handleLogout} brandSuffix="Admin" />

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-8 space-y-4">
        <h1 className="font-headline font-bold text-2xl text-on-surface">Log Sistem</h1>
        {cleanupMsg && (
          <div className="bg-success/10 border border-success/20 rounded-xl p-3 text-sm font-bold text-success">{cleanupMsg}</div>
        )}

        {/* Filter + actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            aria-label="Filter tipe log"
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-h-[44px]"
          >
            <option value="">Semua Tipe</option>
            {KNOWN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>

          <button type="button" onClick={handleCleanup} disabled={cleaning}
            className="px-4 py-2.5 border border-error/30 text-error text-sm font-bold rounded-xl hover:bg-error/5 disabled:opacity-60 min-h-[44px]">
            {cleaning ? 'Menghapus...' : 'Hapus Log >30 hari'}
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="text-center py-16 text-neutral-gray text-sm" aria-live="polite" aria-busy="true">
              <span className="material-symbols-outlined animate-spin text-3xl block mb-2">progress_activity</span>
              Memuat log...
            </div>
          ) : error ? (
            <div className="p-4 text-center text-sm text-error">
              {error}
              <button type="button" onClick={load} className="ml-2 text-primary font-bold underline">Coba Lagi</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Tabel log sistem">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-44">Waktu</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-40">Tipe</th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pesan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-slate-500">{fmtTime(log.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded px-2 py-1 text-[11px] font-bold uppercase ${badgeClass(log.type)}`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">{log.message}</td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-12 text-center text-sm text-slate-400">Tidak ada log.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && !error && total > 0 && (
          <div className="flex items-center justify-between text-sm text-neutral-gray">
            <span>Halaman {page} dari {totalPages} ({total} log)</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-2 border border-gray-200 rounded-lg font-bold disabled:opacity-40 min-h-[44px]">
                Sebelumnya
              </button>
              <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                className="px-3 py-2 border border-gray-200 rounded-lg font-bold disabled:opacity-40 min-h-[44px]">
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </main>

      <AppBottomNav items={NAV_ITEMS.admin} active="log" />
    </div>
  );
}
