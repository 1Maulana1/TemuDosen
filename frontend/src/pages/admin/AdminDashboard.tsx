import { useState, useEffect, useCallback } from 'react';
import { Link, useLoaderData } from 'react-router';
import type { User } from '../../api/auth';
import { getAdminStats, adminEmergencyCancel, type AdminStats } from '../../api/stats';

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleString('id-ID', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }); }
  catch { return iso; }
}

export default function AdminDashboard() {
  const user = useLoaderData() as User;
  const [data, setData] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelMsg, setCancelMsg] = useState('');

  const load = useCallback(() => {
    getAdminStats().then(setData).catch(() => null).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleEmergencyCancel = async () => {
    const id = prompt('Masukkan ID Dosen untuk Emergency Cancel semua sesinya:');
    if (!id) return;
    try {
      const r = await adminEmergencyCancel(Number(id));
      setCancelMsg(r.message);
      load();
    } catch (e) { setCancelMsg(e instanceof Error ? e.message : 'Gagal.'); }
    setTimeout(() => setCancelMsg(''), 4000);
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

          {/* Emergency Cancel */}
          <section className="bg-error/5 border border-error/20 rounded-xl p-4">
            <h2 className="font-headline font-bold text-base text-error mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined">warning</span>Emergency Cancel
            </h2>
            <p className="text-sm text-slate-600 mb-3">Batalkan semua sesi aktif milik satu dosen sekaligus. Gunakan hanya dalam keadaan darurat.</p>
            <button type="button" onClick={handleEmergencyCancel}
              className="px-4 py-2.5 bg-error text-white text-sm font-bold rounded-xl hover:bg-red-700 min-h-[44px] focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none">
              Batalkan Sesi Dosen
            </button>
          </section>

          {/* Log error terbaru */}
          <section>
            <h2 className="font-headline font-bold text-lg text-slate-900 mb-3">Log Error Terbaru</h2>
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
        </section>
      </main>
    </div>
  );
}
