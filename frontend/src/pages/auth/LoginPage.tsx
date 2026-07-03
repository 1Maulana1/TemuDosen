import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { login } from '../../api/auth';
import type { User } from '../../api/auth';

const ROLES = ['Mahasiswa', 'Dosen', 'Admin', 'Kaprodi'] as const;

function getRoleRedirect(user: User): string {
  switch (user.role) {
    case 'student':  return '/mahasiswa';
    case 'lecturer': return '/dosen';
    case 'admin':    return '/admin/pengguna';
    case 'kaprodi':  return '/kaprodi';
    default:         return '/';
  }
}

export default function LoginPage() {
  const navigate = useNavigate();

  const [activeRole, setActiveRole] = useState<string>('Mahasiswa');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email, password);
      if (!user.is_approved) {
        navigate('/pending-approval', { replace: true });
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
    <div
      className="min-h-screen flex flex-col items-center justify-between px-4 py-10"
      style={{ background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)' }}
    >
      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 mt-8">

        {/* Logo icon */}
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 bg-primary-light rounded-2xl flex items-center justify-center shadow-md">
            <span className="font-headline font-bold text-2xl text-gray-900">T</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="font-headline font-bold text-2xl text-gray-900 text-center">TemuDosen</h1>
        <p className="text-sm text-gray-500 text-center mt-1 mb-6">Platform Bimbingan Skripsi Digital</p>

        {/* Role selector */}
        <div>
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest text-center mb-3">Masuk Sebagai</p>
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1 mb-6">
            {ROLES.map(role => (
              <button
                key={role}
                type="button"
                onClick={() => setActiveRole(role)}
                className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${
                  activeRole === role
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {role}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Email / NIM */}
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-800 mb-1.5">
              NIM / NIDN
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-xl">person</span>
              <input
                id="email"
                type="text"
                autoComplete="username"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Masukkan NIM atau NIDN"
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-primary-light disabled:opacity-50"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="password" className="text-sm font-semibold text-gray-800">Kata Sandi</label>
              <a href="#" className="text-xs font-semibold text-primary hover:underline">Lupa kata sandi?</a>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-xl">lock</span>
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full pl-10 pr-12 py-3 border border-gray-200 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-light focus:border-primary-light disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                aria-label={showPass ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                <span className="material-symbols-outlined text-xl">{showPass ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p role="alert" className="text-error text-sm">{error}</p>
          )}

          {/* CTA */}
          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            className="w-full h-14 bg-primary-light text-gray-900 font-bold text-base rounded-xl shadow-md hover:bg-amber-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
                Memuat...
              </span>
            ) : 'Masuk'}
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400 uppercase tracking-widest">atau</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <p className="text-center text-sm text-gray-500">
          Belum punya akun?{' '}
          <Link to="/register" className="text-primary font-semibold hover:underline">
            Hubungi Admin
          </Link>
        </p>
      </div>

      {/* Footer */}
      <p className="text-xs text-amber-100 text-center mt-6 pb-4">
        © 2024 TemuDosen · Universitas Nusantara. All rights reserved.
        <br />
        Didukung oleh sistem bimbingan digital terintegrasi
      </p>
    </div>
  );
}
