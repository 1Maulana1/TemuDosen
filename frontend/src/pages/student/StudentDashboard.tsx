/**
 * StudentDashboard page — S-06: My Submissions dashboard.
 *
 * UI-SPEC S-06 elements:
 *   - Fixed header: TemuDosen wordmark + notification bell + avatar
 *   - Bottom nav: Beranda | Ajukan | Riwayat | Profil
 *   - Greeting: font-headline font-bold text-2xl text-slate-900
 *   - "Ajukan Bimbingan Baru" shortcut card (primary-tinted)
 *   - Submission list with StatusBadge + symptom names + date + "Pratinjau" button
 *   - Empty state: "Belum Ada Pengajuan" with exact Copywriting Contract copy
 *
 * "Pratinjau" opens PDFPreview (S-09) with /api/files/<uuid>/ protected serving.
 */

import { useEffect, useState } from 'react';
import { Link, useLoaderData, useNavigate } from 'react-router';
import type { User } from '../../api/auth';
import { fetchMySubmissions } from '../../api/submissions';
import type { SubmissionSummary } from '../../api/submissions';
import StatusBadge from '../../components/StatusBadge';
import PDFPreview from '../../components/PDFPreview';

const STATUS_MAP: Record<SubmissionSummary['status'], 'MENUNGGU' | 'DISETUJUI' | 'DIBATALKAN' | 'REVISI'> = {
  pending: 'MENUNGGU',
  approved: 'DISETUJUI',
  rejected: 'DIBATALKAN',
  revision: 'REVISI',
};

