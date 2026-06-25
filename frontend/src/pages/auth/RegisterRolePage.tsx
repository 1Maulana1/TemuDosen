/**
 * RegisterRolePage (S-01) — role selection for self-registration.
 *
 * Per D-17: self-registration only, NO SSO button.
 * Two role cards (Mahasiswa / Dosen) navigate to the appropriate form.
 * Selected state: border-2 border-primary bg-primary/5.
 */
import { useState } from 'react';
import { useNavigate, Link } from 'react-router';

type Role = 'mahasiswa' | 'dosen';

export default function RegisterRolePage() {
  const [selected, setSelected] = useState<Role | null>(null);
  const navigate = useNavigate();

  function handleContinue() {
    if (selected === 'mahasiswa') {
      navigate('/register/mahasiswa');
    } else if (selected === 'dosen') {
      navigate('/register/dosen');
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand header */}
        <header className="text-center mb-10">
          <div className="mb-4 inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-2xl">
            <span className="material-symbols-outlined text-primary text-4xl">school</span>
          </div>
          <h1 className="font-headline font-bold text-2xl text-primary tracking-tight mb-2">
            TemuDosen
          </h1>
          <p className="text-slate-500 text-sm font-body">
            Platform Dokumentasi &amp; Kontinuitas Bimbingan
          </p>
        </header>

        {/* Page title */}
        <h2 className="font-headline font-bold text-lg text-slate-800 text-center mb-6">
          Pilih Peran Anda
        </h2>

        {/* Role cards */}
        <div className="space-y-4 mb-8">
          {/* Mahasiswa card */}
          <button
            type="button"
            onClick={() => setSelected('mahasiswa')}
            aria-pressed={selected === 'mahasiswa'}
            className={`w-full flex items-center p-4 bg-white rounded-xl shadow-sm text-left transition-all duration-150 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
              selected === 'mahasiswa'
                ? 'border-2 border-primary bg-primary/5'
                : 'border border-gray-200 hover:border-primary/50'
            }`}
          >
            <div className="p-2.5 bg-blue-50 rounded-lg mr-4 flex-shrink-0">
              <span className="material-symbols-outlined text-primary">school</span>
            </div>
            <div className="flex-grow">
              <h3 className="font-headline font-bold text-slate-800 text-base">Mahasiswa</h3>
              <p className="text-slate-500 text-sm font-body">Ajukan &amp; pantau bimbingan</p>
            </div>
            {selected === 'mahasiswa' && (
              <span className="material-symbols-outlined text-primary ml-2">check_circle</span>
            )}
          </button>

          {/* Dosen card */}
          <button
            type="button"
            onClick={() => setSelected('dosen')}
            aria-pressed={selected === 'dosen'}
            className={`w-full flex items-center p-4 bg-white rounded-xl shadow-sm text-left transition-all duration-150 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
              selected === 'dosen'
                ? 'border-2 border-primary bg-primary/5'
                : 'border border-gray-200 hover:border-primary/50'
            }`}
          >
            <div className="p-2.5 bg-green-50 rounded-lg mr-4 flex-shrink-0">
              <span className="material-symbols-outlined text-success">person_search</span>
            </div>
            <div className="flex-grow">
              <h3 className="font-headline font-bold text-slate-800 text-base">Dosen</h3>
              <p className="text-slate-500 text-sm font-body">Kelola antrean &amp; rekam sesi</p>
            </div>
            {selected === 'dosen' && (
              <span className="material-symbols-outlined text-primary ml-2">check_circle</span>
            )}
          </button>
        </div>

        {/* CTA button */}
        <button
          type="button"
          onClick={handleContinue}
          disabled={selected === null}
          className="bg-primary text-white w-full py-4 rounded-xl font-bold text-sm font-body shadow-xl shadow-primary/25 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
        >
          Daftar sebagai {selected === 'mahasiswa' ? 'Mahasiswa' : selected === 'dosen' ? 'Dosen' : '...'}
        </button>

        {/* Login link */}
        <p className="text-center mt-6 text-sm font-body text-slate-500">
          Sudah punya akun?{' '}
          <Link
            to="/login"
            className="text-primary font-bold focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
          >
            Masuk
          </Link>
        </p>
      </div>
    </main>
  );
}
