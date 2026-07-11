/**
 * SummaryContent — render ringkasan hasil bimbingan dari SessionLogbook.
 *
 * Dua bentuk data (lihat api/sessions.ts SessionSummaryContent):
 *  - Jalur manual (STT-07): { manual_notes } → teks polos apa adanya.
 *  - Hasil AI (schemas.SessionSummary): advice_points + improvement_notes →
 *    dua seksi kartu terstruktur ("Saran Dosen" / "Area Perbaikan").
 * Dipakai read-only oleh LecturerSessionDetail (setelah approve) dan
 * StudentSessionDetail.
 */
import type { SessionSummaryContent } from '../api/sessions';

/** Chip peringatan: kata kunci item tidak ditemukan verbatim di transkrip (cek groundedness backend). */
function GroundednessChip() {
  return (
    <p className="flex items-center gap-1 text-[11px] font-bold text-warning mt-1.5">
      <span className="material-symbols-outlined text-sm" aria-hidden="true">warning</span>
      Perlu Verifikasi — tidak ditemukan tepat di transkrip
    </p>
  );
}

/**
 * @param showGroundedness Tampilkan chip "Perlu Verifikasi" untuk item yang `grounded === false`.
 *   Hanya untuk tampilan dosen (draf sebelum approve) — jangan aktifkan di tampilan mahasiswa.
 */
export default function SummaryContent({
  content,
  showGroundedness = false,
}: {
  content: SessionSummaryContent | null | undefined;
  showGroundedness?: boolean;
}) {
  if (!content) return <p className="text-sm text-on-surface-variant">—</p>;

  const advice = content.advice_points ?? [];
  const improvements = content.improvement_notes ?? [];

  // Jalur manual murni: satu blok teks bebas.
  if (content.manual_notes && advice.length === 0 && improvements.length === 0) {
    return <p className="text-sm text-slate-700 whitespace-pre-wrap">{content.manual_notes}</p>;
  }

  if (advice.length === 0 && improvements.length === 0) {
    return <p className="text-sm text-on-surface-variant">—</p>;
  }

  return (
    <div className="space-y-4">
      {advice.length > 0 && (
        <section>
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase tracking-wide mb-2">
            <span className="material-symbols-outlined text-base" aria-hidden="true">lightbulb</span>
            Saran Dosen
          </h3>
          <ul className="space-y-2">
            {advice.map((a, i) => (
              <li key={i} className="bg-primary/5 border border-primary/10 rounded-xl p-3">
                <p className="text-xs font-bold text-slate-900 mb-0.5">{a.topic}</p>
                <p className="text-sm text-slate-700">{a.detail}</p>
                {showGroundedness && a.grounded === false && <GroundednessChip />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {improvements.length > 0 && (
        <section>
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-warning uppercase tracking-wide mb-2">
            <span className="material-symbols-outlined text-base" aria-hidden="true">build</span>
            Area Perbaikan
          </h3>
          <ul className="space-y-2">
            {improvements.map((n, i) => (
              <li key={i} className="bg-warning/5 border border-warning/10 rounded-xl p-3">
                <p className="text-xs font-bold text-slate-900 mb-0.5">{n.area}</p>
                <p className="text-sm text-slate-700">{n.action}</p>
                {showGroundedness && n.grounded === false && <GroundednessChip />}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Ringkasan manual dosen — pelengkap draf AI (diisi saat approve bila
          hasil AI kurang memuaskan); tampil untuk dosen maupun mahasiswa. */}
      {content.manual_notes && (
        <section>
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
            <span className="material-symbols-outlined text-base" aria-hidden="true">edit_note</span>
            Catatan Dosen
          </h3>
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{content.manual_notes}</p>
          </div>
        </section>
      )}
    </div>
  );
}
