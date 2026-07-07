/**
 * NotificationBell — real in-app notification bell (audit G2). Replaces the old
 * "Notifikasi belum tersedia" placeholder in AppNavbar. Reads /api/notifications/.
 */
import { useState, useEffect, useRef } from 'react';
import {
  getNotifications, markNotificationRead, markAllNotificationsRead,
  type AppNotification,
} from '../api/notifications';

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const load = () => {
    getNotifications()
      .then((d) => { setItems(d.notifications); setUnread(d.unread_count); })
      .catch(() => {});
  };

  useEffect(() => { load(); }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next) load();
  }

  async function handleReadOne(n: AppNotification) {
    if (n.is_read) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
    try { await markNotificationRead(n.id); } catch { /* revert silently on next load */ }
  }

  async function handleReadAll() {
    setItems((prev) => prev.map((x) => ({ ...x, is_read: true })));
    setUnread(0);
    try { await markAllNotificationsRead(); } catch { /* ignore */ }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={`Notifikasi${unread > 0 ? ` (${unread} belum dibaca)` : ''}`}
        aria-expanded={open}
        onClick={handleOpen}
        className="relative w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
      >
        <span className="material-symbols-outlined text-xl" aria-hidden="true">notifications</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-12 right-0 z-50 w-80 max-w-[90vw] bg-surface rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
            <span className="font-bold text-sm text-slate-900">Notifikasi</span>
            {unread > 0 && (
              <button type="button" onClick={handleReadAll} className="text-[11px] font-bold text-primary hover:underline">
                Tandai semua terbaca
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100">
            {items.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-on-surface-variant">Belum ada notifikasi.</li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleReadOne(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${n.is_read ? '' : 'bg-primary/5'}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.is_read && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary flex-shrink-0" aria-hidden="true" />}
                      <div className={n.is_read ? 'pl-4' : ''}>
                        <p className="text-sm text-slate-700">{n.message}</p>
                        <p className="text-[11px] text-on-surface-variant mt-0.5">{fmt(n.created_at)}</p>
                      </div>
                    </div>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
