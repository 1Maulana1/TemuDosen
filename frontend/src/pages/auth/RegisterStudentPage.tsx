/**
 * RegisterStudentPage (S-02) — student self-registration form.
 *
 * Fields (D-22): NIM, Nama Lengkap, Email, Password (show/hide), Pilih Dosen Pembimbing.
 * Adviser dropdown populated from fetchLecturers() — approved only (Pitfall 7, D-24).
 * CTA: "Daftar Sekarang"
 * Required fields marked with * (text-error) and aria-required="true".
 * Inline validation errors linked via aria-describedby.
 */
import { useState, useEffect, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { register, fetchLecturers } from '../../api/users';
import type { LecturerOption, RegisterError } from '../../api/users';

export default function RegisterStudentPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    nim: '',
    full_name: '',
    email: '',
    password: '',
    adviser_id: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [lecturers, setLecturers] = useState<LecturerOption[]>([]);
  const [errors, setErrors] = useState<RegisterError>({});
  const [loading, setLoading] = useState(false);
  const [loadingLecturers, setLoadingLecturers] = useState(true);

  // Load approved lecturers on mount (Pitfall 7: only approved lecturers)
  useEffect(() => {
    fetchLecturers()
      .then(setLecturers)
      .catch(() => setLecturers([]))
      .finally(() => setLoadingLecturers(false));
  }, []);

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear field error on change
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
    if (!form.nim) fieldErrors.nim = ['Kolom ini wajib diisi.'];
    if (!form.full_name) fieldErrors.full_name = ['Kolom ini wajib diisi.'];
    if (!form.email) fieldErrors.email = ['Kolom ini wajib diisi.'];
    if (!form.password) fieldErrors.password = ['Kolom ini wajib diisi.'];
    if (!form.adviser_id) fieldErrors.adviser_id = ['Kolom ini wajib diisi.'];

    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      await register({
        role: 'student',
        nim: form.nim,
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        adviser_id: parseInt(form.adviser_id, 10),
      });
      // Registration successful — redirect to login (or pending-approval after auto-login)
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
  const inputError =
    'border-error ring-2 ring-error/20';

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="font-headline font-bold text-2xl text-primary">TemuDosen</h1>
          <p className="text-slate-500 text-sm font-body mt-1">Daftar sebagai Mahasiswa</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {errors.non_field_errors && (
            <div className="mb-4 p-3 bg-error/5 border border-error/20 rounded-xl text-sm text-error font-body">
              {errors.non_field_errors[0]}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* NIM */}
            <div className="mb-4">
              <label htmlFor="nim" className="block text-sm font-bold text-slate-800 mb-1 font-body">
                NIM <span className="text-error" aria-hidden="true">*</span>
              </label>
              <input
                id="nim"
                name="nim"
                type="text"
                value={form.nim}
                onChange={handleChange}
                aria-required="true"
                aria-describedby={errors.nim ? 'nim-error' : undefined}
                className={`${inputBase} ${errors.nim ? inputError : ''}`}
                placeholder="Masukkan NIM Anda"
              />
              {errors.nim && (
                <p id="nim-error" className="mt-1 text-[11px] text-error font-body">
                  {errors.nim[0]}
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
            <div className="mb-4">
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

            {/* Dosen Pembimbing dropdown */}
            <div className="mb-6">
              <label htmlFor="adviser_id" className="block text-sm font-bold text-slate-800 mb-1 font-body">
                Pilih Dosen Pembimbing <span className="text-error" aria-hidden="true">*</span>
              </label>
              <select
                id="adviser_id"
                name="adviser_id"
                value={form.adviser_id}
                onChange={handleChange}
                aria-required="true"
                aria-describedby={errors.adviser_id ? 'adviser-error' : undefined}
                disabled={loadingLecturers}
                className={`${inputBase} ${errors.adviser_id ? inputError : ''} disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed`}
              >
                <option value="">
                  {loadingLecturers ? 'Memuat daftar dosen...' : 'Pilih dosen pembimbing'}
                </option>
                {lecturers.map((lec) => (
                  <option key={lec.id} value={lec.id}>
                    {lec.full_name}
                  </option>
                ))}
              </select>
              {errors.adviser_id && (
                <p id="adviser-error" className="mt-1 text-[11px] text-error font-body">
                  {errors.adviser_id[0]}
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

        {/* Back to role selection */}
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
