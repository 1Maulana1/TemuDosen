/**
 * StudentLogbookView — S-15 (STT-06). Read-only: no edit affordances, no
 * groundedness chips (review-time signal only, per UI-SPEC).
 */
import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { getStudentLogbook, type LogbookDetail } from '../../api/logbook';

function fmtDate(iso: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return '-'; }
}

export default function StudentLogbookView() {
  const { sessionId } = useParams();
  const [logbook, setLogbook] = useState<LogbookDetail | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    getStudentLogbook(Number(sessionId))
      .then(setLogbook)
      .catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat.'));
  }, [sessionId]);

  if (error) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <p className="text-sm text-error font-bold">{error}</p>
      </div>
    );
  }

  if (!logbook) {
    return <div className="min-h-screen bg-surface" />;
  }

  const summary = logbook.summary_edited ?? logbook.summary_raw;

  return (
    <div className="min-h-screen bg-surface pb-10">
      <header className="bg-surface border-b border-gray-200 px-4 py-4">
        <h1 className="font-headline font-bold text-lg text-on-surface">Ringkasan Bimbingan</h1>
        <p className="text-sm text-on-surface-variant mt-0.5">
          {fmtDate(logbook.session_date)} · {logbook.student_name}
        </p>
      </header>

      <main className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        <section className="bg-surface rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-headline font-bold text-base text-on-surface">Transkrip Sesi</h2>
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-primary font-bold text-sm flex items-center gap-1"
            >
              {expanded ? 'Sembunyikan Transkrip' : 'Lihat Transkrip Lengkap'}
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                {expanded ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          </div>
          <div
            className={
              expanded
                ? 'max-h-80 overflow-y-auto text-sm leading-[1.6] text-on-surface-variant whitespace-pre-wrap'
                : 'text-sm leading-[1.6] text-on-surface-variant line-clamp-2'
            }
          >
            {logbook.transcript}
          </div>
        </section>

        <section className="bg-surface rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="font-headline font-bold text-lg text-on-surface mb-3">Saran Dosen</h2>
          {summary.advice_points.length === 0 ? (
            <p className="text-sm text-neutral-gray italic">Tidak ada saran dosen yang tercatat dalam sesi ini.</p>
          ) : (
            <div className="space-y-3">
              {summary.advice_points.map((item, idx) => (
                <div key={idx} className="bg-white border border-gray-100 rounded-xl p-4">
                  <p className="font-bold text-sm text-on-surface">{item.topic}</p>
                  <p className="text-sm text-on-surface-variant mt-1">{item.detail}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-surface rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="font-headline font-bold text-lg text-on-surface mb-3">Catatan Perbaikan untuk Mahasiswa</h2>
          {summary.improvement_notes.length === 0 ? (
            <p className="text-sm text-neutral-gray italic">Tidak ada saran dosen yang tercatat dalam sesi ini.</p>
          ) : (
            <div className="space-y-3">
              {summary.improvement_notes.map((item, idx) => (
                <div key={idx} className="bg-white border border-gray-100 rounded-xl p-4">
                  <p className="font-bold text-sm text-on-surface">{item.area}</p>
                  <p className="text-sm text-on-surface-variant mt-1">{item.action}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
