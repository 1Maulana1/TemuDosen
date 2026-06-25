/**
 * RegisterLecturerPage (S-03) — lecturer self-registration form.
 *
 * Fields (D-23): NIDN, Nama Lengkap, Email, Password (show/hide).
 * CTA: "Daftar Sekarang"
 * Required fields marked with * (text-error) and aria-required="true".
 * Inline validation errors linked via aria-describedby.
 */
import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { register } from '../../api/users';
import type { RegisterError } from '../../api/users';

export default function RegisterLecturerPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nidn: '',
    full_name: '',
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<RegisterError>({});
  const [loading, setLoading] = useState(false);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    // Client-side required-field validation
    const fieldErrors: RegisterError = {};
    if (!form.nidn) fieldErrors.nidn = ['Kolom ini wajib diisi.'];
    if (!form.full_name) fieldErrors.full_name = ['Kolom ini wajib diisi.'];
    if (!form.email) fieldErrors.email = ['Kolom ini wajib diisi.'];
    if (!form.password) fieldErrors.password = ['Kolom ini wajib diisi.'];

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      await register({
        role: 'lecturer',
        nidn: form.nidn,
        full_name: form.full_name,
        email: form.email,
        password: form.password,
      });
      navigate('/login?registered=1');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errors' in err) {
        setErrors((err as { errors: RegisterError }).errors);
      } else {
        setErrors({ non_field_errors: ['Terjadi kesalahan. Silakan coba lagi.'] });
      }
    } finally {
      setLoading(false);
    }
  }

  const inputBase =
    'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-body text-slate-800 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none';
  const inputError = 'border-error ring-2 ring-error/20';

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="font-headline font-bold text-2xl text-primary">TemuDosen</h1>
          <p className="text-slate-500 text-sm font-body mt-1">Daftar sebagai Dosen</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {errors.non_field_errors && (
            <div className="mb-4 p-3 bg-error/5 border border-error/20 rounded-xl text-sm text-error font-body">
              {errors.non_field_errors[0]}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* NIDN */}
            <div className="mb-4">
              <label htmlFor="nidn" className="block text-sm font-bold text-slate-800 mb-1 font-body">
                NIDN <span className="text-error" aria-hidden="true">*</span>
              </label>
              <input
                id="nidn"
                name="nidn"
                type="text"
                value={form.nidn}
                onChange={handleChange}
                aria-required="true"
                aria-describedby={errors.nidn ? 'nidn-error' : undefined}
                className={`${inputBase} ${errors.nidn ? inputError : ''}`}
                placeholder="Masukkan NIDN Anda"
              />
              {errors.nidn && (
                <p id="nidn-error" className="mt-1 text-[11px] text-error font-body">
                  {errors.nidn[0]}
                </p>
              )}
            </div>

            {/* Nama Lengkap */}
            <div className="mb-4">
              <label htmlFor="full_name" className="block text-sm font-bold text-slate-800 mb-1 font-body">
                Nama Lengkap <span className="text-error" aria-hidden="true">*</span>
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                value={form.full_name}
                onChange={handleChange}
                aria-required="true"
                aria-describedby={errors.full_name ? 'full_name-error' : undefined}
                className={`${inputBase} ${errors.full_name ? inputError : ''}`}
                placeholder="Masukkan nama lengkap"
              />
              {errors.full_name && (
                <p id="full_name-error" className="mt-1 text-[11px] text-error font-body">
                  {errors.full_name[0]}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-bold text-slate-800 mb-1 font-body">
                Email <span className="text-error" aria-hidden="true">*</span>
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                aria-required="true"
                aria-describedby={errors.email ? 'email-error' : undefined}
                className={`${inputBase} ${errors.email ? inputError : ''}`}
                placeholder="email@universitas.ac.id"
              />
              {errors.email && (
                <p id="email-error" className="mt-1 text-[11px] text-error font-body">
                  {errors.email[0]}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="mb-6">
              <label htmlFor="password" className="block text-sm font-bold text-slate-800 mb-1 font-body">
                Password <span className="text-error" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  aria-required="true"
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className={`${inputBase} pr-12 ${errors.password ? inputError : ''}`}
                  placeholder="Minimal 6 karakter"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {errors.password && (
                <p id="password-error" className="mt-1 text-[11px] text-error font-body">
                  {errors.password[0]}
                </p>
              )}
            </div>

            {/* Submit CTA */}
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="bg-primary text-white w-full py-4 rounded-xl font-bold text-sm font-body shadow-xl shadow-primary/25 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined animate-spin text-base">autorenew</span>
                  Mendaftar...
                </span>
              ) : (
                'Daftar Sekarang'
              )}
            </button>
          </form>
        </div>

        {/* Back link */}
        <p className="text-center mt-6 text-sm font-body text-slate-500">
          <Link
            to="/register"
            className="text-primary font-bold focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
          >
            ← Kembali ke pilihan peran
          </Link>
        </p>
      </div>
    </main>
  );
}
