/**
 * Vitest tests for StudentHistory (/mahasiswa/riwayat) and StudentSessionDetail
 * (/mahasiswa/sesi/:id) — Phase 6 (UI-first, partial): riwayat + ringkasan (read-only).
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
            symptom_name: 'Metodologi', has_recording: true, has_summary: false,
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
      http.get('/api/queue/7/summary/', () =>
        HttpResponse.json({
          id: 7, mahasiswa_name: 'Budi Santoso', nim: '20230001', dosen_name: 'Dr. Rina Sari',
          scheduled_at: '2026-07-04T09:00:00Z', ts1: '2026-07-04T09:05:00Z', ts2: '2026-07-04T10:00:00Z',
          has_recording: true, summary: 'Sudah bagus, lanjut bab 4.', summary_approved_at: '2026-07-04T10:05:00Z',
        })
      )
    );
  });

  it('shows the approved summary text (read-only, no editor)', async () => {
    renderDetail();
    await waitFor(() => expect(screen.getByText('Sudah bagus, lanjut bab 4.')).toBeInTheDocument());
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    const audio = document.querySelector('audio');
    expect(audio?.getAttribute('src')).toBe('/api/queue/7/recording/');
  });

  it('shows a waiting state when summary is not yet approved', async () => {
    server.use(
      http.get('/api/queue/7/summary/', () =>
        HttpResponse.json({
          id: 7, mahasiswa_name: 'Budi Santoso', nim: '20230001', dosen_name: 'Dr. Rina Sari',
          scheduled_at: '2026-07-04T09:00:00Z', ts1: null, ts2: '2026-07-04T10:00:00Z',
          has_recording: false, summary: '', summary_approved_at: null,
        })
      )
    );
    renderDetail();
    await waitFor(() =>
      expect(screen.getByText(/menunggu dosen mengisi dan menyetujuinya/i)).toBeInTheDocument()
    );
  });
});
