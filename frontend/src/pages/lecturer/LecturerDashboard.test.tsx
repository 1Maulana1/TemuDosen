/**
 * Vitest tests for LecturerDashboard — the /dosen home screen (queue summary +
 * stats + "Mahasiswa Menunggu" preview).
 *
 * The submission list/search/filter/approve-reject flow this file used to
 * test (S-08) moved into its own LecturerRequests.tsx component; those
 * tests now live in LecturerRequests.test.tsx.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { server } from '../../test/setup';
import LecturerDashboard from './LecturerDashboard';

// Mock useRouteLoaderData to inject a lecturer user
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useRouteLoaderData: () => ({
      id: 10,
      email: 'lecturer@test.com',
      full_name: 'Dr. Rina Sari',
      role: 'lecturer',
      is_approved: true,
      nidn: '0011223344',
    }),
  };
});

function renderDashboard() {
  return render(
    <MemoryRouter>
      <LecturerDashboard />
    </MemoryRouter>
  );
}

describe('LecturerDashboard (S-08)', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/queue/lecturer/', () =>
        HttpResponse.json({ totalWaiting: 0, estimatedEndTime: null, queue: [] })
      ),
      http.get('/api/stats/lecturer/', () =>
        HttpResponse.json({ total_sessions_week: 0, avg_duration_minutes: 0 })
      )
    );
  });

  it('renders header with TemuDosen wordmark and notification bell', async () => {
    renderDashboard();

    expect(screen.getByText('TemuDosen')).toBeInTheDocument();
    // Bell icon has no aria-label in the current header markup — assert on the
    // material-symbols icon text itself instead of an accessible label.
    expect(screen.getByText('notifications')).toBeInTheDocument();
  });

  it('renders bottom nav with Beranda, Permintaan, Antrian, Profil', async () => {
    renderDashboard();

    // Labels updated to match the current bottom nav (Permintaan/Antrian,
    // not the old Antrean/Riwayat naming) — items have no aria-label, so
    // assert on the visible text instead of getByLabelText.
    expect(screen.getByText('Beranda')).toBeInTheDocument();
    expect(screen.getByText('Permintaan')).toBeInTheDocument();
    expect(screen.getByText('Antrian')).toBeInTheDocument();
    expect(screen.getByText('Profil')).toBeInTheDocument();
  });
});
