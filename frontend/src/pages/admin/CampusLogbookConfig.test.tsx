/**
 * Vitest tests for CampusLogbookConfigCard (AdminDashboard) — Phase 7 SC6 (ADMIN-04):
 * admin reads + updates campus logbook credentials at runtime; the token is never
 * echoed back (only has_token).
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setup';
import { CampusLogbookConfigCard } from './AdminDashboard';

const URL = '/api/logbook/admin/campus-config/';

describe('CampusLogbookConfigCard', () => {
  beforeEach(() => {
    server.use(
      http.get(URL, () =>
        HttpResponse.json({ enabled: false, provider: 'sekawan', base_url: '', has_token: false })
      )
    );
  });

  it('loads the current config and renders the form', async () => {
    render(<CampusLogbookConfigCard />);
    await waitFor(() => expect(screen.getByText('Aktifkan sinkron otomatis')).toBeInTheDocument());
    expect(screen.getByPlaceholderText('https://kampus.example/api')).toBeInTheDocument();
  });

  it('saves edited config (sending token only when provided)', async () => {
    let captured: Record<string, unknown> | null = null;
    server.use(
      http.put(URL, async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ enabled: true, provider: 'kpti', base_url: 'https://kpti.example/api', has_token: true });
      })
    );

    render(<CampusLogbookConfigCard />);
    await waitFor(() => expect(screen.getByText('Aktifkan sinkron otomatis')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('https://kampus.example/api'), {
      target: { value: 'https://kpti.example/api' },
    });
    fireEvent.change(screen.getByPlaceholderText('Bearer token'), { target: { value: 'rahasia-9' } });
    fireEvent.click(screen.getByRole('button', { name: /Simpan Konfigurasi/i }));

    await waitFor(() => expect(screen.getByText('Konfigurasi tersimpan.')).toBeInTheDocument());
    expect(captured).toMatchObject({ base_url: 'https://kpti.example/api', token: 'rahasia-9' });
  });
});
