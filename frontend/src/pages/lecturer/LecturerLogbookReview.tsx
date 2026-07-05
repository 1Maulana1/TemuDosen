/**
 * LecturerLogbookReview — S-13 (STT-04). The pipeline's sole safety gate:
 * transcript-expansion gate + always-visible top-sorted groundedness chips,
 * committed only through the S-14 confirmation modal.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  getLogbookDetail, approveLogbook, rejectLogbook,
  type AdvicePoint, type ImprovementNote, type LogbookDetail, type LogbookSummary,
} from '../../api/logbook';
import LogbookStatusBadge from '../../components/LogbookStatusBadge';
import ApproveLogbookModal from '../../components/ApproveLogbookModal';
import RejectLogbookModal from '../../components/RejectLogbookModal';

function fmtDate(iso: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return '-'; }
}

function sortUngroundedFirst<T extends { grounded?: boolean }>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(a.grounded !== false) - Number(b.grounded !== false));
}

function GroundednessChip() {
  return (
    <div
      data-testid="groundedness-chip"
      className="inline-flex flex-col items-start gap-0.5 bg-orange-100 text-orange-700 border border-orange-300 rounded-lg px-2.5 py-1.5 mt-2"
    >
      <span className="flex items-center gap-1.5 text-[11px] font-bold">
        <span className="material-symbols-outlined text-sm" aria-hidden="true">warning</span>
        Perlu Verifikasi
      </span>
      <span className="text-[11px] font-normal">Tidak ditemukan tepat di transkrip. Periksa sebelum menyetujui.</span>
    </div>
  );
}

export default function LecturerLogbookReview() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [logbook, setLogbook] = useState<LogbookDetail | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [hasExpandedOnce, setHasExpandedOnce] = useState(false);
  const [summary, setSummary] = useState<LogbookSummary | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [approving, setApproving] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    getLogbookDetail(Number(sessionId))
      .then((data) => {
        setLogbook(data);
        setSummary(data.summary_edited ?? data.summary_raw);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat.'));
  }, [sessionId]);

  const toggleExpanded = () => {
    setExpanded((v) => !v);
    setHasExpandedOnce(true);
  };

  const ungroundedCount = useMemo(() => {
    if (!summary) return 0;
    return (
      summary.advice_points.filter((i) => i.grounded === false).length +
      summary.improvement_notes.filter((i) => i.grounded === false).length
    );
  }, [summary]);

  const sortedAdvice = useMemo(
    () => (summary ? sortUngroundedFirst<AdvicePoint>(summary.advice_points) : []),
    [summary],
  );
  const sortedImprovement = useMemo(
    () => (summary ? sortUngroundedFirst<ImprovementNote>(summary.improvement_notes) : []),
    [summary],
  );

  const handleApprove = async () => {
    if (!sessionId || !summary || approving) return;
    setApproving(true);
    try {
      await approveLogbook(Number(sessionId), summary);
      navigate('/dosen/logbook');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyetujui logbook.');
      setShowModal(false);
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!sessionId || rejecting) return;
    setRejecting(true);
    try {
      await rejectLogbook(Number(sessionId));
      navigate(`/dosen/logbook/${sessionId}/manual`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menolak logbook.');
      setShowRejectModal(false);
    } finally {
      setRejecting(false);
    }
  };

  if (error && !logbook) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <p className="text-sm text-error font-bold">{error}</p>
      </div>
    );
  }

  if (!logbook || !summary) {
    return <div className="min-h-screen bg-gray-50" />;
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 h-16 max-w-md mx-auto flex items-center justify-between px-4">
        <div>
          <p className="font-headline font-bold text-base text-slate-900">{logbook.student_name}</p>
          <p className="text-[11px] text-neutral-gray">{fmtDate(logbook.session_date)}</p>
        </div>
        <LogbookStatusBadge status={logbook.status} />
      </header>

      <main className="pt-20 pb-28 px-4 max-w-md mx-auto space-y-4">
        {error && <div className="bg-error/10 border border-error/20 rounded-xl p-3 text-sm text-error font-bold">{error}</div>}

        <section className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-headline font-bold text-base text-slate-900">Transkrip Sesi</h2>
            <button type="button" onClick={toggleExpanded} className="text-primary font-bold text-sm flex items-center gap-1">
              {expanded ? 'Sembunyikan Transkrip' : 'Lihat Transkrip Lengkap'}
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                {expanded ? 'expand_less' : 'expand_more'}
              </span>
            </button>
          </div>
          <div
            className={
              expanded
                ? 'max-h-80 overflow-y-auto text-sm font-normal leading-[1.6] text-slate-700 whitespace-pre-wrap'
                : 'text-sm font-normal leading-[1.6] text-slate-700 line-clamp-2'
            }
          >
            {logbook.transcript}
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <h2 className="font-headline font-bold text-lg text-slate-900 mb-3">Saran Dosen</h2>
          {sortedAdvice.length === 0 ? (
            <p className="text-sm text-neutral-gray italic">Tidak ada saran dosen yang tercatat dalam sesi ini.</p>
          ) : (
            <div className="space-y-3">
              {sortedAdvice.map((item, idx) => (
                <div key={idx} data-testid={`advice-item-${idx}`} className="bg-white border border-gray-100 rounded-xl p-4">
                  <p className="font-bold text-sm text-slate-900">{item.topic}</p>
                  <p className="text-sm text-slate-700 mt-1">{item.detail}</p>
                  {item.grounded === false && <GroundednessChip />}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <h2 className="font-headline font-bold text-lg text-slate-900 mb-3">Catatan Perbaikan untuk Mahasiswa</h2>
          {sortedImprovement.length === 0 ? (
            <p className="text-sm text-neutral-gray italic">Tidak ada saran dosen yang tercatat dalam sesi ini.</p>
          ) : (
            <div className="space-y-3">
              {sortedImprovement.map((item, idx) => (
                <div key={idx} data-testid={`improvement-item-${idx}`} className="bg-white border border-gray-100 rounded-xl p-4">
                  <p className="font-bold text-sm text-slate-900">{item.area}</p>
                  <p className="text-sm text-slate-700 mt-1">{item.action}</p>
                  {item.grounded === false && <GroundednessChip />}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 p-4 max-w-md mx-auto space-y-2">
        <button
          type="button"
          onClick={() => setShowRejectModal(true)}
          className="w-full py-2 text-error text-sm font-bold text-center min-h-[44px] focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none rounded-xl"
        >
          Tolak Ringkasan
        </button>
        <button
          type="button"
          disabled={!hasExpandedOnce}
          title={!hasExpandedOnce ? 'Buka transkrip lengkap terlebih dahulu.' : undefined}
          onClick={() => setShowModal(true)}
          className="w-full py-3 rounded-xl bg-primary text-on-primary text-sm font-bold shadow-xl shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          Setujui & Simpan ke Logbook
        </button>
      </div>

      {showModal && (
        <ApproveLogbookModal
          ungroundedCount={ungroundedCount}
          onConfirm={handleApprove}
          onClose={() => setShowModal(false)}
          loading={approving}
        />
      )}

      {showRejectModal && (
        <RejectLogbookModal
          onConfirm={handleReject}
          onClose={() => setShowRejectModal(false)}
          loading={rejecting}
        />
      )}
    </div>
  );
}
