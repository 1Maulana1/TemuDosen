import { useState, useEffect, useCallback } from 'react';
import { useRouteLoaderData } from 'react-router';
import type { User } from '../../api/auth';
import {
  getKetuaJurusanStats, getKetuaJurusanCompliance, getKetuaJurusanExportUrl,
  type KetuaJurusanStats, type KetuaJurusanCompliance, type ReportPeriod, type ComplianceRow,
} from '../../api/stats';

const PERIOD_TABS: { value: ReportPeriod; label: string }[] = [
  { value: 'weekly', label: 'Minggu Ini' },
  { value: 'monthly', label: 'Bulan Ini' },
  { value: 'semester', label: 'Semester Ini' },
];

function complianceBadgeClass(rate: number): string {
  if (rate >= 80) return 'bg-success/10 text-success';
  if (rate >= 50) return 'bg-warning/10 text-warning';
  return 'bg-error/10 text-error';
}

function ComplianceTable({ rows, nameKey }: { rows: ComplianceRow[]; nameKey: 'nama' | 'dosen_name' }) {
  if (rows.length === 0) {
    return <p className="text-sm text-neutral-gray text-center py-6">Belum ada data saran pada periode ini.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100">
            <th className="text-left px-3 py-2 text-[11px] font-bold text-slate-500 uppercase">Nama</th>
            <th className="text-left px-3 py-2 text-[11px] font-bold text-slate-500 uppercase">Total Saran</th>
            <th className="text-left px-3 py-2 text-[11px] font-bold text-slate-500 uppercase">Selesai</th>
            <th className="text-left px-3 py-2 text-[11px] font-bold text-slate-500 uppercase">Kepatuhan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row, i) => (
            <tr key={i}>
              <td className="px-3 py-2 font-bold text-slate-800">
                {row[nameKey]}{row.nim ? <span className="text-neutral-gray font-normal"> · {row.nim}</span> : null}
              </td>
              <td className="px-3 py-2 text-slate-600">{row.total_saran}</td>
              <td className="px-3 py-2 text-slate-600">{row.saran_selesai}</td>
              <td className="px-3 py-2">
                <span className={`inline-block rounded px-2 py-1 text-[11px] font-bold ${complianceBadgeClass(row.compliance_rate)}`}>
                  {row.compliance_rate}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function KetuaJurusanDashboard() {
  const user = useRouteLoaderData('ketua-jurusan') as User;
  const [period, setPeriod] = useState<ReportPeriod>('monthly');
  const [data, setData] = useState<KetuaJurusanStats | null>(null);
  const [compliance, setCompliance] = useState<KetuaJurusanCompliance | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<'csv' | 'pdf' | null>(null);
  const [complianceTab, setComplianceTab] = useState<'mahasiswa' | 'dosen'>('mahasiswa');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      getKetuaJurusanStats(period).catch(() => null),
      getKetuaJurusanCompliance(period).catch(() => null),
    ]).then(([s, c]) => { setData(s); setCompliance(c); }).finally(() => setLoading(false));
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const maxSessions = data ? Math.max(...data.beban_per_dosen.map((d) => d.total_sesi), 1) : 1;

  const handleExport = (format: 'csv' | 'pdf') => {
    setExporting(format);
    window.open(getKetuaJurusanExportUrl(period, format), '_blank');
    setTimeout(() => setExporting(null), 2000);
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 h-16 max-w-2xl mx-auto flex items-center justify-between px-4">
        <span className="font-headline font-bold text-lg text-primary">TemuDosen — Ketua Jurusan</span>
        <span className="text-sm text-neutral-gray">{user?.full_name}</span>
      </header>

      <main className="pt-20 pb-8 px-4 max-w-2xl mx-auto space-y-6">
        {/* Header + period filter + export */}
        <section className="pt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-headline font-bold text-2xl text-slate-900">Laporan Bimbingan</h1>
            <p className="text-sm text-neutral-gray mt-0.5">{data?.period_label ?? '...'}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => handleExport('csv')} disabled={exporting !== null}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-on-primary text-sm font-bold rounded-xl hover:bg-primary-hover disabled:opacity-60 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
              <span className="material-symbols-outlined text-base">download</span>
              {exporting === 'csv' ? 'Mengunduh...' : 'Ekspor CSV'}
            </button>
            <button type="button" onClick={() => handleExport('pdf')} disabled={exporting !== null}
              className="flex items-center gap-2 px-4 py-2.5 border border-primary text-accent-link text-sm font-bold rounded-xl hover:bg-primary/10 disabled:opacity-60 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
              <span className="material-symbols-outlined text-base">picture_as_pdf</span>
              {exporting === 'pdf' ? 'Mengunduh...' : 'Ekspor PDF'}
            </button>
          </div>
        </section>

        {/* Period tabs */}
        <div className="flex gap-1 border-b border-gray-200" role="tablist">
          {PERIOD_TABS.map((tab) => (
            <button key={tab.value} type="button" role="tab" aria-selected={period === tab.value}
              onClick={() => setPeriod(tab.value)}
              className={['px-3 py-2 text-sm transition-colors min-h-[44px]',
                period === tab.value ? 'font-bold text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-slate-700',
              ].join(' ')}>
              {tab.label}
            </button>
          ))}
        </div>

        {loading && <p className="text-center py-16 text-neutral-gray text-sm">Memuat data...</p>}

        {!loading && data && (<>
          {/* Stat cards: FR-KP01/02 */}
          <section className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-[11px] text-neutral-gray">Total Sesi</p>
              <p className="font-headline font-bold text-4xl text-primary mt-1">{data.total_sesi}</p>
              <p className="text-[11px] text-neutral-gray">sesi bimbingan</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-[11px] text-neutral-gray">Rata-rata Tunggu</p>
              <p className="font-headline font-bold text-4xl text-slate-800 mt-1">{data.rata_rata_waktu_tunggu}</p>
              <p className="text-[11px] text-neutral-gray">menit</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-[11px] text-neutral-gray">Selesai</p>
              <p className="font-headline font-bold text-4xl text-success mt-1">{data.sesi_selesai}</p>
              <p className="text-[11px] text-neutral-gray">sesi</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <p className="text-[11px] text-neutral-gray">Dibatalkan</p>
              <p className="font-headline font-bold text-4xl text-error mt-1">{data.sesi_dibatalkan}</p>
              <p className="text-[11px] text-neutral-gray">sesi</p>
            </div>
          </section>

          {/* Beban per dosen */}
          <section>
            <h2 className="font-headline font-bold text-lg text-slate-900 mb-3">Beban Kerja Per Dosen</h2>
            {data.beban_per_dosen.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
                <span className="material-symbols-outlined text-gray-300 text-4xl block mb-2">bar_chart</span>
                <p className="text-sm text-neutral-gray">Belum ada data sesi pada periode ini.</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3">
                {data.beban_per_dosen.map((d) => {
                  const pct = Math.round((d.total_sesi / maxSessions) * 100);
                  const quotaPct = d.kuota_harian_menit > 0
                    ? Math.min(100, Math.round((d.total_durasi_menit / d.kuota_harian_menit) * 100))
                    : 0;
                  return (
                    <div key={d.dosen_id}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-slate-800 truncate max-w-[60%]">{d.dosen_name}</p>
                        <p className="text-sm text-neutral-gray flex-shrink-0 ml-2">
                          <span className="font-bold text-slate-800">{d.total_sesi}</span> sesi
                          <span className="ml-2 text-[11px]">·{d.rata_rata_durasi} mnt rata-rata</span>
                        </p>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-neutral-gray">Beban vs kuota harian</span>
                        <span className="text-[10px] text-neutral-gray">{d.total_durasi_menit}/{d.kuota_harian_menit} mnt</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-0.5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${quotaPct >= 90 ? 'bg-error' : quotaPct >= 60 ? 'bg-warning' : 'bg-success'}`}
                          style={{ width: `${quotaPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* FR-KP04: Kepatuhan tindak lanjut saran */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-headline font-bold text-lg text-slate-900">Tingkat Kepatuhan Saran</h2>
              {compliance && (
                <span className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${complianceBadgeClass(compliance.compliance_rate)}`}>
                  {compliance.compliance_rate}%
                </span>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="flex gap-1 border-b border-gray-100 px-2 pt-2" role="tablist">
                <button type="button" role="tab" aria-selected={complianceTab === 'mahasiswa'}
                  onClick={() => setComplianceTab('mahasiswa')}
                  className={['px-3 py-2 text-sm min-h-[44px]', complianceTab === 'mahasiswa' ? 'font-bold text-primary border-b-2 border-primary' : 'text-gray-500'].join(' ')}>
                  Per Mahasiswa
                </button>
                <button type="button" role="tab" aria-selected={complianceTab === 'dosen'}
                  onClick={() => setComplianceTab('dosen')}
                  className={['px-3 py-2 text-sm min-h-[44px]', complianceTab === 'dosen' ? 'font-bold text-primary border-b-2 border-primary' : 'text-gray-500'].join(' ')}>
                  Per Dosen
                </button>
              </div>
              <div className="p-2">
                {complianceTab === 'mahasiswa' ? (
                  <ComplianceTable rows={compliance?.per_mahasiswa ?? []} nameKey="nama" />
                ) : (
                  <ComplianceTable rows={compliance?.per_dosen ?? []} nameKey="dosen_name" />
                )}
              </div>
            </div>
          </section>

          {/* Catatan akreditasi */}
          <section className="bg-primary/5 border border-primary/10 rounded-xl p-4">
            <h3 className="font-bold text-sm text-primary mb-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">info</span>Catatan Akreditasi
            </h3>
            <p className="text-sm text-slate-600">
              Data di atas mencakup semua sesi bimbingan tugas akhir yang tercatat di sistem untuk {data.period_label}.
              Unduh laporan CSV/PDF untuk import ke sistem pelaporan akreditasi.
            </p>
          </section>
        </>)}
      </main>
    </div>
  );
}
