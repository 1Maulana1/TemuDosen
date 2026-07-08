/**
 * Per-user in-app notifications (audit G2). Backed by /api/notifications/.
 */
import { apiRequest } from './client';

export interface AppNotification {
  id: number;
  event_type: string;
  message: string;
  session_id: number | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationList {
  unread_count: number;
  notifications: AppNotification[];
}

export async function getNotifications(): Promise<NotificationList> {
  const res = await apiRequest('/api/notifications/');
  if (!res.ok) throw new Error('Gagal memuat notifikasi.');
  return res.json();
}

export async function markNotificationRead(id: number): Promise<void> {
  const res = await apiRequest(`/api/notifications/${id}/read/`, { method: 'POST' });
  if (!res.ok) throw new Error('Gagal menandai notifikasi.');
}

export async function markAllNotificationsRead(): Promise<number> {
  const res = await apiRequest('/api/notifications/read-all/', { method: 'POST' });
  if (!res.ok) throw new Error('Gagal menandai semua notifikasi.');
  const body = await res.json();
  return body.marked_read ?? 0;
}
