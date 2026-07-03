/**
 * Vitest tests for LecturerDashboard — Stitch redesign (overview page).
 *
 * Covers:
 * 1. "Perlu Ditinjau" pending cards render name/NIM/symptoms + Setujui/Tolak links
 * 2. Empty state for "Perlu Ditinjau" when no pending submissions
 * 3. "Antrean Aktif" queue cards render name/NIM/symptom + Mulai Sesi action
 * 4. Empty state for "Antrean Aktif" when queue is empty
 * 5. Google Calendar connection banner reflects connected/disconnected state
 * 6. Header renders TemuDosen wordmark and the lecturer's name
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { server } from '../../test/setup';
import LecturerDashboard from './LecturerDashboard';

// Mock useRouteLoaderData — LecturerDashboard reads the lecturer user from the
// parent 'lecturer-root' route loader.
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

const MOCK_PENDING = [
  {
    id: 1,
    student_nim: '20230101',
    student_name: 'Ahmad Fauzi',
    symptom_names: ['Analisis Data', 'Metodologi Penelitian'],
    status: 'pending',
    created_at: '2026-06-25T10:00:00Z',
    original_filename: 'draft_bab1.pdf',
    file_url: '/api/files/aaaabbbb-0000-0000-0000-111122223333/',
  },
];

const MOCK_QUEUE = {
  totalWaiting: 1,
  estimatedEndTime: '2026-06-25T12:00:00Z',
  queue: [
    {
      position: 1,
      id: 5,
      mahasiswa_name: 'Siti Rahayu',
      nim: '20230202',
      symptom_name: 'Penulisan & Struktur',
      estimated_minutes: 20,
      scheduled_at: '2026-06-25T11:00:00Z',
      status: 'approved',
      method: 'offline' as const,
      meeting_link: null,
    },
  ],
};

function renderDashboard() {
  return render(
    <MemoryRouter>
      <LecturerDashboard />
    </MemoryRouter>
  );
}

describe('LecturerDashboard (Stitch redesign)', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/submissions/lecturer/', () => HttpResponse.json(MOCK_PENDING)),
      http.get('/api/queue/lecturer/', () => HttpResponse.json(MOCK_QUEUE)),
      http.get('/api/calendar/status/', () => HttpResponse.json({ enabled: true, connected: false }))
    );
  });

  it('renders pending cards with student name, NIM, symptoms, and Setujui/Tolak links', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Ahmad Fauzi')).toBeInTheDocument();
    });

    expect(screen.getByText('NIM: 20230101')).toBeInTheDocument();
    expect(screen.getByText('"Analisis Data, Metodologi Penelitian"')).toBeInTheDocument();

    const approveLink = screen.getByRole('link', { name: 'Setujui' });
    expect(approveLink).toHaveAttribute('href', '/dosen/requests?id=1&action=approve');

    const rejectLink = screen.getByRole('link', { name: 'Tolak' });
    expect(rejectLink).toHaveAttribute('href', '/dosen/requests?id=1&action=reject');
  });

  it('renders empty state when there are no pending submissions', async () => {
    server.use(http.get('/api/submissions/lecturer/', () => HttpResponse.json([])));

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Tidak ada pengajuan yang perlu ditinjau.')).toBeInTheDocument();
    });
  });

  it('renders active queue cards with student name, NIM, symptom, and a Mulai Sesi action', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Siti Rahayu')).toBeInTheDocument();
    });

    expect(screen.getByText('20230202')).toBeInTheDocument();
    expect(screen.getByText('Penulisan & Struktur')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mulai Sesi' })).toBeInTheDocument();
  });

  it('starting a session calls the start endpoint and shows a success message', async () => {
    let startCalled = false;
    server.use(
      http.post('/api/queue/5/start/', () => {
        startCalled = true;
        return HttpResponse.json({});
      })
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Mulai Sesi' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mulai Sesi' }));

    await waitFor(() => {
      expect(startCalled).toBe(true);
      expect(screen.getByText('Sesi berhasil dimulai!')).toBeInTheDocument();
    });
  });

  it('renders empty state when the queue is empty', async () => {
    server.use(
      http.get('/api/queue/lecturer/', () =>
        HttpResponse.json({ totalWaiting: 0, estimatedEndTime: '', queue: [] })
      )
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Antrian kosong hari ini.')).toBeInTheDocument();
    });
  });

  it('shows "Tidak Terhubung" when Google Calendar is not connected', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Tidak Terhubung')).toBeInTheDocument();
    });
  });

  it('shows "Terhubung" when Google Calendar is connected', async () => {
    server.use(
      http.get('/api/calendar/status/', () => HttpResponse.json({ enabled: true, connected: true }))
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Terhubung')).toBeInTheDocument();
    });
  });

  it('renders header with TemuDosen wordmark and the lecturer name', async () => {
    renderDashboard();

    expect(screen.getAllByText('TemuDosen').length).toBeGreaterThan(0);
    expect(screen.getByText('Dr. Rina Sari')).toBeInTheDocument();
  });
});
