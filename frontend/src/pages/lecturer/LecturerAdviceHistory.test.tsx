/**
 * Vitest tests for LecturerAdviceHistory (/dosen/saran) — Phase 7 SC2 (ADVICE-02):
 * rekap saran agregat lintas sesi, dikelompokkan per mahasiswa bimbingan.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { server } from '../../test/setup';
import LecturerAdviceHistory from './LecturerAdviceHistory';

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useRouteLoaderData: () => ({
      id: 10, email: 'lecturer@test.com', full_name: 'Dr. Rina Sari',
      role: 'lecturer', is_approved: true, nidn: '0011223344',
    }),
  };
});

const URL = '/api/queue/lecturer/advice-history/';

function renderPage() {
  return render(<MemoryRouter><LecturerAdviceHistory /></MemoryRouter>);
}

describe('LecturerAdviceHistory', () => {
  beforeEach(() => {
    server.use(
      http.get(URL, () =>
        HttpResponse.json({
          total_saran: 2,
          saran_selesai: 1,
          compliance_rate: 50,
          per_mahasiswa: [
            {
              student_id: 1, nama: 'Budi Santoso', nim: '20230001',
              total_saran: 2, saran_selesai: 1,
              items: [
                { id: 11, session_id: 7, description: 'Perbaiki bab metodologi', is_completed: true, created_at: '2026-07-04T10:00:00Z', completed_at: '2026-07-05T09:00:00Z' },
                { id: 12, session_id: 7, description: 'Tambah referensi terbaru', is_completed: false, created_at: '2026-07-04T10:00:00Z', completed_at: null },
              ],
            },
          ],
        })
      )
    );
  });

  it('groups advice under the advisee with completion status and a link to the session', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText('Budi Santoso')).toBeInTheDocument());

    expect(screen.getByText('Perbaiki bab metodologi')).toBeInTheDocument();
    expect(screen.getByText('Tambah referensi terbaru')).toBeInTheDocument();
    // one completed, one still pending
    expect(screen.getByText('Belum ditindaklanjuti')).toBeInTheDocument();
    expect(screen.getByText('1/2 selesai')).toBeInTheDocument();

    const sesiLinks = screen.getAllByRole('link', { name: 'Lihat sesi' });
    expect(sesiLinks[0]).toHaveAttribute('href', '/dosen/sesi/7');
  });

  it('shows the empty state when the lecturer has no advice yet', async () => {
    server.use(
      http.get(URL, () =>
        HttpResponse.json({ total_saran: 0, saran_selesai: 0, compliance_rate: 0, per_mahasiswa: [] })
      )
    );
    renderPage();
    await waitFor(() => expect(screen.getByText('Belum Ada Saran')).toBeInTheDocument());
  });
});
