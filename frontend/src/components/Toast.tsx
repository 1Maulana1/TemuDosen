/**
 * Toast — lightweight self-dismissing success/error banner.
 * Used for FR-M03: "Antrian berhasil dibatalkan" after redirect.
 */

import { useEffect } from 'react';

interface ToastProps {
  message: string;
  variant?: 'success' | 'error';
  onClose: () => void;
  durationMs?: number;
}

export default function Toast({ message, variant = 'success', onClose, durationMs = 3000 }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [onClose, durationMs]);

  const styles = variant === 'success'
    ? 'bg-success text-white'
    : 'bg-error text-white';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] max-w-[90%]"
    >
      <div className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg ${styles}`}>
        <span className="material-symbols-outlined text-lg" aria-hidden="true">
          {variant === 'success' ? 'check_circle' : 'error'}
        </span>
        <span className="text-sm font-bold">{message}</span>
      </div>
    </div>
  );
}
