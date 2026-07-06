/**
 * RejectLogbookModal — konfirmasi sebelum menolak draf ringkasan AI (Gate STT-04).
 *
 * Menolak mengalihkan logbook ke jalur catatan manual (STT-07) — draf AI yang
 * ada tidak bisa dikembalikan, jadi perlu konfirmasi eksplisit, bukan sekali klik.
 */
interface RejectLogbookModalProps {
  onConfirm: () => void;
  onClose: () => void;
  loading?: boolean;
}

export default function RejectLogbookModal({ onConfirm, onClose, loading = false }: RejectLogbookModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Tolak Ringkasan Otomatis"
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 shadow-xl">
        <h2 className="font-headline font-bold text-lg text-slate-900 mb-2">Tolak Ringkasan Otomatis?</h2>
        <p className="text-sm text-neutral-gray mb-5 leading-relaxed">
          Draf ringkasan AI ini akan dibuang dan tidak bisa dikembalikan. Anda perlu menuliskan
          ringkasan hasil bimbingan secara manual sebagai gantinya.
        </p>

        <div className="flex flex-col gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="w-full py-3 rounded-xl bg-error text-white text-sm font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none"
          >
            {loading ? 'Menolak…' : 'Ya, Tolak & Isi Manual'}
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
