/**
 * PDFPreview component — split-pane PDF viewer (S-09, D-14, D-16).
 *
 * Displays a PDF via:
 *   <iframe src="/api/files/<uuid>/" />
 * The browser sends the session cookie automatically (same-origin via Vite proxy).
 * The /api/files/<uuid>/ endpoint enforces ownership auth (D-29).
 *
 * Layout: full-screen modal/bottom-sheet on mobile (w-full h-[70vh]),
 * with a close button and "Unduh PDF" download button.
 *
 * The right feedback pane is empty in Phase 1 per D-16 spec;
 * it will be extended with lecturer feedback in Phase 2.
 *
 * Renders at 360px without horizontal scroll (max-w-md container).
 */

import { resolveUrl } from '../api/client';

interface PDFPreviewProps {
  fileUuid: string;
  fileName?: string;
  onClose: () => void;
}

export default function PDFPreview({
  fileUuid,
  fileName = 'draft.pdf',
  onClose,
}: PDFPreviewProps) {
  const fileUrl = resolveUrl(`/api/files/${fileUuid}/`);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Pratinjau PDF: ${fileName}`}
    >
      {/* Modal container */}
      <div className="bg-white w-full max-w-md rounded-t-2xl overflow-hidden flex flex-col"
           style={{ maxHeight: '95vh' }}>
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-sm font-bold text-slate-800 truncate">{fileName}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Download button */}
            <a
              href={fileUrl}
              download={fileName}
              className={[
                'px-3 py-2 rounded-lg border border-primary text-primary text-xs font-bold',
                'hover:bg-primary/5 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                'min-h-[44px] flex items-center',
              ].join(' ')}
            >
              Unduh PDF
            </a>
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className={[
                'p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600',
                'focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                'min-h-[44px] min-w-[44px] flex items-center justify-center',
              ].join(' ')}
              aria-label="Tutup pratinjau"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Split-pane content: PDF left (primary), notes right (empty Phase 1 placeholder) */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left pane: PDF iframe */}
          <div className="flex-1 overflow-hidden">
            <iframe
              src={fileUrl}
              title={`PDF: ${fileName}`}
              className="w-full h-[70vh] border-0"
              // Session cookie is sent automatically (same-origin via Vite proxy in dev)
            />
          </div>

          {/* Right pane: empty feedback placeholder (D-16, Phase 2 extension point) */}
          <div
            className="hidden lg:flex lg:w-64 border-l border-gray-100 p-4 flex-col items-center justify-center text-center"
            aria-label="Catatan dan umpan balik (akan tersedia di Phase 2)"
          >
            <span className="material-symbols-outlined text-gray-300 text-4xl mb-2">
              chat_bubble_outline
            </span>
            <p className="text-xs text-gray-400 font-normal">
              Catatan dosen akan ditampilkan di sini setelah bimbingan disetujui.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
