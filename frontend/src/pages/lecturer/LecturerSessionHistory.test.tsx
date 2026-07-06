/**
 * Vitest tests for LecturerHistory (/dosen/riwayat) and LecturerSessionDetail
 * (/dosen/sesi/:id) — Phase 6 (merge): riwayat sesi, rekaman, ringkasan via
 * SessionLogbook (/api/logbook/).
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
            symptom_name: 'Metodologi', has_recording: true, summary_status: 'pending',
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
      http.get('/api/logbook/7/', () =>
        HttpResponse.json({
          session_id: 7, mahasiswa_name: 'Budi Santoso', nim: '20230001', dosen_name: 'Dr. Rina Sari',
          scheduled_at: '2026-07-04T09:00:00Z', ts1: '2026-07-04T09:05:00Z', ts2: '2026-07-04T10:00:00Z',
          has_recording: true, status: 'pending', is_manual: false,
          transcript: '', summary_raw: {}, summary_edited: null, approved_at: null,
        })
      ),
      http.get('/api/queue/7/action-items/', () => HttpResponse.json([]))
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

  it('approving a pending logbook posts manual notes and shows the approved badge', async () => {
    let capturedBody: unknown = null;
    server.use(
      http.post('/api/logbook/7/manual-notes/', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          session_id: 7, mahasiswa_name: 'Budi Santoso', nim: '20230001', dosen_name: 'Dr. Rina Sari',
          scheduled_at: '2026-07-04T09:00:00Z', ts1: null, ts2: '2026-07-04T10:00:00Z',
          has_recording: true, status: 'approved', is_manual: true,
          transcript: '', summary_raw: {}, summary_edited: { manual_notes: 'Sudah bagus.' },
          approved_at: '2026-07-04T10:05:00Z',
        });
      })
    );
    renderDetail();
    await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Tuliskan ringkasan/i), { target: { value: 'Sudah bagus.' } });
    fireEvent.click(screen.getByRole('button', { name: /Setujui & Kirim/i }));

    await waitFor(() => expect(capturedBody).toEqual({ notes: 'Sudah bagus.' }));
    await waitFor(() => expect(screen.getByText(/Disetujui \d/)).toBeInTheDocument());
  });

  it('shows campus sync status + CSV/PDF export fallback on an approved logbook (SC3/SC4)', async () => {
    server.use(
      http.get('/api/logbook/7/', () =>
        HttpResponse.json({
          session_id: 7, mahasiswa_name: 'Budi Santoso', nim: '20230001', dosen_name: 'Dr. Rina Sari',
          scheduled_at: '2026-07-04T09:00:00Z', ts1: null, ts2: '2026-07-04T10:00:00Z',
          has_recording: false, status: 'approved', is_manual: false,
          transcript: '', summary_raw: {}, summary_edited: { advice_points: [], improvement_notes: [] },
          approved_at: '2026-07-04T10:05:00Z',
          campus_sync_status: 'pending_retry', campus_entry_id: '', campus_synced_at: null,
        })
      )
    );
    renderDetail();
    await waitFor(() => expect(screen.getByText('Menunggu coba ulang')).toBeInTheDocument());

    // fallback export links point at the export endpoint
    const csv = screen.getByRole('link', { name: /CSV/i });
    const pdf = screen.getByRole('link', { name: /PDF/i });
    expect(csv).toHaveAttribute('href', '/api/logbook/7/export/?format=csv');
    expect(pdf).toHaveAttribute('href', '/api/logbook/7/export/?format=pdf');
    expect(screen.getByText(/unduh CSV\/PDF/i)).toBeInTheDocument();
  });

  it('approving an AI-generated draft sends structured advice/improvement items, not manual_notes', async () => {
    server.use(
      http.get('/api/logbook/7/', () =>
        HttpResponse.json({
          session_id: 7, mahasiswa_name: 'Budi Santoso', nim: '20230001', dosen_name: 'Dr. Rina Sari',
          scheduled_at: '2026-07-04T09:00:00Z', ts1: '2026-07-04T09:05:00Z', ts2: '2026-07-04T10:00:00Z',
          has_recording: true, status: 'ready_for_review', is_manual: false,
          transcript: 'dosen membahas metodologi', approved_at: null,
          summary_raw: {
            advice_points: [{ topic: 'Metodologi', detail: 'Perbaiki bab 3' }],
            improvement_notes: [{ area: 'Penulisan', action: 'Rapikan sitasi' }],
          },
          summary_edited: null,
        })
      )
    );
    let capturedBody: unknown = null;
    server.use(
      http.post('/api/logbook/7/approve/', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          session_id: 7, mahasiswa_name: 'Budi Santoso', nim: '20230001', dosen_name: 'Dr. Rina Sari',
          scheduled_at: '2026-07-04T09:00:00Z', ts1: null, ts2: '2026-07-04T10:00:00Z',
          has_recording: true, status: 'approved', is_manual: false,
          transcript: '', summary_raw: {},
          summary_edited: (capturedBody as { summary_edited: unknown })?.summary_edited ?? null,
          approved_at: '2026-07-04T10:05:00Z',
        });
      })
    );

    renderDetail();
    await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Setujui & Kirim/i }));

    await waitFor(() => expect(capturedBody).toEqual({
      summary_edited: {
        advice_points: [{ topic: 'Metodologi', detail: 'Perbaiki bab 3' }],
        improvement_notes: [{ area: 'Penulisan', action: 'Rapikan sitasi' }],
      },
    }));
  });

  it('lists existing advice items and lets the lecturer add a new one (ADVICE-01)', async () => {
    server.use(
      http.get('/api/queue/7/action-items/', () =>
        HttpResponse.json([
          { id: 1, description: 'Perbaiki bab metodologi', is_completed: false, created_at: '2026-07-04T10:00:00Z', completed_at: null },
        ])
      )
    );
    let capturedBody: unknown = null;
    server.use(
      http.post('/api/queue/7/action-items/', async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(
          { id: 2, description: (capturedBody as { description: string }).description, is_completed: false, created_at: '2026-07-05T09:00:00Z', completed_at: null },
          { status: 201 }
        );
      })
    );

    renderDetail();
    await waitFor(() => expect(screen.getByText('Perbaiki bab metodologi')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Tambahkan saran baru/i), { target: { value: 'Perbanyak kutipan jurnal terbaru' } });
    fireEvent.click(screen.getByRole('button', { name: /^Tambah$/i }));

    await waitFor(() => expect(capturedBody).toEqual({ description: 'Perbanyak kutipan jurnal terbaru' }));
    await waitFor(() => expect(screen.getByText('Perbanyak kutipan jurnal terbaru')).toBeInTheDocument());
  });
});
