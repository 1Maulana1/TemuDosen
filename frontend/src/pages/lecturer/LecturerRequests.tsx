/**
 * LecturerRequests — /dosen/requests
 * Phase 2 (FR-D01, FR-D04):
 *  - Tabel submission dengan tombol Setujui + Tolak/Revisi
 *  - Modal Setujui: pilih metode + meeting link
 *  - Modal Tolak/Revisi: isi alasan
 *  - Auto-refresh setiap 30 detik
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouteLoaderData } from 'react-router';
import StatusBadge from '../../components/StatusBadge';
import PDFPreview from '../../components/PDFPreview';
import { fetchLecturerSubmissions, type LecturerSubmissionItem } from '../../api/submissions';
import { approveSubmission, rejectSubmission } from '../../api/sessions';
import type { User } from '../../api/auth';

// ── Status map ────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, 'MENUNGGU' | 'DISETUJUI' | 'DIBATALKAN' | 'REVISI' | 'BERLANGSUNG' | 'SELESAI' | 'DITOLAK'> = {
  pending: 'MENUNGGU',
  approved: 'DISETUJUI',
  rejected: 'DITOLAK',
  revision: 'REVISI',
  cancelled: 'DIBATALKAN',
};

const MEETING_LINK_PATTERN = /^https?:\/\/.+/i;

// ── Helper: initials ──────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return iso; }
}

// ── Approve Modal ─────────────────────────────────────────────────────────────

interface ApproveModalProps {
  submissionId: number;
  studentName: string;
  onClose: () => void;
  onSuccess: () => void;
}

function ApproveModal({ submissionId, studentName, onClose, onSuccess }: ApproveModalProps) {
  const [method, setMethod] = useState<'offline' | 'online'>('offline');
  const [meetingLink, setMeetingLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (method === 'online') {
      const trimmed = meetingLink.trim();
      if (!trimmed) {
        setError('Link meeting wajib diisi untuk metode Online.');
        return;
      }
      if (!MEETING_LINK_PATTERN.test(trimmed)) {
        setError('Link meeting harus diawali dengan http:// atau https://');
        return;
      }
    }
    setLoading(true);
    try {
      await approveSubmission(submissionId, {
        method,
        meeting_link: method === 'online' ? meetingLink.trim() : null,
      });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyetujui submission.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true" aria-label="Setujui Bimbingan">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 shadow-xl">
        <h2 className="font-headline font-bold text-lg text-slate-900 mb-1">Setujui Bimbingan</h2>
        <p className="text-sm text-neutral-gray mb-5">Mahasiswa: <span className="font-bold text-slate-800">{studentName}</span></p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Metode */}
          <div>
            <p className="text-sm font-bold text-slate-700 mb-2">Metode Bimbingan</p>
            <div className="flex gap-3">
              {(['offline', 'online'] as const).map((m) => (
                <label key={m} className={[
                  'flex-1 flex items-center justify-center gap-2 rounded-xl border-2 py-3 cursor-pointer text-sm font-bold transition-all',
                  method === m ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 text-slate-600 hover:border-gray-300',
                ].join(' ')}>
                  <input type="radio" name="method" value={m} checked={method === m} onChange={() => setMethod(m)} className="sr-only" />
                  <span className="material-symbols-outlined text-base">{m === 'offline' ? 'person' : 'videocam'}</span>
                  {m === 'offline' ? 'Tatap Muka' : 'Online'}
                </label>
              ))}
            </div>
          </div>

          {/* Meeting link (only for online) */}
          {method === 'online' && (
            <div>
              <label htmlFor="meeting-link" className="text-sm font-bold text-slate-700 block mb-1">Link Meeting <span className="text-error">*</span></label>
              <input
                id="meeting-link"
                type="url"
                value={meetingLink}
                onChange={(e) => setMeetingLink(e.target.value)}
                placeholder="https://meet.google.com/xxx"
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary min-h-[44px]"
              />
            </div>
          )}

          {error && <p className="text-error text-sm">{error}</p>}

          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-slate-600 hover:bg-gray-50 min-h-[44px]">
              Batal
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary-hover disabled:opacity-60 min-h-[44px]">
              {loading ? 'Menyimpan...' : 'Setujui'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Reject/Revisi Modal ───────────────────────────────────────────────────────

interface RejectModalProps {
  submissionId: number;
  studentName: string;
  onClose: () => void;
  onSuccess: () => void;
}

function RejectModal({ submissionId, studentName, onClose, onSuccess }: RejectModalProps) {
  const [action, setAction] = useState<'REJECTED' | 'REVISION'>('REVISION');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (reason.trim().length < 10) {
      setError('Alasan minimal 10 karakter.');
      return;
    }
    setLoading(true);
    try {
      await rejectSubmission(submissionId, { action, reason: reason.trim() });
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses submission.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true" aria-label="Tolak atau Minta Revisi">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 shadow-xl">
        <h2 className="font-headline font-bold text-lg text-slate-900 mb-1">Tolak / Minta Revisi</h2>
        <p className="text-sm text-neutral-gray mb-5">Mahasiswa: <span className="font-bold text-slate-800">{studentName}</span></p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Action */}
          <div>
            <p className="text-sm font-bold text-slate-700 mb-2">Tindakan</p>
            <div className="flex gap-3">
              <label className={[
                'flex-1 flex items-center justify-center gap-2 rounded-xl border-2 py-3 cursor-pointer text-sm font-bold transition-all',
                action === 'REVISION' ? 'border-orange-400 bg-orange-50 text-orange-700' : 'border-gray-200 text-slate-600 hover:border-gray-300',
              ].join(' ')}>
                <input type="radio" name="action" value="REVISION" checked={action === 'REVISION'} onChange={() => setAction('REVISION')} className="sr-only" />
                <span className="material-symbols-outlined text-base">edit</span>
                Minta Revisi
              </label>
              <label className={[
                'flex-1 flex items-center justify-center gap-2 rounded-xl border-2 py-3 cursor-pointer text-sm font-bold transition-all',
                action === 'REJECTED' ? 'border-error bg-error/5 text-error' : 'border-gray-200 text-slate-600 hover:border-gray-300',
              ].join(' ')}>
                <input type="radio" name="action" value="REJECTED" checked={action === 'REJECTED'} onChange={() => setAction('REJECTED')} className="sr-only" />
                <span className="material-symbols-outlined text-base">cancel</span>
                Tolak
              </label>
            </div>
          </div>

          {/* Alasan */}
          <div>
            <label htmlFor="reject-reason" className="text-sm font-bold text-slate-700 block mb-1">
              Alasan <span className="text-error">*</span>
              <span className="font-normal text-neutral-gray ml-1">(min. 10 karakter)</span>
            </label>
            <textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Tuliskan alasan penolakan atau catatan revisi..."
              className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
            />
            <p className="text-[11px] text-neutral-gray mt-1">{reason.length} karakter</p>
          </div>

          {error && <p className="text-error text-sm">{error}</p>}

          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} disabled={loading}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-slate-600 hover:bg-gray-50 min-h-[44px]">
              Batal
            </button>
            <button type="submit" disabled={loading}
              className={[
                'flex-1 py-3 rounded-xl text-white text-sm font-bold disabled:opacity-60 min-h-[44px]',
                action === 'REJECTED' ? 'bg-error hover:bg-red-700' : 'bg-orange-500 hover:bg-orange-600',
              ].join(' ')}>
              {loading ? 'Menyimpan...' : action === 'REJECTED' ? 'Tolak' : 'Minta Revisi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Submission Card ───────────────────────────────────────────────────────────

interface SubmissionCardProps {
  item: LecturerSubmissionItem;
  onPreview: (uuid: string, filename: string) => void;
  onApprove: (id: number, name: string) => void;
  onReject: (id: number, name: string) => void;
}

function SubmissionCard({ item, onPreview, onApprove, onReject }: SubmissionCardProps) {
  const badgeStatus = STATUS_MAP[item.status] ?? 'MENUNGGU';
  const fileUuid = item.file_url ? item.file_url.replace('/api/files/', '').replace(/\/$/, '') : null;
  const isPending = item.status === 'pending';

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col gap-3">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 min-w-[40px] rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm flex-shrink-0" aria-hidden="true">
            {getInitials(item.student_name)}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-sm text-slate-900 truncate">{item.student_name}</h4>
            <p className="text-[11px] text-neutral-gray">{item.student_nim}</p>
          </div>
        </div>
        <StatusBadge status={badgeStatus} />
      </div>

      {/* Symptoms */}
      {item.symptom_names.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {item.symptom_names.map((name) => (
            <span key={name} className="inline-block rounded-full bg-gray-100 text-slate-600 text-[11px] px-2 py-0.5">{name}</span>
          ))}
        </div>
      )}

      {/* Date */}
      <div className="flex items-center gap-1 text-[11px] text-neutral-gray">
        <span className="material-symbols-outlined text-base" aria-hidden="true">calendar_today</span>
        <span>{formatDate(item.created_at)}</span>
      </div>

      {/* File + action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {item.original_filename && fileUuid && (
          <button type="button" onClick={() => onPreview(fileUuid, item.original_filename ?? 'draft.pdf')}
            className="flex items-center gap-1.5 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-2 py-1.5 text-[11px] text-neutral-gray hover:bg-gray-100 min-h-[36px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
            <span className="material-symbols-outlined text-base" aria-hidden="true">description</span>
            <span className="truncate max-w-[120px]">{item.original_filename}</span>
          </button>
        )}

        {isPending && (
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={() => onReject(item.id, item.student_name)}
              className="px-3 py-2 border border-gray-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-gray-50 min-h-[44px] flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              aria-label={`Tolak/Revisi submission dari ${item.student_name}`}>
              <span className="material-symbols-outlined text-base" aria-hidden="true">close</span>
              Tolak/Revisi
            </button>
            <button type="button" onClick={() => onApprove(item.id, item.student_name)}
              className="px-3 py-2 bg-primary text-on-primary text-xs font-bold rounded-lg hover:bg-primary-hover min-h-[44px] flex items-center gap-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              aria-label={`Setujui submission dari ${item.student_name}`}>
              <span className="material-symbols-outlined text-base" aria-hidden="true">check_circle</span>
              Setujui
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'pending' | 'approved' | 'revision';
const FILTER_TABS = [
  { value: 'all' as FilterTab, label: 'Semua' },
  { value: 'pending' as FilterTab, label: 'Menunggu' },
  { value: 'approved' as FilterTab, label: 'Disetujui' },
  { value: 'revision' as FilterTab, label: 'Revisi' },
];

export default function LecturerRequests() {
  const user = useRouteLoaderData('dosen') as User;
  const [submissions, setSubmissions] = useState<LecturerSubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('pending');
  const [search, setSearch] = useState('');

  // Modal state
  const [approveTarget, setApproveTarget] = useState<{ id: number; name: string } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number; name: string } | null>(null);
  const [previewUuid, setPreviewUuid] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState('');

  // Auto-refresh ref
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (activeTab !== 'all') params.status = activeTab;
      if (search.trim()) params.search = search.trim();
      const data = await fetchLecturerSubmissions(params);
      setSubmissions(data);
    } catch {
      setError('Gagal memuat data. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  // Debounced load
  useEffect(() => {
    const t = setTimeout(() => loadSubmissions(), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadSubmissions, search]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    refreshRef.current = setInterval(() => loadSubmissions(), 30_000);
    return () => { if (refreshRef.current) clearInterval(refreshRef.current); };
  }, [loadSubmissions]);

  const handleApproveSuccess = () => {
    setApproveTarget(null);
    loadSubmissions();
  };
  const handleRejectSuccess = () => {
    setRejectTarget(null);
    loadSubmissions();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="fixed top-0 w-full z-50 bg-white border-b border-gray-200 shadow-sm max-w-md mx-auto left-0 right-0">
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm" aria-hidden="true">
              {getInitials(user?.full_name ?? 'D')}
            </div>
            <span className="font-headline font-bold text-lg text-primary">Permintaan Masuk</span>
          </div>
        </div>
      </nav>

      <main className="pt-16 pb-32 px-4 max-w-md mx-auto space-y-4">
        {/* Search */}
        <div className="relative pt-4">
          <span className="absolute left-3 top-1/2 mt-2 -translate-y-1/2 material-symbols-outlined text-neutral-gray text-lg" aria-hidden="true">search</span>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari NIM atau nama..."
            className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none placeholder:text-neutral-gray min-h-[44px]"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 border-b border-gray-200" role="tablist">
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button key={tab.value} type="button" role="tab" aria-selected={isActive}
                onClick={() => setActiveTab(tab.value)}
                className={['px-3 py-2 text-sm font-normal transition-colors min-h-[44px]',
                  'focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded-t',
                  isActive ? 'font-bold text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-slate-700',
                ].join(' ')}>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {loading && (
          <div className="text-center py-10 text-neutral-gray text-sm" aria-live="polite" aria-busy="true">
            <span className="material-symbols-outlined animate-spin text-3xl block mb-2">progress_activity</span>
            Memuat data...
          </div>
        )}
        {!loading && error && (
          <div className="bg-error/5 border border-error/20 rounded-xl p-4 text-center" aria-live="assertive">
            <p className="text-sm text-error">{error}</p>
            <button type="button" onClick={loadSubmissions} className="mt-2 text-sm text-primary font-bold underline">Coba Lagi</button>
          </div>
        )}
        {!loading && !error && submissions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="material-symbols-outlined text-gray-300 text-5xl mb-4" aria-hidden="true">inbox</span>
            <h3 className="font-headline font-bold text-lg text-slate-900 mb-2">Belum Ada Permintaan</h3>
            <p className="text-sm text-neutral-gray max-w-xs">Tidak ada submission dengan filter yang dipilih.</p>
          </div>
        )}
        {!loading && !error && submissions.length > 0 && (
          <div className="flex flex-col gap-4" role="list">
            {submissions.map((item) => (
              <div key={item.id} role="listitem">
                <SubmissionCard item={item} onPreview={(u, f) => { setPreviewUuid(u); setPreviewFilename(f); }}
                  onApprove={(id, name) => setApproveTarget({ id, name })}
                  onReject={(id, name) => setRejectTarget({ id, name })} />
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 w-full max-w-md mx-auto right-0 z-50 flex justify-around items-center px-2 py-3 bg-white border-t border-gray-200 rounded-t-xl">
        <a href="/dosen" className="flex flex-col items-center text-gray-400 gap-0.5 min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded px-2">
          <span className="material-symbols-outlined">home</span>
          <span className="text-[11px]">Beranda</span>
        </a>
        <button type="button" aria-current="page" className="flex flex-col items-center text-primary gap-0.5 min-h-[44px] min-w-[44px]">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>inbox</span>
          <span className="text-[11px] font-bold">Permintaan</span>
        </button>
        <a href="/dosen/queue" className="flex flex-col items-center text-gray-400 gap-0.5 min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded px-2">
          <span className="material-symbols-outlined">format_list_numbered</span>
          <span className="text-[11px]">Antrian</span>
        </a>
      </nav>

      {/* Modals */}
      {approveTarget && (
        <ApproveModal submissionId={approveTarget.id} studentName={approveTarget.name}
          onClose={() => setApproveTarget(null)} onSuccess={handleApproveSuccess} />
      )}
      {rejectTarget && (
        <RejectModal submissionId={rejectTarget.id} studentName={rejectTarget.name}
          onClose={() => setRejectTarget(null)} onSuccess={handleRejectSuccess} />
      )}
      {previewUuid && (
        <PDFPreview fileUuid={previewUuid} fileName={previewFilename} onClose={() => setPreviewUuid(null)} />
      )}
    </div>
  );
}
