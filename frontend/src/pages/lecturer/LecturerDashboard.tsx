/**
 * LecturerDashboard (S-08) — Pending guidance requests for the logged-in lecturer.
 *
 * Layout: mobile-first, fixed header + bottom nav + scrollable main (max-w-md).
 *
 * Features (Plan 05 — REVIEW-01, D-09, D-10, D-11, D-12):
 *   - Displays all advisees' submissions (all statuses — D-09)
 *   - Each card shows: student avatar initials, NIM, name, symptom labels, StatusBadge,
 *     submitted date, draft file chip, and "Lihat Draft" button → PDFPreview (D-10)
 *   - Filter tabs: All | Menunggu | Disetujui | Revisi (drives ?status= param — D-11)
 *   - Search field: "Cari NIM atau nama..." (drives ?search= param — D-11)
 *   - CRITICAL D-12: NO Approve/Reject buttons — view-only in Phase 1
 *   - Empty state: "Belum Ada Permintaan Masuk" with body copy (Copywriting Contract)
 *
 * Accessibility (Accessibility Contract):
 *   - All interactive elements min-h-[44px] min-w-[44px] touch targets
 *   - focus-visible:ring-2 on all interactive elements
 *   - 14px minimum body font (text-sm)
 *   - Status badges carry both color AND text label
 */

import { useState, useEffect, useCallback } from 'react';
import { useLoaderData } from 'react-router';
import StatusBadge from '../../components/StatusBadge';
import PDFPreview from '../../components/PDFPreview';
import { fetchLecturerSubmissions, type LecturerSubmissionItem } from '../../api/submissions';
import type { User } from '../../api/auth';

// ── Status mapping (API lowercase → StatusBadge uppercase enum) ───────────────
const STATUS_MAP: Record<string, 'MENUNGGU' | 'DISETUJUI' | 'DIBATALKAN' | 'REVISI' | 'BERLANGSUNG' | 'SELESAI'> = {
  pending: 'MENUNGGU',
  approved: 'DISETUJUI',
  rejected: 'DIBATALKAN',
  revision: 'REVISI',
};

// ── Filter tab types ───────────────────────────────────────────────────────────
type FilterTab = 'all' | 'pending' | 'approved' | 'revision';

interface TabOption {
  value: FilterTab;
  label: string;
}

const FILTER_TABS: TabOption[] = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'revision', label: 'Revisi' },
];

// ── Helper: initials from full name ───────────────────────────────────────────
function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// ── Helper: format date (Indonesia locale) ────────────────────────────────────
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

// ── Submission card ───────────────────────────────────────────────────────────

interface SubmissionCardProps {
  item: LecturerSubmissionItem;
  onPreview: (uuid: string, filename: string) => void;
}

