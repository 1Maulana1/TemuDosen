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
 *   - Sticky footer CTA: "Kirim Pengajuan" disabled until >=1 symptom AND file present
 *
 * On submit: POST multipart to /api/submissions/ via createSubmission().
 * On success: navigate to /mahasiswa (dashboard S-06).
 *
 * Validation errors from server are rendered inline with exact UI-SPEC copy.
 * aria-describedby links each error to its input.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useRouteLoaderData } from 'react-router';
import type { User } from '../../api/auth';
import { fetchSymptoms } from '../../api/symptoms';
import type { SymptomCategory } from '../../api/symptoms';
import { createSubmission } from '../../api/submissions';
import SymptomChips from '../../components/SymptomChips';
import UploadZone from '../../components/UploadZone';

interface FormErrors {
  symptom_ids?: string;
  draft_file?: string;
  description?: string;
  general?: string;
}

export default function SubmissionForm() {
  const user = useRouteLoaderData('student-root') as User;
  const navigate = useNavigate();

  const [symptoms, setSymptoms] = useState<SymptomCategory[]>([]);
  const [selectedSymptomIds, setSelectedSymptomIds] = useState<number[]>([]);
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <div className="font-body text-slate-900 min-h-screen overflow-x-hidden max-w-lg mx-auto">
      {/* Fixed header with step progress */}
      <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-sm shadow-sm border-b border-amber-100 max-w-lg mx-auto left-0 right-0">
        <div className="flex items-center px-4 h-14 w-full">
          <button
            type="button"
            onClick={() => navigate('/mahasiswa')}
            className="p-2 -ml-2 active:scale-95 transition-transform min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary-light focus-visible:outline-none"
            aria-label="Kembali ke dashboard"
          >
            <span className="material-symbols-outlined text-gray-700">arrow_back</span>
          </button>
          <h1 className="ml-2 font-headline font-bold text-lg text-gray-900">
            Ajukan Sesi Bimbingan
          </h1>
        </div>
        {/* Step progress bar */}
        <div className="px-4 pb-3">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] font-normal text-gray-500 uppercase tracking-wider">
              Langkah 1 dari 2
            </span>
            <span className="text-[11px] font-bold text-primary">50%</span>
          </div>
          <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-primary-light rounded-full w-1/2 transition-all duration-300" />
          </div>
        </div>
      </header>

      {/* Main form */}
      <main className="pt-32 pb-32 px-4 max-w-md mx-auto">
        <form id="submissionForm" onSubmit={handleSubmit} className="space-y-6" noValidate>

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

          {/* Section 5: Estimasi Durasi (bento card, dark) */}
          {selectedSymptomIds.length > 0 && (
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
                  <h4 className="text-sm font-bold flex items-center">
                    Estimasi Durasi: ~{estimatedMinutes} menit
                    <span className="material-symbols-outlined text-[14px] ml-1.5 opacity-60">
                      info
                    </span>
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-1 leading-relaxed font-normal">
                    Dihitung berdasarkan gejala akademik yang Anda pilih untuk efektivitas
                    sesi bimbingan.
                  </p>
                </div>
              </div>
            </section>
          )}

        </form>
      </main>

      {/* Sticky footer CTA */}
      <footer className="fixed bottom-0 w-full max-w-md mx-auto left-0 right-0 bg-white border-t border-gray-100 p-4 pb-6 z-50">
        <button
          type="submit"
          form="submissionForm"
          disabled={!canSubmit || isSubmitting}
          aria-busy={isSubmitting}
          aria-disabled={!canSubmit}
          className={[
            'w-full h-14 rounded-xl font-bold text-[17px] flex items-center justify-center gap-2',
            'transition-all active:scale-[0.98]',
            canSubmit && !isSubmitting
              ? 'bg-primary-light text-gray-900 shadow-lg shadow-amber-200 cursor-pointer hover:bg-amber-500'
              : 'bg-primary-light text-gray-900 opacity-50 cursor-not-allowed',
          ].join(' ')}
        >
          {isSubmitting ? (
            <>
              <span className="material-symbols-outlined text-sm animate-spin">autorenew</span>
              <span>Memproses...</span>
            </>
          ) : (
            <>
              <span>Kirim Pengajuan</span>
              <span className="material-symbols-outlined text-sm">send</span>
            </>
          )}
        </button>
      </footer>
    </div>
  );
}
