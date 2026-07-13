/**
 * SubmissionForm page — S-07: Langkah 1 dari 2 (Gejala & Draft).
 *
 * UI-SPEC S-07 elements (all per spec):
 *   - Fixed header with step progress bar "Langkah 1 dari 2", 50% fill, bg-primary h-1.5
 *   - Pilih Dosen Pembimbing — read-only card showing pre-assigned adviser (D-24)
 *   - Gejala Akademik — required multi-select chip group (SymptomChips)
 *   - Deskripsi Masalah — optional textarea, 500-char counter
 *   - Upload Draft — required (UploadZone)
 *   - Estimasi Durasi — dark bento card computed from selected symptoms
 *   - CTA "Lanjutkan ke Jadwal" (mengalir dalam sidebar; di mobile menumpuk di
 *     bawah kartu estimasi, bukan footer fixed) — disabled until >=1 symptom AND file
 *   - AppBottomNav mobile seperti halaman lain
 *
 * On submit: POST multipart to /api/submissions/ via createSubmission().
 * On success: navigate to /mahasiswa (dashboard S-06).
 *
 * Validation errors from server are rendered inline with exact UI-SPEC copy.
 * aria-describedby links each error to its input.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useRouteLoaderData } from 'react-router';
import { logout, type User } from '../../api/auth';
import { AppNavbar, AppBottomNav, NAV_ITEMS } from '../../components/AppNav';
import { fetchSymptoms } from '../../api/symptoms';
import type { SymptomCategory } from '../../api/symptoms';
import { createSubmission, fetchMySubmissions } from '../../api/submissions';
import SymptomChips from '../../components/SymptomChips';
import UploadZone from '../../components/UploadZone';

interface FormErrors {
  symptom_ids?: string;
  draft_file?: string;
  description?: string;
  general?: string;
}

export default function SubmissionForm() {
  const user = useRouteLoaderData('mahasiswa') as User;
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const [symptoms, setSymptoms] = useState<SymptomCategory[]>([]);
  const [selectedSymptomIds, setSelectedSymptomIds] = useState<number[]>([]);
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // FR-D01: status submission terakhir — REJECTED/REVISION menampilkan catatan dosen
  const [latestStatus, setLatestStatus] = useState<'rejected' | 'revision' | null>(null);
  const [revisionNote, setRevisionNote] = useState('');

  // Load available symptoms
  useEffect(() => {
    fetchSymptoms()
      .then(setSymptoms)
      .catch(() => {
        setErrors((prev) => ({
          ...prev,
          general: 'Gagal memuat daftar gejala. Coba muat ulang halaman.',
        }));
      });
  }, []);

  // FR-D01: cek status submission terakhir sebelum mengizinkan pengajuan baru
  useEffect(() => {
    fetchMySubmissions()
      .then((subs) => {
        const latest = subs[0];
        if (latest?.status === 'rejected') {
          setLatestStatus('rejected');
          setRevisionNote(latest.rejection_reason);
        } else if (latest?.status === 'revision') {
          setLatestStatus('revision');
          setRevisionNote(latest.rejection_reason);
        }
      })
      .catch(() => null);
  }, []);

  // Compute estimated duration from selected symptoms
  const estimatedMinutes = symptoms
    .filter((s) => selectedSymptomIds.includes(s.id))
    .reduce((sum, s) => sum + s.duration_minutes, 0);

  // CTA is enabled only when >=1 symptom AND a file are present
  const canSubmit = selectedSymptomIds.length > 0 && selectedFile !== null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Clear prior errors
    setErrors({});

    // Client-side gate checks (server is authoritative — these are UX only)
    const newErrors: FormErrors = {};
    if (selectedSymptomIds.length === 0) {
      newErrors.symptom_ids = 'Pilih minimal satu gejala akademik.';
    }
    if (!selectedFile) {
      newErrors.draft_file = 'Unggah file PDF draft sebelum melanjutkan.';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await createSubmission({
        symptom_ids: selectedSymptomIds,
        description: description.trim() || undefined,
        draft_file: selectedFile!,
      });

      // On success, navigate to the student dashboard
      navigate('/mahasiswa');
    } catch (err: unknown) {
      // Parse server validation errors
      try {
        const errData = JSON.parse((err as Error).message ?? '{}');
        const serverErrors: FormErrors = {};

        if (errData.symptom_ids) {
          serverErrors.symptom_ids = Array.isArray(errData.symptom_ids)
            ? errData.symptom_ids.join(' ')
            : errData.symptom_ids;
        }
        if (errData.draft_file) {
          serverErrors.draft_file = Array.isArray(errData.draft_file)
            ? errData.draft_file.join(' ')
            : errData.draft_file;
        }
        if (errData.non_field_errors || errData.detail) {
          serverErrors.general = errData.non_field_errors?.[0] ?? errData.detail;
        }

        setErrors(serverErrors);
      } catch {
        setErrors({ general: 'Terjadi kesalahan. Coba lagi.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const adviser = user.adviser ?? null;

  return (
    <div className="font-body text-slate-900 bg-gray-50 min-h-screen flex flex-col overflow-x-hidden">
      <AppNavbar items={NAV_ITEMS.mahasiswa} active="ajukan" userName={user?.full_name ?? 'Mahasiswa'} onLogout={handleLogout} />

<>
      {/* Main form — 2 kolom di desktop (isian + sidebar estimasi) */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-8">
        {/* Page header + step progress */}
        <div className="mb-6">
          <h1 className="font-headline font-bold text-2xl text-on-surface">Ajukan Bimbingan Baru</h1>
          <div className="mt-3 max-w-md">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[11px] font-normal text-gray-500 uppercase tracking-wider">Langkah 1 dari 2</span>
              <span className="text-[11px] font-bold text-primary">50%</span>
            </div>
            <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full w-1/2 transition-all duration-300" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <form id="submissionForm" onSubmit={handleSubmit} className="lg:col-span-2 space-y-6 bg-surface rounded-2xl border border-gray-200 shadow-sm p-5 sm:p-6" noValidate>

          {/* FR-D01: catatan revisi dosen untuk pengajuan ulang */}
          {latestStatus === 'revision' && revisionNote && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-sm text-orange-700">
              <span className="font-bold">Catatan revisi dari dosen: </span>
              {revisionNote}
            </div>
          )}

          {/* FR-D01: pengajuan sebelumnya ditolak — tampilkan alasan, tetap boleh mengajukan lagi */}
          {latestStatus === 'rejected' && (
            <div className="p-3 bg-error/5 border border-error/20 rounded-xl text-sm text-error">
              <span className="font-bold">Pengajuan Anda sebelumnya ditolak. </span>
              {revisionNote
                ? <>Alasan: {revisionNote}. Perbaiki sesuai catatan dosen lalu ajukan kembali.</>
                : 'Anda dapat memperbaiki dan mengajukan bimbingan baru.'}
            </div>
          )}

          {/* General error */}
          {errors.general && (
            <div
              className="p-3 bg-error/5 border border-error/20 rounded-xl text-sm text-error"
              role="alert"
            >
              {errors.general}
            </div>
          )}

          {/* Section 1: Pilih Dosen Pembimbing (read-only, D-24) */}
          <section className="space-y-3">
            <label className="block text-sm font-bold text-slate-800">
              Pilih Dosen Pembimbing
            </label>
            <div className="relative flex items-center p-3.5 bg-white border border-gray-200 rounded-xl shadow-sm">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mr-3 border border-gray-200 shrink-0">
                <span className="material-symbols-outlined text-gray-400 text-lg">person</span>
              </div>
              <div className="flex-1 min-w-0">
                {adviser ? (
                  <>
                    <p className="text-sm font-bold text-slate-900 leading-tight truncate">
                      {adviser.full_name}
                    </p>
                    <div className="flex items-center mt-1">
                      <span className="flex h-2 w-2 rounded-full bg-success mr-1.5 shrink-0" />
                      <span className="text-[11px] font-normal text-success">
                        Dosen pembimbing Anda
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm font-normal text-gray-400">
                    Belum ada dosen pembimbing yang ditetapkan.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Section 2: Gejala Akademik (required) */}
          <section className="space-y-3">
            <div className="flex justify-between items-end">
              <label
                id="gejala-label"
                className="block text-sm font-bold text-slate-800"
              >
                Gejala Akademik{' '}
                <span className="text-error" aria-hidden="true">*</span>
              </label>
            </div>
            <SymptomChips
              symptoms={symptoms}
              selectedIds={selectedSymptomIds}
              onChange={setSelectedSymptomIds}
              error={errors.symptom_ids}
            />
            <p className="text-[11px] text-gray-500 flex items-center">
              <span className="material-symbols-outlined text-[14px] mr-1">info</span>
              Pilih topik utama yang ingin dibahas (wajib)
            </p>
          </section>

          {/* Section 3: Deskripsi Masalah (optional) */}
          <section className="space-y-3">
            <label
              htmlFor="description"
              className="block text-sm font-bold text-slate-800"
            >
              Deskripsi Masalah
            </label>
            <div className="relative">
              <textarea
                id="description"
                rows={4}
                maxLength={500}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Jelaskan secara singkat kendala yang dihadapi..."
                className={[
                  'w-full p-4 text-sm bg-white border rounded-xl transition-all',
                  'focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none',
                  'placeholder:text-gray-400',
                  errors.description ? 'border-error' : 'border-gray-200',
                ].join(' ')}
              />
              <div className="absolute bottom-3 right-3 text-[10px] font-bold text-gray-400 bg-white/80 px-1 rounded">
                {description.length}/500
              </div>
            </div>
          </section>

          {/* Section 4: Upload Draft (required) */}
          <section className="space-y-3">
            <label
              htmlFor="draft-file"
              className="block text-sm font-bold text-slate-800"
            >
              Upload Draft{' '}
              <span className="text-error" aria-hidden="true">*</span>
            </label>
            <UploadZone
              id="draft-file"
              onFileSelect={setSelectedFile}
              error={errors.draft_file}
            />
          </section>

        </form>

          {/* Sidebar: estimasi durasi + CTA (desktop). Mobile pakai footer tetap di bawah. */}
          <aside className="space-y-4 lg:sticky lg:top-32">
            <section
              className="p-4 bg-slate-900 rounded-2xl text-white shadow-lg overflow-hidden relative group"
              aria-label={`Estimasi durasi bimbingan: ${estimatedMinutes} menit`}
            >
              {/* Decorative background glow */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/20 rounded-full blur-2xl group-hover:bg-primary/30 transition-all duration-700" />
              <div className="relative z-10 flex items-start space-x-3">
                <div className="bg-white/10 p-2 rounded-xl backdrop-blur-sm shrink-0">
                  <span className="material-symbols-outlined text-white text-xl">timer</span>
                </div>
                <div className="flex-1 min-w-0">
                  {selectedSymptomIds.length > 0 ? (
                    <>
                      <h4 className="text-sm font-bold flex items-center">
                        Estimasi Durasi: ~{estimatedMinutes} menit
                        <span className="material-symbols-outlined text-[14px] ml-1.5 opacity-60">info</span>
                      </h4>
                      <p className="text-[11px] text-slate-300 mt-1 leading-relaxed font-normal">
                        Dihitung berdasarkan gejala akademik yang Anda pilih untuk efektivitas sesi bimbingan.
                      </p>
                    </>
                  ) : (
                    <>
                      <h4 className="text-sm font-bold">Estimasi Durasi</h4>
                      <p className="text-[11px] text-slate-300 mt-1 leading-relaxed font-normal">
                        Pilih gejala akademik untuk menghitung estimasi durasi bimbingan.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* CTA desktop */}
            <button
              type="submit"
              form="submissionForm"
              disabled={!canSubmit || isSubmitting}
              aria-disabled={!canSubmit}
              className={[
                'flex w-full py-4 px-6 rounded-xl font-bold text-sm items-center justify-center space-x-2 transition-all active:scale-[0.98]',
                canSubmit && !isSubmitting
                  ? 'bg-primary text-on-primary shadow-lg shadow-primary/25 cursor-pointer'
                  : 'bg-primary text-on-primary opacity-50 cursor-not-allowed',
              ].join(' ')}
            >
              {isSubmitting ? (
                <><span className="material-symbols-outlined text-sm animate-spin">autorenew</span><span>Memproses...</span></>
              ) : (
                <><span>Lanjutkan ke Jadwal</span><span className="material-symbols-outlined text-sm">arrow_forward</span></>
              )}
            </button>
          </aside>
        </div>
      </main>
      </>

      <AppBottomNav items={NAV_ITEMS.mahasiswa} active="ajukan" />
    </div>
  );
}
