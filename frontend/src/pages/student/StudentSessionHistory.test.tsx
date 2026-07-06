/**
 * Vitest tests for StudentHistory (/mahasiswa/riwayat) and StudentSessionDetail
 * (/mahasiswa/sesi/:id) — Phase 6 (merge): riwayat + ringkasan (read-only) via
 * SessionLogbook (/api/logbook/student/).
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { server } from '../../test/setup';
import StudentHistory from './StudentHistory';
import StudentSessionDetail from './StudentSessionDetail';

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useRouteLoaderData: () => ({
      id: 1, email: 'student@test.com', full_name: 'Budi Santoso',
      role: 'student', is_approved: true, nim: '20230001',
    }),
    useParams: () => ({ id: '7' }),
  };
});

function renderHistory() {
  return render(<MemoryRouter><StudentHistory /></MemoryRouter>);
}

function renderDetail() {
  return render(<MemoryRouter><StudentSessionDetail /></MemoryRouter>);
}

describe('StudentHistory', () => {
  it('shows "menunggu ringkasan" when the summary is not approved yet', async () => {
    server.use(
      http.get('/api/queue/my/history/', () =>
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
    renderHistory();
    await waitFor(() => expect(screen.getByText('Dr. Rina Sari')).toBeInTheDocument());
    expect(screen.getByText('Menunggu ringkasan dosen')).toBeInTheDocument();
  });

  it('shows empty state when there is no history', async () => {
    server.use(http.get('/api/queue/my/history/', () => HttpResponse.json([])));
    renderHistory();
    await waitFor(() => expect(screen.getByText('Belum Ada Riwayat Sesi')).toBeInTheDocument());
  });
});

describe('StudentSessionDetail', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/logbook/student/7/', () =>
        HttpResponse.json({
          session_id: 7, mahasiswa_name: 'Budi Santoso', nim: '20230001', dosen_name: 'Dr. Rina Sari',
          scheduled_at: '2026-07-04T09:00:00Z', ts1: '2026-07-04T09:05:00Z', ts2: '2026-07-04T10:00:00Z',
          has_recording: true, status: 'approved', is_manual: true,
          transcript: '', summary_raw: {}, summary_edited: { manual_notes: 'Sudah bagus, lanjut bab 4.' },
          approved_at: '2026-07-04T10:05:00Z',
        })
      ),
      http.get('/api/queue/7/action-items/', () => HttpResponse.json([]))
    );
  });

  it('shows the approved summary text (read-only, no editor)', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByText('Sudah bagus, lanjut bab 4.')).toBeInTheDocument());
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    const audio = document.querySelector('audio');
    expect(audio?.getAttribute('src')).toBe('/api/queue/7/recording/');
  });

  it('renders a structured AI summary as advice/improvement cards', async () => {
    server.use(
      http.get('/api/logbook/student/7/', () =>
        HttpResponse.json({
          session_id: 7, mahasiswa_name: 'Budi Santoso', nim: '20230001', dosen_name: 'Dr. Rina Sari',
          scheduled_at: '2026-07-04T09:00:00Z', ts1: null, ts2: '2026-07-04T10:00:00Z',
          has_recording: false, status: 'approved', is_manual: false,
          transcript: 'transkrip panjang…',
          summary_raw: {},
          summary_edited: {
            advice_points: [{ topic: 'Metodologi', detail: 'Perjelas populasi dan sampel.' }],
            improvement_notes: [{ area: 'Bab 2', action: 'Tambah 5 referensi terbaru.' }],
          },
          approved_at: '2026-07-04T10:05:00Z',
        })
      )
    );
    renderDetail();
    await waitFor(() => expect(screen.getByText('Saran Dosen')).toBeInTheDocument());
    expect(screen.getByText('Metodologi')).toBeInTheDocument();
    expect(screen.getByText('Perjelas populasi dan sampel.')).toBeInTheDocument();
    expect(screen.getByText('Area Perbaikan')).toBeInTheDocument();
    expect(screen.getByText('Tambah 5 referensi terbaru.')).toBeInTheDocument();
  });

  it('shows a waiting state when summary is not yet approved', async () => {
    // Endpoint mahasiswa menolak logbook yang belum disetujui dengan 403.
    server.use(
      http.get('/api/logbook/student/7/', () =>
        HttpResponse.json({ detail: 'Ringkasan belum tersedia.' }, { status: 403 })
      )
    );
    renderDetail();
    await waitFor(() =>
      expect(screen.getByText(/menunggu dosen mengisi dan menyetujuinya/i)).toBeInTheDocument()
    );
  });

  it('lists advice items and lets the student mark one complete (ADVICE-01)', async () => {
    server.use(
      http.get('/api/queue/7/action-items/', () =>
        HttpResponse.json([
          { id: 1, description: 'Perbaiki bab metodologi', is_completed: false, created_at: '2026-07-04T10:00:00Z', completed_at: null },
          { id: 2, description: 'Tambah referensi bab 2', is_completed: true, created_at: '2026-07-03T10:00:00Z', completed_at: '2026-07-04T08:00:00Z' },
        ])
      )
    );
    let completedId: number | null = null;
    server.use(
      http.post('/api/action-items/1/complete/', () => {
        completedId = 1;
        return HttpResponse.json({ id: 1, is_completed: true, completed_at: '2026-07-05T09:00:00Z' });
      })
    );

    renderDetail();
    await waitFor(() => expect(screen.getByText('Saran & Tindak Lanjut')).toBeInTheDocument());
    expect(screen.getByText('Perbaiki bab metodologi')).toBeInTheDocument();
    expect(screen.getByText('Tambah referensi bab 2')).toBeInTheDocument();
    expect(screen.getByText('Belum ditindaklanjuti')).toBeInTheDocument();

    // Item #2 is already completed, so exactly one "Ditindaklanjuti" line exists
    // before the click; after marking #1 done there should be two.
    expect(screen.getAllByText(/Ditindaklanjuti/)).toHaveLength(1);
    screen.getByRole('button', { name: /Tandai Selesai/i }).click();

    await waitFor(() => expect(completedId).toBe(1));
    await waitFor(() => expect(screen.getAllByText(/Ditindaklanjuti/)).toHaveLength(2));
  });

  it('shows advice items even while the AI summary is still awaiting approval', async () => {
    server.use(
      http.get('/api/logbook/student/7/', () =>
        HttpResponse.json({ detail: 'Ringkasan belum tersedia.' }, { status: 403 })
      ),
      http.get('/api/queue/7/action-items/', () =>
        HttpResponse.json([
          { id: 3, description: 'Perbanyak bacaan teori', is_completed: false, created_at: '2026-07-04T10:00:00Z', completed_at: null },
        ])
      )
    );
    renderDetail();
    await waitFor(() => expect(screen.getByText('Perbanyak bacaan teori')).toBeInTheDocument());
    expect(screen.getByText(/menunggu dosen mengisi dan menyetujuinya/i)).toBeInTheDocument();
  });
});
