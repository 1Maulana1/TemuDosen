/**
 * ConsentModal — FR-M04: persetujuan perekaman sesi sebelum "Mulai & Rekam".
 *
 * Dua checkbox (mahasiswa + dosen) harus dicentang agar "Setuju & Mulai Rekam" aktif.
 * "Lanjut Tanpa Rekaman" selalu tersedia sebagai jalur alternatif tanpa consent.
 */

import { useState } from 'react';

interface ConsentModalProps {
  studentName: string;
  dosenName: string;
  onConfirm: (withRecording: boolean) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function ConsentModal({ studentName, dosenName, onConfirm, onClose, loading = false }: ConsentModalProps) {
  const [mahasiswaChecked, setMahasiswaChecked] = useState(false);
  const [dosenChecked, setDosenChecked] = useState(false);

  const bothChecked = mahasiswaChecked && dosenChecked;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Persetujuan Perekaman Sesi"
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 shadow-xl">
        <h2 className="font-headline font-bold text-lg text-slate-900 mb-2">Persetujuan Perekaman Sesi</h2>
        <p className="text-sm text-neutral-gray mb-5 leading-relaxed">
          Sesi bimbingan ini dapat direkam dan dianalisis menggunakan sistem AI untuk membantu
          pencatatan dan evaluasi bimbingan. Rekaman hanya digunakan untuk keperluan akademik,
          disimpan sesuai kebijakan privasi kampus, dan dapat dihentikan kapan saja atas
          permintaan salah satu pihak. Kedua pihak perlu menyetujui sebelum rekaman dimulai.
        </p>

        <div className="flex flex-col gap-3 mb-5">
          <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:border-primary/40">
            <input
              type="checkbox"
              checked={mahasiswaChecked}
              onChange={(e) => setMahasiswaChecked(e.target.checked)}
              className="mt-0.5 w-5 h-5 accent-primary shrink-0"
            />
            <span className="text-sm text-slate-700">
              Saya (<span className="font-bold">{studentName}</span>) menyetujui perekaman sesi ini
            </span>
          </label>
          <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:border-primary/40">
            <input
              type="checkbox"
              checked={dosenChecked}
              onChange={(e) => setDosenChecked(e.target.checked)}
              className="mt-0.5 w-5 h-5 accent-primary shrink-0"
            />
            <span className="text-sm text-slate-700">
              Saya (<span className="font-bold">{dosenName}</span>) menyetujui perekaman sesi ini
            </span>
          </label>
        </div>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={!bothChecked || loading}
            onClick={() => onConfirm(true)}
            className="w-full py-3 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            {loading ? 'Memulai...' : 'Setuju & Mulai Rekam'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => onConfirm(false)}
            className="w-full py-3 rounded-xl border border-gray-200 text-slate-600 text-sm font-bold hover:bg-gray-50 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            Lanjut Tanpa Rekaman
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="w-full py-2 text-neutral-gray text-xs font-normal hover:text-slate-600"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