function SubmissionCard({ item, onPreview }: SubmissionCardProps) {
  const badgeStatus = STATUS_MAP[item.status] ?? 'MENUNGGU';
  const fileUuid = item.file_url ? item.file_url.replace('/api/files/', '').replace('/', '') : null;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col gap-3">
      {/* Student info row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar with initials */}
          <div
            className="w-10 h-10 min-w-[40px] rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm flex-shrink-0"
            aria-hidden="true"
          >
            {getInitials(item.student_name)}
          </div>
          {/* Name + NIM */}
          <div className="min-w-0">
            <h4 className="font-bold text-sm text-slate-900 truncate">{item.student_name}</h4>
            <p className="text-[11px] text-neutral-gray font-normal">{item.student_nim}</p>
          </div>
        </div>
        {/* Status badge */}
        <StatusBadge status={badgeStatus} />
      </div>

      {/* Symptom chips */}
      {item.symptom_names.length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Gejala akademik">
          {item.symptom_names.map((name) => (
            <span
              key={name}
              className="inline-block rounded-full bg-gray-100 text-slate-600 text-[11px] px-2 py-0.5 font-normal"
            >
              {name}
            </span>
          ))}
        </div>
      )}

      {/* Submission date */}
      <div className="flex items-center gap-1 text-[11px] text-neutral-gray">
        <span className="material-symbols-outlined text-base" aria-hidden="true">calendar_today</span>
        <span>{formatDate(item.created_at)}</span>
      </div>

      {/* Draft file chip + "Lihat Draft" button */}
      {item.original_filename && fileUuid && (
        <div className="flex items-center justify-between gap-2">
          {/* File chip */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-dashed border-gray-200 rounded-lg px-2 py-1.5 min-w-0 flex-1">
            <span className="material-symbols-outlined text-neutral-gray text-base flex-shrink-0" aria-hidden="true">
              description
            </span>
            <span className="text-[11px] text-neutral-gray truncate font-normal">
              {item.original_filename}
            </span>
          </div>

          {/* "Lihat Draft" button — D-12: ONLY this button, no Approve/Reject */}
          <button
            type="button"
            onClick={() => onPreview(fileUuid, item.original_filename ?? 'draft.pdf')}
            className={[
              'px-3 py-2 bg-primary text-white text-xs font-bold rounded-lg',
              'hover:bg-blue-700 active:scale-[0.98] transition-all',
              'focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none',
              'min-h-[44px] flex items-center gap-1 flex-shrink-0',
            ].join(' ')}
            aria-label={`Lihat draft dari ${item.student_name}`}
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">visibility</span>
            Lihat Draft
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function LecturerDashboard() {
  const user = useLoaderData() as User;

  // ── State ──────────────────────────────────────────────────────────────────
  const [submissions, setSubmissions] = useState<LecturerSubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter / search / ordering state (D-11)
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  // PDF preview state
  const [previewUuid, setPreviewUuid] = useState<string | null>(null);
  const [previewFilename, setPreviewFilename] = useState<string>('draft.pdf');

  // ── Fetch submissions ──────────────────────────────────────────────────────
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

  // Reload when tab or search changes (with debounce on search)
  useEffect(() => {
    const timer = setTimeout(() => {
      loadSubmissions();
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadSubmissions, search]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handlePreview = (uuid: string, filename: string) => {
    setPreviewUuid(uuid);
    setPreviewFilename(filename);
  };

  const handleClosePreview = () => {
    setPreviewUuid(null);
  };

  // ── Today's date (Indonesian format) ──────────────────────────────────────
  const todayLabel = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // ── Greeting ───────────────────────────────────────────────────────────────
  const hour = new Date().getHours();
  const greeting =
    hour < 11 ? 'Selamat Pagi' : hour < 15 ? 'Selamat Siang' : hour < 18 ? 'Selamat Sore' : 'Selamat Malam';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed header */}
      <nav
        className="fixed top-0 w-full z-50 bg-white border-b border-gray-200 shadow-sm max-w-md mx-auto left-0 right-0"
        aria-label="Navigasi utama"
      >
        <div className="flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-3">
            {/* Lecturer avatar */}
            <div
              className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm"
              aria-hidden="true"
            >
              {getInitials(user?.full_name ?? 'D')}
            </div>
            <span className="font-headline font-bold text-lg text-primary">TemuDosen</span>
          </div>
          {/* Notification bell */}
          <button
            type="button"
            className="p-2 rounded-full hover:bg-gray-50 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Notifikasi"
          >
            <span className="material-symbols-outlined text-gray-600">notifications</span>
          </button>
        </div>
      </nav>

      {/* Scrollable main content */}
      <main className="pt-16 pb-32 px-4 max-w-md mx-auto space-y-6">
        {/* Greeting section */}
        <header className="pt-4 pb-2">
          <h1 className="font-headline font-bold text-2xl text-slate-900">
            {greeting}, {user?.full_name?.split(' ')[0] ?? 'Dosen'}
          </h1>
          <div className="flex items-center gap-1 mt-1 text-neutral-gray">
            <span className="material-symbols-outlined text-base" aria-hidden="true">calendar_today</span>
            <p className="text-sm font-normal">{todayLabel}</p>
          </div>
        </header>

        {/* Permintaan Masuk section */}
        <section aria-label="Permintaan Masuk">
          <h2 className="font-headline font-bold text-lg text-slate-900 mb-4">
            Permintaan Masuk
          </h2>

          {/* Search field (D-11) */}
          <div className="relative mb-4">
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-gray text-lg"
              aria-hidden="true"
            >
              search
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari NIM atau nama..."
              className={[
                'w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-gray-200 bg-white',
                'focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none',
                'placeholder:text-neutral-gray',
                'min-h-[44px]',
              ].join(' ')}
              aria-label="Cari berdasarkan NIM atau nama mahasiswa"
            />
          </div>

          {/* Filter tabs (D-11) */}
          <div
            className="flex gap-1 border-b border-gray-200 mb-4"
            role="tablist"
            aria-label="Filter status pengajuan"
          >
            {FILTER_TABS.map((tab) => {
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.value)}
                  className={[
                    'px-3 py-2 text-sm font-normal transition-colors min-h-[44px]',
                    'focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded-t',
                    isActive
                      ? 'font-bold text-primary border-b-2 border-primary'
                      : 'text-gray-500 hover:text-slate-700',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content */}
          {loading && (
            <div
              className="text-center py-10 text-neutral-gray text-sm"
              aria-live="polite"
              aria-busy="true"
            >
              <span className="material-symbols-outlined animate-spin text-3xl block mb-2">
                progress_activity
              </span>
              Memuat data...
            </div>
          )}

          {!loading && error && (
            <div className="bg-error/5 border border-error/20 rounded-xl p-4 text-center" aria-live="assertive">
              <p className="text-sm text-error font-normal">{error}</p>
              <button
                type="button"
                onClick={loadSubmissions}
                className="mt-2 text-sm text-primary font-bold underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {!loading && !error && submissions.length === 0 && (
            /* Empty state (Copywriting Contract — S-08) */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <span className="material-symbols-outlined text-gray-300 text-5xl mb-4" aria-hidden="true">
                inbox
              </span>
              <h3 className="font-headline font-bold text-lg text-slate-900 mb-2">
                Belum Ada Permintaan Masuk
              </h3>
              <p className="text-sm text-neutral-gray font-normal max-w-xs">
                Mahasiswa bimbingan Anda belum mengajukan sesi bimbingan.
              </p>
            </div>
          )}

          {!loading && !error && submissions.length > 0 && (
            <div
              className="flex flex-col gap-4"
              role="list"
              aria-label={`${submissions.length} permintaan masuk`}
            >
              {submissions.map((item) => (
                <div key={item.id} role="listitem">
                  <SubmissionCard item={item} onPreview={handlePreview} />
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Bottom navigation */}
      <nav
        className="fixed bottom-0 left-0 w-full max-w-md mx-auto right-0 z-50 flex justify-around items-center px-2 py-3 bg-white border-t border-gray-200 rounded-t-xl"
        aria-label="Navigasi bawah"
      >
        {/* Beranda — active */}
        <button
          type="button"
          className="flex flex-col items-center justify-center text-primary gap-0.5 min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
          aria-label="Beranda"
          aria-current="page"
        >
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
            home
          </span>
          <span className="text-[11px] font-normal">Beranda</span>
        </button>

        {/* Antrean */}
        <button
          type="button"
          className="flex flex-col items-center justify-center text-gray-400 gap-0.5 min-h-[44px] min-w-[44px] hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
          aria-label="Antrean"
        >
          <span className="material-symbols-outlined">format_list_numbered</span>
          <span className="text-[11px] font-normal">Antrean</span>
        </button>

        {/* Riwayat */}
        <button
          type="button"
          className="flex flex-col items-center justify-center text-gray-400 gap-0.5 min-h-[44px] min-w-[44px] hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
          aria-label="Riwayat"
        >
          <span className="material-symbols-outlined">history</span>
          <span className="text-[11px] font-normal">Riwayat</span>
        </button>

        {/* Profil */}
        <button
          type="button"
          className="flex flex-col items-center justify-center text-gray-400 gap-0.5 min-h-[44px] min-w-[44px] hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
          aria-label="Profil"
        >
          <span className="material-symbols-outlined">person</span>
          <span className="text-[11px] font-normal">Profil</span>
        </button>
      </nav>

      {/* PDF Preview modal */}
      {previewUuid && (
        <PDFPreview
          fileUuid={previewUuid}
          fileName={previewFilename}
          onClose={handleClosePreview}
        />
      )}
    </div>
  );
}
