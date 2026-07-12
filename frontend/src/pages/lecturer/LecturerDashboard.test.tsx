/**
 * Vitest tests for LecturerDashboard — the /dosen home screen (queue summary +
 * stats + "Mahasiswa Menunggu" preview).
 *
 * The submission list/search/filter/approve-reject flow this file used to
 * test (S-08) moved into its own LecturerRequests.tsx component; those
 * tests now live in LecturerRequests.test.tsx.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
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

    expect(screen.getByRole('img', { name: 'TemuDosen' })).toBeInTheDocument();
    // Bell icon has no aria-label in the current header markup — assert on the
    // material-symbols icon text itself instead of an accessible label.
    expect(screen.getByText('notifications')).toBeInTheDocument();
  });

  it('renders nav with Beranda, Permintaan, Antrian, Profil', async () => {
    renderDashboard();

    // Each label appears twice now — once in the desktop top navbar (hidden on
    // mobile via CSS) and once in the mobile bottom nav (hidden on desktop).
    // jsdom keeps both in the DOM, so assert at least one of each exists.
    expect(screen.getAllByText('Beranda').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Permintaan').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Antrian').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Profil').length).toBeGreaterThan(0);
  });
});

// ── SESSION-04: kartu Sesi Berlangsung + tombol Selesai ────────────────────────

const ACTIVE_SESSION = {
  position: 1,
  id: 7,
  mahasiswa_name: 'Budi Santoso',
  nim: '20230001',
  symptom_name: 'Metodologi',
  estimated_minutes: 45,
  scheduled_at: '2026-07-04T09:00:00Z',
  status: 'in_progress',
  method: 'offline',
  meeting_link: null,
  ts1: '2026-07-04T09:05:00Z',
  consent_given: false,
};

describe('LecturerDashboard — Sesi Berlangsung (SESSION-04)', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/queue/lecturer/', () =>
        HttpResponse.json({
          totalWaiting: 0,
          estimatedEndTime: null,
          queue: [],
          activeSession: ACTIVE_SESSION,
        })
      ),
      http.get('/api/stats/lecturer/', () =>
        HttpResponse.json({ total_sessions_week: 0, avg_duration_minutes: 0 })
      )
    );
  });

  it('shows the active session card with a Selesai button and notes field', async () => {
    renderDashboard();

    expect(await screen.findByText('Sesi Berlangsung')).toBeInTheDocument();
    expect(screen.getByText('Budi Santoso')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /selesai/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/catatan hasil bimbingan/i)).toBeInTheDocument();
    // Rekaman tidak berjalan (refresh / tanpa consent) → indikator netral, bukan "Merekam…"
    expect(screen.getByText('Tanpa rekaman')).toBeInTheDocument();
    expect(screen.queryByText('Merekam…')).not.toBeInTheDocument();
  });

  it('pressing Selesai posts to /complete/ and reports success', async () => {
    // Catatan: serialisasi multipart tidak bisa diverifikasi di jsdom (FormData
    // jsdom ≠ FormData undici, sehingga fetch Node mem-fallback ke text/plain).
    // Yang diuji di sini: endpoint terpanggil, apiRequest TIDAK memaksa header
    // application/json untuk body FormData, dan alur sukses tampil. Isi `notes`
    // multipart sudah diuji di backend (test_optional_notes_saved).
    let contentType: string | null = null;
    server.use(
      http.post('/api/queue/7/complete/', ({ request }) => {
        contentType = request.headers.get('content-type');
        return HttpResponse.json({
          message: 'Sesi berhasil diselesaikan.',
          ts2: '2026-07-04T10:00:00Z',
          has_recording: false,
        });
      })
    );
    renderDashboard();

    const notesInput = await screen.findByPlaceholderText(/catatan hasil bimbingan/i);
    fireEvent.change(notesInput, { target: { value: 'Lanjut bab 4.' } });
    fireEvent.click(screen.getByRole('button', { name: /selesai/i }));

    await waitFor(() => expect(screen.getByText('Sesi selesai.')).toBeInTheDocument());
    expect(contentType).not.toMatch(/application\/json/);
  });
});
