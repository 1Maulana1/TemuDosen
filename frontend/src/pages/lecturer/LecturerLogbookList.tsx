/**
 * LecturerLogbookList — S-12 (inferred entry point for STT-04/05/06).
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getLecturerLogbooks, type LogbookListItem } from '../../api/logbook';
import LogbookStatusBadge from '../../components/LogbookStatusBadge';

function fmtDate(iso: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return '-'; }
}

function RowAction({ item }: { item: LogbookListItem }) {
  if (item.status === 'ready_for_review') {
    return (
      <Link to={`/dosen/logbook/${item.session_id}`} className="text-primary font-bold text-sm">
        Tinjau Sekarang
      </Link>
    );
  }
  if (item.status === 'approved') {
    return (
      <Link to={`/dosen/logbook/${item.session_id}`} className="text-primary font-bold text-sm">
        Lihat
      </Link>
    );
  }
  if (item.status === 'failed') {
    return (
      <Link to={`/dosen/logbook/${item.session_id}/manual`} className="text-error font-bold text-sm">
        Tulis Catatan Manual
      </Link>
    );
  }
  return null;
}

export default function LecturerLogbookList() {
  const [logbooks, setLogbooks] = useState<LogbookListItem[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getLecturerLogbooks()
      .then(setLogbooks)
      .catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat.'));
  }, []);

  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 h-16 max-w-md mx-auto flex items-center px-4">
        <span className="font-headline font-bold text-lg text-primary">Logbook</span>
      </header>

      <main className="pt-20 pb-8 px-4 max-w-md mx-auto space-y-3">
        {error && <div className="bg-error/10 border border-error/20 rounded-xl p-3 text-sm text-error font-bold">{error}</div>}

        {logbooks && logbooks.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
            <span className="material-symbols-outlined text-gray-300 text-4xl block mb-2" aria-hidden="true">menu_book</span>
            <h3 className="font-bold text-slate-800">Belum Ada Logbook</h3>
            <p className="text-sm text-neutral-gray mt-1">
              Logbook otomatis akan muncul di sini setelah sesi bimbingan pertama Anda selesai dan diproses.
            </p>
          </div>
        )}

        {logbooks?.map((item) => (
          <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-sm text-slate-900 truncate">{item.student_name}</p>
                <p className="text-[11px] text-neutral-gray">{item.student_nim} · {fmtDate(item.session_date)}</p>
                <div className="mt-1.5">
                  <LogbookStatusBadge status={item.status} />
                </div>
              </div>
              <div className="flex-shrink-0">
                <RowAction item={item} />
              </div>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
