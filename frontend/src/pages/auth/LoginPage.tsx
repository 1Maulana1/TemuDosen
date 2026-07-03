/**
 * Login page — S-04 from UI-SPEC.
 *
 * Elements:
 * - TemuDosen wordmark (text-primary font-headline font-bold text-2xl)
 * - Email input (with mail icon)
 * - Password input (with lock icon + show/hide toggle)
 * - "Masuk ke Akun" primary CTA (full-width, bg-primary)
 * - "Belum punya akun? Daftar" link (text-primary text-sm font-bold)
 *
 * Visual style aligned to Referensi Tampilan/login_temudosen mockup (amber gradient background,
 * icon inputs). Role tabs and "Lupa kata sandi?" from the mockup are intentionally omitted —
 * role is server-derived from credentials, and password reset isn't implemented in this MVP.
 *
 * On submit: calls auth.login(), then redirects by role.
 */
import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { login } from '../../api/auth';
import { getRoleRedirect } from './roleRedirect';

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen bg-[image:var(--gradient-auth)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-surface rounded-2xl shadow-2xl border border-neutral-gray/20 p-10">
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
              <label
                htmlFor="password"
                className="block text-sm font-bold text-slate-800 mb-1"
              >
                Password
              </label>
              <div className="relative">
                <span
                  className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-gray text-[20px]"
                  aria-hidden="true"
                >
                  lock
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  aria-required="true"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-gray-200 bg-white rounded-xl pl-10 pr-12 py-3 text-sm
                             focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
                             disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                  disabled={loading}
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
