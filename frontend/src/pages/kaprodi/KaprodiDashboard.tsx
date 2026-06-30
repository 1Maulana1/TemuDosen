import { useState, useEffect } from 'react';
import { useLoaderData } from 'react-router';
import type { User } from '../../api/auth';
import { getKaprodiStats, getKaprodiExportUrl, type KaprodiStats } from '../../api/stats';

export default function KaprodiDashboard() {
  const user = useLoaderData() as User;
  const [data, setData] = useState<KaprodiStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    getKaprodiStats().then(setData).catch(() => null).finally(() => setLoading(false));
  }, []);

  const maxSessions = data ? Math.max(...data.dosen_workload.map(d => d.total_sessions), 1) : 1;

  const handleExport = () => {
    setExporting(true);
    window.open(getKaprodiExportUrl(), '_blank');
    setTimeout(() => setExporting(false), 2000);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 h-16 max-w-2xl mx-auto flex items-center justify-between px-4">
        <span className="font-headline font-bold text-lg text-primary">TemuDosen — Kaprodi</span>
        <span className="text-sm text-neutral-gray">{user?.full_name}</span>
      </header>

      <main className="pt-20 pb-8 px-4 max-w-2xl mx-auto space-y-6">
        {loading && <p className="text-center py-16 text-neutral-gray text-sm">Memuat data...</p>}

        {!loading && data && (<>
          {/* Header bulan */}
          <section className="pt-2 flex items-center justify-between">
            <div>
              <h1 className="font-headline font-bold text-2xl text-slate-900">Laporan Bimbingan</h1>
              <p className="text-sm text-neutral-gray mt-0.5">{data.month_label}</p>
            </div>
            <button type="button" onClick={handleExport} disabled={exporting}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-blue-700 disabled:opacity-60 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
              <span className="material-symbols-outlined text-base">download</span>
              {exporting ? 'Mengunduh...' : 'Ekspor CSV'}
            </button>
          </section>

          {/* Stat cards */}
          <section className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-[11px] text-neutral-gray">Total Sesi Bulan Ini</p>
              <p className="font-headline font-bold text-4xl text-primary mt-1">{data.total_sessions_month}</p>
              <p className="text-[11px] text-neutral-gray">sesi bimbingan</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-[11px] text-neutral-gray">Rata-rata Tunggu</p>
              <p className="font-headline font-bold text-4xl text-slate-800 mt-1">{data.avg_wait_minutes}</p>
              <p className="text-[11px] text-neutral-gray">menit</p>
            </div>
          </section>

          {/* Grafik beban kerja per dosen */}
          <section>
            <h2 className="font-headline font-bold text-lg text-slate-900 mb-3">Beban Kerja Per Dosen</h2>
            {data.dosen_workload.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
                <span className="material-symbols-outlined text-gray-300 text-4xl block mb-2">bar_chart</span>
                <p className="text-sm text-neutral-gray">Belum ada data sesi bulan ini.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3">
                {data.dosen_workload.map(d => {
                  const pct = Math.round((d.total_sessions / maxSessions) * 100);
                  return (
                    <div key={d.dosen_id}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-slate-800 truncate max-w-[60%]">{d.dosen_name}</p>
                        <p className="text-sm text-neutral-gray flex-shrink-0 ml-2">
                          <span className="font-bold text-slate-800">{d.total_sessions}</span> sesi
                          <span className="ml-2 text-[11px]">·{d.avg_duration} mnt rata-rata</span>
                        </p>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Catatan akreditasi */}
          <section className="bg-primary/5 border border-primary/10 rounded-xl p-4">
            <h3 className="font-bold text-sm text-primary mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">info</span>Catatan Akreditasi
            </h3>
            <p className="text-sm text-slate-600">
              Data di atas mencakup semua sesi bimbingan tugas akhir yang tercatat di sistem untuk {data.month_label}.
              Unduh laporan CSV untuk import ke sistem pelaporan akreditasi.
            </p>
          </section>
        </>)}
      </main>
    </div>
  );
}
