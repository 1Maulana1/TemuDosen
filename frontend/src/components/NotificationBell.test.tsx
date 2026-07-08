/**
 * Vitest test for NotificationBell (audit G2): unread badge, dropdown list, and
 * mark-all-read.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/setup';
import NotificationBell from './NotificationBell';

describe('NotificationBell', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/notifications/', () =>
        HttpResponse.json({
          unread_count: 2,
          notifications: [
            { id: 1, event_type: 'APPROVED', message: 'Pengajuan disetujui', session_id: null, is_read: false, created_at: '2026-07-07T09:00:00Z' },
            { id: 2, event_type: 'ADVICE_ADDED', message: 'Ada saran baru', session_id: 7, is_read: true, created_at: '2026-07-06T09:00:00Z' },
          ],
        })
      )
    );
  });

  it('shows the unread badge and lists notifications when opened', async () => {
    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Notifikasi/i }));
    await waitFor(() => expect(screen.getByText('Pengajuan disetujui')).toBeInTheDocument());
    expect(screen.getByText('Ada saran baru')).toBeInTheDocument();
  });

  it('marks all read and clears the badge', async () => {
    server.use(http.post('/api/notifications/read-all/', () => HttpResponse.json({ marked_read: 2 })));
    render(<NotificationBell />);
    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Notifikasi/i }));
    fireEvent.click(await screen.findByText('Tandai semua terbaca'));

    await waitFor(() => expect(screen.queryByText('2')).not.toBeInTheDocument());
  });
});
