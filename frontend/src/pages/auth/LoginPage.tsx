/**
 * Login page — S-04 from UI-SPEC.
 *
 * Elements:
 * - TemuDosen wordmark (text-primary font-headline font-bold text-2xl)
 * - Email input
 * - Password input
 * - "Masuk ke Akun" primary CTA (full-width, bg-primary)
 * - "Belum punya akun? Daftar" link (text-primary text-sm font-bold)
 *
 * On submit: calls auth.login(), then redirects by role.
 */
import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { login } from '../../api/auth';
import type { User } from '../../api/auth';

function getRoleRedirect(user: User): string {
  switch (user.role) {
    case 'student':
      return '/mahasiswa';
    case 'lecturer':
      return '/dosen';
    case 'admin':
      return '/admin/pengguna';
    case 'kaprodi':
      return '/';
    default:
      return '/';
  }
}

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const user = await login(email, password);

      // Unapproved users see the pending-approval page (D-20)
      if (!user.is_approved) {
        navigate('/pending-approval', { replace: true });
        return;
      }

      // Redirect by role
      const target = getRoleRedirect(user);
      navigate(target, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-surface rounded-2xl shadow-sm border border-neutral-gray/20 p-8">
          {/* Wordmark */}
          <h1 className="font-headline font-bold text-2xl text-primary text-center mb-8">
            TemuDosen
          </h1>

          <form onSubmit={handleSubmit} noValidate>
            {/* Email */}
            <div className="mb-4">
              <label
                htmlFor="email"
                className="block text-sm font-bold text-slate-800 mb-1"
              >
                Email
              </label>
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
                className="w-full border border-gray-200 bg-white rounded-xl px-4 py-3 text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                           disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div className="mb-6">
              <label
                htmlFor="password"
                className="block text-sm font-bold text-slate-800 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                aria-required="true"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-200 bg-white rounded-xl px-4 py-3 text-sm
                           focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                           disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                disabled={loading}
              />
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

            {/* Primary CTA */}
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="w-full bg-primary text-white font-bold text-sm py-4 rounded-xl
                         shadow-xl shadow-primary/25 active:scale-[0.98] transition-all
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

          {/* Register link */}
          <p className="text-center mt-4 text-sm text-on-surface-variant">
            Belum punya akun?{' '}
            <Link
              to="/register"
              className="text-primary font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              Daftar
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
