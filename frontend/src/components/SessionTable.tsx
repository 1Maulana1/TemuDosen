/**
 * SessionTable — riwayat sesi bimbingan (No/Tanggal/Topik/Dosen/Status/Aksi).
 *
 * "Aksi": (1) pratinjau berkas draft (via file_uuid), dan (2) — untuk baris yang
 * sesinya sudah dibuat — buka detail sesi/logbook (via sessionId, audit #1).
 */
import StatusBadge from './StatusBadge';

type BadgeStatus = 'MENUNGGU' | 'DISETUJUI' | 'BERLANGSUNG' | 'SELESAI' | 'DIBATALKAN' | 'REVISI' | 'DITOLAK';

export interface SessionTableRow {
  id: number;
  date: string;
  topic: string;
  dosen: string;
  status: BadgeStatus;
  fileUuid: string | null;
  fileName: string | null;
  // Linkage to the approved session + logbook (audit #1)
  sessionId: number | null;
  logbookStatus: string | null;
}

interface SessionTableProps {
  rows: SessionTableRow[];
  onView: (row: SessionTableRow) => void;
  /** Open the session/logbook detail. Only invoked for rows that have a sessionId. */
  onOpenSession?: (row: SessionTableRow) => void;
  fmtDate: (iso: string) => string;
}

export default function SessionTable({ rows, onView, onOpenSession, fmtDate }: SessionTableProps) {
  if (rows.length === 0) {
    return (
      <div className="py-10 flex flex-col items-center text-center">
        <span className="material-symbols-outlined text-gray-300 text-4xl mb-3" aria-hidden="true">history</span>
        <h3 className="font-bold text-slate-800">Belum Ada Riwayat Sesi</h3>
        <p className="text-sm text-on-surface-variant mt-1 max-w-xs">
          Riwayat sesi bimbingan Anda akan muncul di sini setelah pengajuan pertama.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-on-surface-variant uppercase tracking-wider border-b border-gray-200">
            <th className="px-2 py-2 font-bold">No</th>
            <th className="px-2 py-2 font-bold">Tanggal</th>
            <th className="px-2 py-2 font-bold">Topik</th>
            <th className="px-2 py-2 font-bold">Dosen</th>
            <th className="px-2 py-2 font-bold">Status</th>
            <th className="px-2 py-2 font-bold text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id} className="border-b border-gray-100 last:border-0">
              <td className="px-2 py-3 text-on-surface-variant">{idx + 1}</td>
              <td className="px-2 py-3 text-slate-700 whitespace-nowrap">{fmtDate(row.date)}</td>
              <td className="px-2 py-3 text-slate-800 font-bold max-w-[220px] truncate">{row.topic}</td>
              <td className="px-2 py-3 text-slate-700">{row.dosen}</td>
              <td className="px-2 py-3"><StatusBadge status={row.status} /></td>
              <td className="px-2 py-3 text-right">
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onView(row)}
                    disabled={!row.fileUuid}
                    aria-label={`Lihat berkas draft ${row.topic}`}
                    title={row.fileUuid ? 'Lihat berkas draft' : 'Tidak ada berkas untuk sesi ini'}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-on-surface-variant
                               hover:bg-primary/10 hover:text-accent-link transition-colors
                               disabled:opacity-30 disabled:cursor-not-allowed
                               focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  >
                    <span className="material-symbols-outlined text-xl" aria-hidden="true">visibility</span>
                  </button>
                  {row.sessionId && onOpenSession && (
                    <button
                      type="button"
                      onClick={() => onOpenSession(row)}
                      aria-label={`Buka sesi & logbook ${row.topic}`}
                      title={row.logbookStatus === 'approved' ? 'Lihat logbook' : 'Lihat detail sesi'}
                      className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-on-surface-variant
                                 hover:bg-primary/10 hover:text-accent-link transition-colors
                                 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                    >
                      <span className="material-symbols-outlined text-xl" aria-hidden="true">menu_book</span>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
