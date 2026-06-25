/**
 * UploadZone component — PDF upload area for the submission form (S-07).
 *
 * UI-SPEC states:
 * - Default: border-2 border-dashed border-gray-200 bg-slate-50/50
 * - Hover/drag-over: border-primary/30 bg-white
 * - File uploaded: Replace zone with success card bg-success/5 border border-success/20 rounded-xl
 * - Post-upload copy: "[filename] • [X.X MB] • Selesai diunggah"
 *
 * Client-side validation (server is authoritative — RESEARCH Responsibility Map):
 * - Accepts only .pdf (accept=".pdf")
 * - Client pre-check: file size <=5MB and MIME starts with 'application/pdf'
 * - If client-side check fails, show the exact UI-SPEC error copy
 *
 * Accessibility:
 * - <input type="file"> with visible label (not icon-only)
 * - aria-describedby links to error message
 */

import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';

interface UploadZoneProps {
  onFileSelect: (file: File | null) => void;
  error?: string;
  id?: string;
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function UploadZone({
  onFileSelect,
  error: externalError,
  id = 'draft-file',
}: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const errorMessage = externalError ?? clientError ?? null;

  const validateAndSelect = (file: File | null) => {
    setClientError(null);

    if (!file) {
      setSelectedFile(null);
      onFileSelect(null);
      return;
    }

    // Client-side pre-check: MIME type (server is authoritative, this is UX only)
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setClientError('Hanya file PDF yang diizinkan.');
      setSelectedFile(null);
      onFileSelect(null);
      return;
    }

    // Client-side pre-check: file size
    if (file.size > MAX_SIZE_BYTES) {
      setClientError('Ukuran file melebihi batas 5MB. Pilih file yang lebih kecil.');
      setSelectedFile(null);
      onFileSelect(null);
      return;
    }

    setSelectedFile(file);
    onFileSelect(file);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    validateAndSelect(file);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0] ?? null;
    validateAndSelect(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setClientError(null);
    onFileSelect(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const errorId = `${id}-error`;

  if (selectedFile) {
    return (
      <div className="space-y-2">
        <div
          className="flex items-center justify-between p-3 bg-success/5 border border-success/20 rounded-xl"
          aria-live="polite"
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-success/10 rounded-lg">
              <span
                className="material-symbols-outlined text-success text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                description
              </span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">{selectedFile.name}</p>
              <p className="text-[10px] text-success font-normal">
                {formatFileSize(selectedFile.size)} • Selesai diunggah
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <span className="material-symbols-outlined text-success text-lg">
              check_circle
            </span>
            <button
              type="button"
              onClick={handleRemove}
              className="p-1 hover:bg-error/10 rounded transition-colors text-error min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none"
              aria-label="Hapus file"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            inputRef.current?.click();
          }
        }}
        aria-describedby={errorMessage ? errorId : undefined}
        className={[
          'border-2 border-dashed rounded-xl p-6 cursor-pointer',
          'flex flex-col items-center justify-center space-y-2',
          'transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
          isDragOver
            ? 'border-primary/30 bg-white'
            : errorMessage
            ? 'border-error/30 bg-error/5'
            : 'border-gray-200 bg-slate-50/50 hover:bg-white hover:border-primary/30',
        ].join(' ')}
      >
        <div className="bg-white p-2 rounded-lg shadow-sm">
          <span className="material-symbols-outlined text-primary text-2xl">
            upload_file
          </span>
        </div>
        <div className="text-center">
          <p className="text-xs font-bold text-slate-700">Pilih file PDF</p>
          <p className="text-[10px] text-gray-400">Ukuran maksimal 5MB</p>
        </div>
      </div>

      {/* Hidden actual file input */}
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept=".pdf"
        className="sr-only"
        aria-label="Upload file PDF draft"
        aria-required="true"
        aria-describedby={errorMessage ? errorId : undefined}
        onChange={handleInputChange}
      />

      {errorMessage && (
        <p
          id={errorId}
          className="text-xs text-error"
          role="alert"
          aria-live="polite"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}
