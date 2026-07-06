/**
 * AppNav — unified responsive navigation for every role.
 *
 * Replaces the old split between DashboardNavbar (mahasiswa desktop top bar)
 * and LecturerBottomNav (dosen mobile bottom bar). Both layouts are now driven
 * by one per-role nav config so PC and mobile stay in sync:
 *
 *   - <AppNavbar>    sticky top bar. Nav links show on desktop (md+), hidden on
 *                    mobile. Always shows logo + user + Keluar.
 *   - <AppBottomNav> fixed bottom bar, mobile only (md:hidden). Mirrors the same
 *                    nav items as tappable tabs.
 *
 * A page renders BOTH: the navbar handles desktop, the bottom nav handles mobile.
 * Pages should pad their <main> with `pb-24 md:pb-8` so content clears the mobile
 * bottom bar.
 */
import { Link } from 'react-router';
import { useEffect, useState } from 'react';

export interface NavItem {
  key: string;
  to: string;
  icon: string;
  label: string;
  /** When true the tab is a placeholder (page not built yet) — rendered disabled. */
  disabled?: boolean;
}

export type AppRole = 'mahasiswa' | 'dosen' | 'admin' | 'ketua-jurusan';

/** Per-role navigation. Keep `key` stable — pages pass it as `active`. */
export const NAV_ITEMS: Record<AppRole, NavItem[]> = {
  mahasiswa: [
    { key: 'beranda', to: '/mahasiswa', icon: 'home', label: 'Beranda' },
    { key: 'ajukan', to: '/mahasiswa/ajukan', icon: 'add_circle', label: 'Ajukan' },
    { key: 'antrean', to: '/mahasiswa/queue', icon: 'format_list_numbered', label: 'Antrean' },
    { key: 'riwayat', to: '/mahasiswa/riwayat', icon: 'history', label: 'Riwayat' },
    { key: 'profil', to: '/mahasiswa/profil', icon: 'person', label: 'Profil' },
  ],
  dosen: [
    { key: 'beranda', to: '/dosen', icon: 'home', label: 'Beranda' },
    { key: 'permintaan', to: '/dosen/requests', icon: 'inbox', label: 'Permintaan' },
    { key: 'antrian', to: '/dosen/queue', icon: 'format_list_numbered', label: 'Antrian' },
    { key: 'riwayat', to: '/dosen/riwayat', icon: 'history', label: 'Riwayat' },
    { key: 'saran', to: '/dosen/saran', icon: 'checklist', label: 'Saran' },
    { key: 'profil', to: '/dosen/pengaturan', icon: 'person', label: 'Profil' },
  ],
  admin: [
    { key: 'beranda', to: '/admin', icon: 'dashboard', label: 'Beranda' },
    { key: 'pengguna', to: '/admin/pengguna', icon: 'manage_accounts', label: 'Pengguna' },
    { key: 'gejala', to: '/admin/katalog-gejala', icon: 'category', label: 'Gejala' },
    { key: 'log', to: '/admin/logs', icon: 'receipt_long', label: 'Log' },
  ],
  'ketua-jurusan': [
    { key: 'beranda', to: '/ketua-jurusan', icon: 'monitoring', label: 'Laporan' },
  ],
};

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

interface AppNavbarProps {
  items: NavItem[];
  active: string;
  userName: string;
  onLogout: () => void;
  /** Optional suffix after the "TemuDosen" wordmark, e.g. "Admin". */
  brandSuffix?: string;
}

export function AppNavbar({ items, active, userName, onLogout, brandSuffix }: AppNavbarProps) {
  const [notice, setNotice] = useState(false);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(false), 3000);
    return () => clearTimeout(t);
  }, [notice]);

  return (
    <header className="sticky top-0 z-40 bg-surface border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-8 min-w-0">
          <span className="font-headline font-bold text-xl text-primary flex-shrink-0">
            TemuDosen{brandSuffix ? <span className="text-on-surface-variant font-normal"> · {brandSuffix}</span> : null}
          </span>
          <nav className="hidden md:flex items-center gap-6" aria-label="Navigasi utama">
            {items.map((item) => {
              if (item.disabled) {
                return (
                  <span key={item.key} className="text-sm font-bold text-on-surface-variant/40 opacity-60 cursor-not-allowed select-none" title="Segera hadir" aria-disabled="true">
                    {item.label}
                  </span>
                );
              }
              const isActive = item.key === active;
              return (
                <Link
                  key={item.key}
                  to={item.to}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    'text-sm font-bold border-b-2 pb-1 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded',
                    isActive
                      ? 'text-primary border-primary'
                      : 'text-on-surface-variant border-transparent hover:text-primary',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0 relative">
          <button
            type="button"
            aria-label="Notifikasi (segera hadir)"
            title="Fitur notifikasi segera hadir"
            onClick={() => setNotice(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <span className="material-symbols-outlined text-xl" aria-hidden="true">notifications</span>
          </button>

          {notice && (
            <div role="status" aria-live="polite" className="absolute top-12 right-0 z-50 whitespace-nowrap rounded-lg bg-slate-800 text-white text-xs font-bold px-3 py-2 shadow-lg">
              Notifikasi belum tersedia.
            </div>
          )}

          <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-on-primary font-bold text-xs flex-shrink-0">
              {initials(userName) || '?'}
            </div>
            <span className="hidden sm:inline text-sm font-bold text-slate-800 truncate max-w-[160px]">{userName}</span>
          </div>

          <button
            type="button"
            onClick={onLogout}
            className="text-sm font-bold text-on-surface-variant hover:text-error transition-colors min-h-[44px] px-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
          >
            Keluar
          </button>
        </div>
      </div>
    </header>
  );
}

interface AppBottomNavProps {
  items: NavItem[];
  active: string;
}

/** Mobile-only bottom tab bar. Hidden on desktop (md+), where AppNavbar takes over. */
export function AppBottomNav({ items, active }: AppBottomNavProps) {
  // A single-item nav (e.g. ketua jurusan) needs no bottom bar.
  if (items.length < 2) return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex justify-around bg-surface border-t border-gray-200 px-2 py-2 max-w-md mx-auto rounded-t-xl">
      {items.map((item) => {
        const isActive = item.key === active;
        if (item.disabled) {
          return (
            <span key={item.key} className="flex flex-col items-center text-gray-300 min-h-[44px] min-w-[44px] justify-center cursor-not-allowed" title="Segera hadir" aria-disabled="true">
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              <span className="text-[11px]">{item.label}</span>
            </span>
          );
        }
        if (isActive) {
          return (
            <span key={item.key} aria-current="page" className="flex flex-col items-center text-primary min-h-[44px] min-w-[44px] justify-center">
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
              <span className="text-[11px] font-bold">{item.label}</span>
            </span>
          );
        }
        return (
          <Link key={item.key} to={item.to} className="flex flex-col items-center text-gray-400 hover:text-primary min-h-[44px] min-w-[44px] justify-center focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded">
            <span className="material-symbols-outlined text-xl">{item.icon}</span>
            <span className="text-[11px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
