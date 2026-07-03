/**
 * PasswordInput — password field with lock icon + show/hide toggle.
 * Shared by LoginMahasiswaPage / LoginDosenPage / LoginKetuaJurusanPage.
 * (LoginPage.tsx keeps its own inline copy — not refactored per task scope.)
 */
import { useState } from 'react';

interface PasswordInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoComplete?: string;
}

export default function PasswordInput({
  id,
  value,
  onChange,
  disabled = false,
  autoComplete = 'current-password',
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <span
        className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-gray text-[20px]"
        aria-hidden="true"
      >
        lock
      </span>
      <input
        id={id}
        type={showPassword ? 'text' : 'password'}
        autoComplete={autoComplete}
        required
        aria-required="true"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
        className="w-full border border-gray-200 bg-white rounded-xl pl-10 pr-12 py-3 text-sm
                   focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                   disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
        disabled={disabled}
      />
      <button
        type="button"
        onClick={() => setShowPassword((v) => !v)}
        aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
        className="absolute right-1 top-1/2 -translate-y-1/2 text-neutral-gray hover:text-on-surface
                   p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded
                   focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden="true">
          {showPassword ? 'visibility_off' : 'visibility'}
        </span>
      </button>
    </div>
  );
}
