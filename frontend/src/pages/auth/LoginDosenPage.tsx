/**
 * LoginDosenPage — /login/dosen
 *
 * Role-specific login page for lecturers. Field is Email + Password (backend
 * only supports email-based auth via POST /api/auth/login/ — decided during
 * audit; a NIDN→email lookup via GET /api/users/lecturers/ was considered
 * but not built since the final decision was email+password for all roles).
 *
 * Design and auth flow copied from LoginPage.tsx (not reinvented). Only the
 * title and cross-role navigation links differ.
 */
import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { login } from '../../api/auth';
import type { User } from '../../api/auth';
import PasswordInput from '../../components/PasswordInput';
import BrandLogo from '../../components/BrandLogo';
import { getRoleRedirect } from './roleRedirect';

// This page only accepts 'lecturer' accounts. Actual role values confirmed
// against the User type in api/auth.ts — do not hardcode without checking.
const EXPECTED_ROLE: User['role'] = 'lecturer';

const ROLE_INFO: Partial<Record<User['role'], { label: string; path: string }>> = {
  student: { label: 'Mahasiswa', path: '/login/mahasiswa' },
  lecturer: { label: 'Dosen', path: '/login/dosen' },
  ketua_jurusan: { label: 'Ketua Jurusan', path: '/login/ketua-jurusan' },
};

export default function LoginDosenPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [roleMismatch, setRoleMismatch] = useState<{ label: string; path: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setRoleMismatch(null);
    setLoading(true);

    try {
      const user = await login(email, password);

      if (!user.is_approved) {
        navigate('/pending-approval', { replace: true });
        return;
      }

      if (user.role !== EXPECTED_ROLE) {
        setRoleMismatch(ROLE_INFO[user.role] ?? null);
        return;
      }

      navigate(getRoleRedirect(user), { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[image:var(--gradient-auth)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="bg-surface rounded-2xl shadow-2xl border border-neutral-gray/20 p-10">
          <h1 className="text-center mb-1">
            <BrandLogo textClassName="text-2xl" />
          </h1>
          <p className="text-center text-sm font-bold text-slate-800 mb-8">Login Dosen</p>

          <form onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-bold text-slate-800 mb-1">
                Email
              </label>
              <div className="relative">
                <span
                  className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-gray text-[20px]"
                  aria-hidden="true"
                >
                  mail
                </span>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  aria-required="true"
                  aria-describedby={error ? 'login-error' : undefined}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@kampus.ac.id"
                  className="w-full border border-gray-200 bg-white rounded-xl pl-10 pr-4 py-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                             disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-6">
              <label htmlFor="password" className="block text-sm font-bold text-slate-800 mb-1">
                Password
              </label>
              <PasswordInput id="password" value={password} onChange={setPassword} disabled={loading} />
            </div>

            {/* Error message */}
            {error && (
              <p
                id="login-error"
                role="alert"
                aria-live="polite"
                className="text-error text-sm mb-4"
              >
                {error}
              </p>
            )}

            {/* Role mismatch — account exists but isn't a dosen account */}
            {roleMismatch && (
              <div
                role="alert"
                aria-live="polite"
                className="mb-4 rounded-xl bg-warning-bg px-4 py-3 text-sm text-warning-text"
              >
                <p>Akun ini bukan akun dosen. Silakan login di halaman yang sesuai.</p>
                <Link
                  to={roleMismatch.path}
                  className="mt-1 inline-block font-bold underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                >
                  Login sebagai {roleMismatch.label}
                </Link>
              </div>
            )}

            {/* Primary CTA */}
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="w-full bg-primary text-on-primary font-bold text-sm py-4 rounded-xl
                         shadow-xl shadow-primary/25 hover:bg-primary-hover active:scale-[0.98] transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed
                         min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="material-symbols-outlined animate-spin text-base"
                    aria-hidden="true"
                  >
                    progress_activity
                  </span>
                  Memuat...
                </span>
              ) : (
                'Masuk ke Akun'
              )}
            </button>
          </form>

          {/* Cross-role navigation */}
          <div className="mt-6 flex flex-col items-center gap-2 text-sm">
            <Link
              to="/login/mahasiswa"
              className="text-accent-link font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              Login sebagai Mahasiswa
            </Link>
            <Link
              to="/login/ketua-jurusan"
              className="text-accent-link font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              Login sebagai Ketua Jurusan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