function formatDate(isoStr: string): string {
  const date = new Date(isoStr);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function StudentDashboard() {
  const user = useLoaderData() as User;
  const navigate = useNavigate();

  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{
    uuid: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    fetchMySubmissions()
      .then(setSubmissions)
      .catch(() =>
        setError('Gagal memuat pengajuan. Coba muat ulang halaman.')
      )
      .finally(() => setIsLoading(false));
  }, []);

  const firstName = user.full_name.split(' ')[0];

  return (
    <div className="font-body text-slate-900 bg-gray-50 min-h-screen overflow-x-hidden">

      {/* Fixed header */}
      <header className="fixed top-0 left-0 right-0 w-full z-50 bg-white border-b border-gray-200 shadow-sm h-16 max-w-md mx-auto flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-primary font-headline font-bold text-xl tracking-tight">
            TemuDosen
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined text-gray-600">notifications</span>
            <span className="absolute top-0 right-0 w-2 h-2 bg-error rounded-full border-2 border-white" />
          </div>
          <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-lg">person</span>
          </div>
        </div>
      </header>

      {/* Scrollable main content */}
      <main className="pt-20 pb-24 px-4 max-w-md mx-auto space-y-5">

        {/* Greeting */}
        <section className="pt-2">
          <h1 className="font-headline font-bold text-2xl text-slate-900">
            Halo, {firstName}!
          </h1>
          <p className="text-sm font-normal text-gray-500 mt-0.5">
            Selamat datang kembali di TemuDosen.
          </p>
        </section>

        {/* Ajukan Bimbingan Baru shortcut card */}
        <section>
          <Link
            to="/mahasiswa/ajukan"
            className="block p-4 bg-primary rounded-2xl text-white shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            aria-label="Ajukan bimbingan baru"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-normal text-blue-200 uppercase tracking-wider mb-1">
                  Mulai Sekarang
                </p>
                <h2 className="font-headline font-bold text-lg">
                  Ajukan Bimbingan Baru
                </h2>
                <p className="text-xs font-normal text-blue-100 mt-1">
                  Pilih gejala akademik dan unggah draft
                </p>
              </div>
              <span className="material-symbols-outlined text-white/70 text-3xl">
                add_circle
              </span>
            </div>
          </Link>
        </section>

        {/* Submission list */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-headline font-bold text-lg text-slate-900">
              Riwayat Pengajuan
            </h2>
          </div>

          {isLoading && (
            <div className="py-8 text-center text-sm text-gray-400" aria-live="polite">
              Memuat pengajuan...
            </div>
          )}

          {error && (
            <div
              className="p-3 bg-error/5 border border-error/20 rounded-xl text-sm text-error"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Empty state — exact Copywriting Contract copy */}
          {!isLoading && !error && submissions.length === 0 && (
            <div className="py-10 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-gray-300 text-3xl">
                  description
                </span>
              </div>
              <h3 className="font-headline font-bold text-lg text-slate-800">
                Belum Ada Pengajuan
              </h3>
              <p className="text-sm font-normal text-gray-500 mt-2 max-w-[240px]">
                Ajukan bimbingan pertama Anda dengan memilih gejala akademik dan
                mengunggah draft.
              </p>
              <Link
                to="/mahasiswa/ajukan"
                className={[
                  'mt-4 px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold',
                  'shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors',
                  'active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                ].join(' ')}
              >
                Ajukan Sekarang
              </Link>
            </div>
          )}

          {/* Submission cards */}
          {!isLoading && submissions.map((submission) => (
            <div
              key={submission.id}
              className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {/* Symptom names */}
                  <p className="text-sm font-bold text-slate-800 truncate">
                    {submission.symptoms.map((s) => s.name).join(', ') || 'Tidak ada gejala'}
                  </p>
                  {/* Submission date */}
                  <p className="text-xs font-normal text-gray-400 mt-0.5">
                    {formatDate(submission.created_at)}
                  </p>
                </div>
                {/* Status badge */}
                <StatusBadge status={STATUS_MAP[submission.status] ?? 'MENUNGGU'} />
              </div>

              {/* File name + preview button */}
              {submission.file_uuid && (
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-gray-400 text-sm">
                      attach_file
                    </span>
                    <span className="text-xs font-normal text-gray-500 truncate">
                      {submission.file_name ?? 'draft.pdf'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewFile({
                        uuid: submission.file_uuid!,
                        name: submission.file_name ?? 'draft.pdf',
                      })
                    }
                    className={[
                      'px-3 py-1.5 rounded-lg text-xs font-bold text-primary',
                      'border border-primary/20 bg-primary/5 hover:bg-primary/10',
                      'transition-colors min-h-[44px] flex items-center',
                      'focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                    ].join(' ')}
                  >
                    Pratinjau
                  </button>
                </div>
              )}
            </div>
          ))}
        </section>
      </main>

      {/* Bottom navigation */}
      <nav
        className="fixed bottom-0 left-0 right-0 w-full z-50 flex justify-around bg-white border-t border-gray-200 px-2 py-3 rounded-t-xl max-w-md mx-auto"
        aria-label="Navigasi bawah"
      >
        {/* Beranda — active */}
        <button
          type="button"
          onClick={() => navigate('/mahasiswa')}
          className="flex flex-col items-center justify-center text-primary min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded-xl px-2"
          aria-current="page"
          aria-label="Beranda"
        >
          <span
            className="material-symbols-outlined text-xl"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            home
          </span>
          <span className="font-label text-[11px] font-normal mt-0.5">Beranda</span>
        </button>

        {/* Ajukan */}
        <Link
          to="/mahasiswa/ajukan"
          className="flex flex-col items-center justify-center text-gray-400 hover:text-primary min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded-xl px-2"
          aria-label="Ajukan"
        >
          <span className="material-symbols-outlined text-xl">add_circle</span>
          <span className="font-label text-[11px] font-normal mt-0.5">Ajukan</span>
        </Link>

        {/* Riwayat */}
        <button
          type="button"
          className="flex flex-col items-center justify-center text-gray-400 min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded-xl px-2"
          aria-label="Riwayat"
        >
          <span className="material-symbols-outlined text-xl">history</span>
          <span className="font-label text-[11px] font-normal mt-0.5">Riwayat</span>
        </button>

        {/* Profil */}
        <button
          type="button"
          className="flex flex-col items-center justify-center text-gray-400 min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded-xl px-2"
          aria-label="Profil"
        >
          <span className="material-symbols-outlined text-xl">person</span>
          <span className="font-label text-[11px] font-normal mt-0.5">Profil</span>
        </button>
      </nav>

      {/* PDF Preview modal */}
      {previewFile && (
        <PDFPreview
          fileUuid={previewFile.uuid}
          fileName={previewFile.name}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
