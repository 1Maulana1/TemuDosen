/**
 * StudentProfile — /mahasiswa/profil
 *
 * Layout: gradient identity hero (full width) → 2 kolom seimbang (Informasi Akun
 * | Dosen Pembimbing) di desktop → tombol Keluar. Read-only untuk saat ini.
 */
import { useNavigate, useRouteLoaderData } from 'react-router';
import { logout, type User } from '../../api/auth';
import { AppNavbar, AppBottomNav, NAV_ITEMS } from '../../components/AppNav';

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

export default function StudentProfile() {
  const user = useRouteLoaderData('mahasiswa') as User;
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  const adviser = user?.adviser ?? null;

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <AppNavbar items={NAV_ITEMS.mahasiswa} active="profil" userName={user?.full_name ?? 'Mahasiswa'} onLogout={handleLogout} />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-8 space-y-5">
        <h1 className="font-headline font-bold text-2xl text-on-surface">Profil Saya</h1>

        {/* Identity hero — full width */}
        <section className="rounded-2xl shadow-sm p-6 flex items-center gap-4 bg-gradient-to-br from-primary to-primary-hover">
          <div className="w-16 h-16 rounded-full bg-white/20 ring-2 ring-white/40 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
            {initials(user?.full_name ?? 'M') || '?'}
          </div>
          <div className="min-w-0">
            <p className="font-headline font-bold text-lg text-white truncate">{user?.full_name}</p>
            <p className="text-sm text-white/80 truncate">{user?.email}</p>
            <span className="inline-block mt-1.5 text-[11px] font-bold text-white bg-white/20 rounded-full px-2 py-0.5">Mahasiswa</span>
          </div>
        </section>

        {/* Info + Dosen side by side, equal columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
          {/* Informasi Akun */}
          <section>
            <h2 className="font-headline font-bold text-lg text-slate-900 mb-3">Informasi Akun</h2>
            <div className="bg-surface rounded-2xl border border-gray-200 shadow-sm divide-y divide-gray-100">
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm text-on-surface-variant">NIM</span>
                <span className="text-sm font-bold text-slate-800">{user?.nim ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm text-on-surface-variant">Email</span>
                <span className="text-sm font-bold text-slate-800 truncate ml-4">{user?.email}</span>
              </div>
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm text-on-surface-variant">Peran</span>
                <span className="text-sm font-bold text-slate-800">Mahasiswa</span>
              </div>
            </div>
          </section>

          {/* Dosen Pembimbing */}
          <section>
            <h2 className="font-headline font-bold text-lg text-slate-900 mb-3">Dosen Pembimbing</h2>
            <div className="bg-surface rounded-2xl border border-gray-200 shadow-sm p-5">
              {adviser ? (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold flex-shrink-0">
                    {initials(adviser.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-slate-900 truncate">{adviser.full_name}</p>
                    {adviser.nidn && <p className="text-[11px] text-on-surface-variant">NIDN {adviser.nidn}</p>}
                  </div>
                  {adviser.email && (
                    <a href={`mailto:${adviser.email}`}
                      className="px-3 py-2 border border-primary text-accent-link text-xs font-bold rounded-lg hover:bg-primary/10 min-h-[44px] flex items-center gap-1 flex-shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
                      <span className="material-symbols-outlined text-base" aria-hidden="true">mail</span>
                      Email
                    </a>
                  )}
                </div>
              ) : (
                <div className="py-4 flex flex-col items-center text-center">
                  <span className="material-symbols-outlined text-gray-300 text-3xl mb-1" aria-hidden="true">person_off</span>
                  <p className="text-sm text-on-surface-variant">Belum ada dosen pembimbing yang ditetapkan.</p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Logout */}
        <button type="button" onClick={handleLogout}
          className="w-full sm:max-w-xs py-3 rounded-xl border border-error/30 text-error text-sm font-bold hover:bg-error/5 min-h-[44px] flex items-center justify-center gap-2 focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none">
          <span className="material-symbols-outlined text-base" aria-hidden="true">logout</span>
          Keluar
        </button>
      </main>

      <AppBottomNav items={NAV_ITEMS.mahasiswa} active="profil" />
    </div>
  );
}
