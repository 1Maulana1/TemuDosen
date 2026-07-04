/**
 * LecturerBottomNav — shared bottom navigation for dosen pages.
 *
 * Extracted from the duplicated bottom-nav markup in LecturerDashboard,
 * LecturerRequests, and LecturerQueue (S-08 follow-up: fix inconsistent
 * nav across dosen screens). Renders the 4 standard items — Beranda,
 * Permintaan, Antrian, Profil — and highlights whichever one matches the
 * current route via the `active` prop.
 */
import { Link } from 'react-router';

export type LecturerNavItem = 'beranda' | 'permintaan' | 'antrian' | 'profil';

interface LecturerBottomNavProps {
  active: LecturerNavItem;
}

const ITEMS: { key: LecturerNavItem; to: string; icon: string; label: string }[] = [
  { key: 'beranda', to: '/dosen', icon: 'home', label: 'Beranda' },
  { key: 'permintaan', to: '/dosen/requests', icon: 'inbox', label: 'Permintaan' },
  { key: 'antrian', to: '/dosen/queue', icon: 'format_list_numbered', label: 'Antrian' },
  { key: 'profil', to: '/dosen/pengaturan', icon: 'person', label: 'Profil' },
];

export default function LecturerBottomNav({ active }: LecturerBottomNavProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-around bg-white border-t border-gray-200 px-2 py-3 rounded-t-xl max-w-md mx-auto">
      {ITEMS.map((item) => {
        const isActive = item.key === active;
        if (isActive) {
          return (
            <button
              key={item.key}
              type="button"
              aria-current="page"
              className="flex flex-col items-center text-primary min-h-[44px] min-w-[44px]"
            >
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                {item.icon}
              </span>
              <span className="text-[11px] font-bold">{item.label}</span>
            </button>
          );
        }
        return (
          <Link
            key={item.key}
            to={item.to}
            className="flex flex-col items-center text-gray-400 hover:text-primary min-h-[44px] min-w-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
          >
            <span className="material-symbols-outlined text-xl">{item.icon}</span>
            <span className="text-[11px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
