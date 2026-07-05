/**
 * ApproveLogbookModal — S-14 (STT-04 anti-rubber-stamp gate). Shell copied
 * from ConsentModal.tsx.
 */
interface ApproveLogbookModalProps {
  ungroundedCount: number;
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}

export default function ApproveLogbookModal({
  ungroundedCount, onConfirm, onClose, loading = false,
}: ApproveLogbookModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Konfirmasi Persetujuan Logbook"
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <span className="material-symbols-outlined text-primary text-2xl" aria-hidden="true">lock</span>
        </div>
        <h2 className="font-headline font-bold text-lg text-slate-900 mb-2">Konfirmasi Persetujuan Logbook</h2>
        <p className="text-sm text-neutral-gray mb-4 leading-relaxed">
          Ringkasan ini akan menjadi catatan resmi bimbingan dan tidak dapat diedit lagi setelah
          disetujui. Pastikan Anda telah membaca transkrip lengkap sebelum melanjutkan.
        </p>

        {ungroundedCount > 0 && (
          <p className="text-orange-700 font-bold text-sm mb-4">
            {ungroundedCount} item masih ditandai &apos;Perlu Verifikasi&apos;.
          </p>
        )}

        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={loading}
            aria-busy={loading}
            onClick={onConfirm}
            className="w-full py-3 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            {loading ? 'Menyimpan…' : 'Setujui & Kunci'}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="w-full py-3 rounded-xl border border-gray-200 text-slate-600 text-sm font-bold hover:bg-gray-50 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
