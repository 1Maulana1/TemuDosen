/**
 * DashboardNavbar — top navbar shared by mahasiswa dashboard pages.
 *
 * "Riwayat Sesi" & "Profil" are rendered as disabled placeholders — those pages
 * don't exist yet in router.tsx (out of scope for this task). Only "Dashboard"
 * is a real, active link.
 */
import { Link } from 'react-router';

interface DashboardNavbarProps {
  userName: string;
  onLogout: () => void;
}

export default function DashboardNavbar({ userName, onLogout }: DashboardNavbarProps) {
  const initials = userName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-8 min-w-0">
          <span className="font-headline font-bold text-xl text-primary flex-shrink-0">TemuDosen</span>
          <nav className="hidden md:flex items-center gap-6" aria-label="Navigasi utama">
            <Link to="/mahasiswa" className="text-sm font-bold text-primary border-b-2 border-primary pb-[18px] -mb-[1px]">
              Dashboard
            </Link>
            <span
              className="text-sm font-bold text-on-surface-variant/50 cursor-not-allowed"
              title="Segera hadir"
            >
              Riwayat Sesi
            </span>
            <span
              className="text-sm font-bold text-on-surface-variant/50 cursor-not-allowed"
              title="Segera hadir"
            >
              Profil
            </span>
          </nav>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            type="button"
            aria-label="Notifikasi"
            title="Notifikasi"
            className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <span className="material-symbols-outlined text-xl" aria-hidden="true">notifications</span>
          </button>

          <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs flex-shrink-0">
              {initials || '?'}
            </div>
            <span className="hidden sm:inline text-sm font-bold text-slate-800 truncate max-w-[140px]">
              {userName}
            </span>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="text-sm font-bold text-on-surface-variant hover:text-error transition-colors min-h-[44px] px-2
                       focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
          >
            Keluar
          </button>
        </div>
      </div>
    </header>
  );
}
