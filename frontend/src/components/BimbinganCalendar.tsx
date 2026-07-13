/**
 * BimbinganCalendar — grid kalender bulanan jadwal bimbingan dosen.
 *
 * Menampilkan sesi (selain dibatalkan) per hari dalam grid Sen–Min,
 * dengan navigasi bulan sebelumnya/berikutnya. Data dari
 * GET /api/queue/lecturer/calendar/?month=YYYY-MM.
 */
import { useState, useEffect } from 'react';
import { getLecturerCalendar, type CalendarSession } from '../api/sessions';

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];
const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const STATUS_CHIP: Record<CalendarSession['status'], string> = {
  waiting: 'bg-status-pending-bg text-status-pending-text',
  in_progress: 'bg-status-ongoing-bg text-status-ongoing-text',
  done: 'bg-status-done-bg text-status-done-text',
};

function monthKey(year: number, month: number) {
  return `${year.toString().padStart(4, '0')}-${(month + 1).toString().padStart(2, '0')}`;
}

export default function BimbinganCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [sessions, setSessions] = useState<CalendarSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getLecturerCalendar(monthKey(year, month))
      .then((s) => { if (!cancelled) setSessions(s); })
      .catch(() => { if (!cancelled) setSessions([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [year, month]);

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  // Kelompokkan sesi per tanggal (waktu lokal browser).
  const byDate = new Map<number, CalendarSession[]>();
  for (const s of sessions) {
    const d = new Date(s.scheduled_at);
    if (d.getFullYear() !== year || d.getMonth() !== month) continue;
    const day = d.getDate();
    byDate.set(day, [...(byDate.get(day) ?? []), s]);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // getDay(): 0=Min … 6=Sab → offset kolom untuk minggu yang mulai Senin.
  const leadingBlanks = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array<null>(leadingBlanks).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const isToday = (day: number) =>
    day === now.getDate() && month === now.getMonth() && year === now.getFullYear();

  return (
    <div className="bg-surface rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-5">
      {/* Header: bulan + navigasi */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-headline font-bold text-base text-slate-900">
          {MONTHS[month]} {year}
        </h3>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => shift(-1)} aria-label="Bulan sebelumnya"
            className="w-9 h-9 rounded-lg border border-gray-200 text-slate-600 hover:bg-gray-50 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
            <span className="material-symbols-outlined text-base" aria-hidden="true">chevron_left</span>
          </button>
          <button type="button"
            onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth()); }}
            className="px-3 h-9 rounded-lg border border-gray-200 text-xs font-bold text-slate-600 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
            Hari ini
          </button>
          <button type="button" onClick={() => shift(1)} aria-label="Bulan berikutnya"
            className="w-9 h-9 rounded-lg border border-gray-200 text-slate-600 hover:bg-gray-50 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
            <span className="material-symbols-outlined text-base" aria-hidden="true">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-px bg-gray-100 rounded-xl overflow-hidden border border-gray-100"
        role="grid" aria-label={`Kalender bimbingan ${MONTHS[month]} ${year}`} aria-busy={loading}>
        {DAYS.map((d) => (
          <div key={d} className="bg-gray-50 py-2 text-center text-[11px] font-bold text-on-surface-variant uppercase">
            {d}
          </div>
        ))}
        {cells.map((day, i) =>
          day === null ? (
            <div key={`blank-${i}`} className="bg-surface min-h-[72px]" aria-hidden="true" />
          ) : (
            <div key={day}
              className={`bg-surface min-h-[72px] p-1.5 space-y-1 ${isToday(day) ? 'ring-2 ring-inset ring-primary/60' : ''}`}>
              <p className={`text-[11px] font-bold ${isToday(day) ? 'text-primary-hover' : 'text-slate-500'}`}>
                {day}
              </p>
              {(byDate.get(day) ?? []).map((s) => {
                const t = new Date(s.scheduled_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                return (
                  <p key={s.id}
                    title={`${t} — ${s.mahasiswa_name}${s.nim ? ` (${s.nim})` : ''}`}
                    className={`text-[10px] leading-tight font-bold rounded px-1 py-0.5 truncate ${STATUS_CHIP[s.status] ?? STATUS_CHIP.waiting}`}>
                    {t} {s.mahasiswa_name}
                  </p>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-on-surface-variant">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-status-pending-bg border border-status-pending-text/30" aria-hidden="true" /> Menunggu</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-status-ongoing-bg border border-status-ongoing-text/30" aria-hidden="true" /> Berlangsung</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-status-done-bg border border-status-done-text/30" aria-hidden="true" /> Selesai</span>
      </div>
    </div>
  );
}
