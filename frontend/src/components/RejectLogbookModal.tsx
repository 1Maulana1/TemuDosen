/**
 * RejectLogbookModal — Gate Option A (2026-07-05, STT-04 edit/reject gap).
 * Shell mirrors ApproveLogbookModal.tsx — reject is destructive (discards
 * the AI summary in favor of manual notes) and gets the same confirmation
 * rigor as approve.
 */
interface RejectLogbookModalProps {
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}

export default function RejectLogbookModal({
  onConfirm, onClose, loading = false,
}: RejectLogbookModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Konfirmasi Penolakan Ringkasan"
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 shadow-xl">
        <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mb-3">
          <span className="material-symbols-outlined text-error text-2xl" aria-hidden="true">warning</span>
        </div>
        <h2 className="font-headline font-bold text-lg text-slate-900 mb-2">Konfirmasi Penolakan Ringkasan</h2>
        <p className="text-sm text-neutral-gray mb-4 leading-relaxed">
          Ringkasan AI untuk sesi ini akan dibuang dan digantikan dengan catatan manual yang Anda
          tulis sendiri. Tindakan ini tidak dapat dibatalkan.
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={loading}
            aria-busy={loading}
            onClick={onConfirm}
            className="w-full py-3 rounded-xl bg-error text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none"
          >
            {loading ? 'Memproses…' : 'Ya, Tolak'}
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
