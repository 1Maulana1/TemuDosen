/**
 * Vitest tests for LecturerHistory (/dosen/riwayat) and LecturerSessionDetail
 * (/dosen/sesi/:id) — Phase 6 (UI-first, partial): riwayat sesi, rekaman,
 * ringkasan manual.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { server } from '../../test/setup';
import LecturerHistory from './LecturerHistory';
import LecturerSessionDetail from './LecturerSessionDetail';

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useRouteLoaderData: () => ({
      id: 10, email: 'lecturer@test.com', full_name: 'Dr. Rina Sari',
      role: 'lecturer', is_approved: true, nidn: '0011223344',
    }),
    useParams: () => ({ id: '7' }),
  };
});

function renderHistory() {
  return render(<MemoryRouter><LecturerHistory /></MemoryRouter>);
}

function renderDetail() {
  return render(<MemoryRouter><LecturerSessionDetail /></MemoryRouter>);
}

describe('LecturerHistory', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/queue/lecturer/history/', () =>
        HttpResponse.json([
          {
            id: 7, scheduled_at: '2026-07-04T09:00:00Z', ts2: '2026-07-04T10:00:00Z',
            mahasiswa_name: 'Budi Santoso', nim: '20230001', dosen_name: 'Dr. Rina Sari',
            symptom_name: 'Metodologi', has_recording: true, has_summary: false,
            summary_approved_at: null,
          },
        ])
      )
    );
  });

  it('renders a completed session with a recording badge', async () => {
    renderHistory();
    await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument());
    expect(screen.getByText('Rekaman')).toBeInTheDocument();
    expect(screen.getByText('Belum diringkas')).toBeInTheDocument();
  });

  it('shows empty state when there is no history', async () => {
    server.use(http.get('/api/queue/lecturer/history/', () => HttpResponse.json([])));
    renderHistory();
    await waitFor(() => expect(screen.getByText('Belum Ada Riwayat')).toBeInTheDocument());
  });
});

describe('LecturerSessionDetail', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/queue/7/summary/', () =>
        HttpResponse.json({
          id: 7, mahasiswa_name: 'Budi Santoso', nim: '20230001', dosen_name: 'Dr. Rina Sari',
          scheduled_at: '2026-07-04T09:00:00Z', ts1: '2026-07-04T09:05:00Z', ts2: '2026-07-04T10:00:00Z',
          has_recording: true, summary: '', summary_approved_at: null,
        })
      )
    );
  });

  it('renders an audio player when the session has a recording', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument());
    const audio = document.querySelector('audio');
    expect(audio).toBeInTheDocument();
    expect(audio?.getAttribute('src')).toBe('/api/queue/7/recording/');
  });

  it('disables Approve until a summary is typed', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Setujui & Kirim/i })).toBeDisabled();
  });

  it('saving a draft calls PATCH with the typed summary', async () => {
    let capturedBody: unknown = null;
    server.use(
      http.patch('/api/queue/7/summary/', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          id: 7, mahasiswa_name: 'Budi Santoso', nim: '20230001', dosen_name: 'Dr. Rina Sari',
          scheduled_at: '2026-07-04T09:00:00Z', ts1: null, ts2: '2026-07-04T10:00:00Z',
          has_recording: true, summary: 'Draf ringkasan.', summary_approved_at: null,
        });
      })
    );
    renderDetail();
    await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument());

    const textarea = screen.getByPlaceholderText(/Tuliskan ringkasan/i);
    fireEvent.change(textarea, { target: { value: 'Draf ringkasan.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Simpan Draf' }));

    await waitFor(() => expect(capturedBody).toEqual({ summary: 'Draf ringkasan.', approve: false }));
    await waitFor(() => expect(screen.getByText('Draf ringkasan disimpan.')).toBeInTheDocument());
  });

  it('approving shows the approved badge', async () => {
    server.use(
      http.patch('/api/queue/7/summary/', () =>
        HttpResponse.json({
          id: 7, mahasiswa_name: 'Budi Santoso', nim: '20230001', dosen_name: 'Dr. Rina Sari',
          scheduled_at: '2026-07-04T09:00:00Z', ts1: null, ts2: '2026-07-04T10:00:00Z',
          has_recording: true, summary: 'Sudah bagus.', summary_approved_at: '2026-07-04T10:05:00Z',
        })
      )
    );
    renderDetail();
    await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Tuliskan ringkasan/i), { target: { value: 'Sudah bagus.' } });
    fireEvent.click(screen.getByRole('button', { name: /Setujui & Kirim/i }));

    await waitFor(() => expect(screen.getByText(/Disetujui \d/)).toBeInTheDocument());
  });
});
