/**
 * Vitest tests for LecturerRequests (/dosen/requests) — Phase 2 (FR-D01, FR-D04).
 *
 * Migrated from the old LecturerDashboard.test.tsx (S-08), which tested the
 * submission list/search/filter/approve-reject flow before it moved into its
 * own LecturerRequests.tsx component. Assertions were updated to match the
 * current markup (status labels, empty-state copy, default "Menunggu" tab).
 *
 * Tests:
 * 1. Renders submission cards with student NIM + symptom + status badge
 * 2. Switching the status tab issues a request with the status param
 * 3. The search field issues a request with the search param
 * 4. Setujui/Tolak/Revisi buttons ARE rendered for pending submissions (Phase 2)
 * 5. Empty state renders when the list is empty
 * 6. The draft filename is shown as a preview button when a file is attached
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { server } from '../../test/setup';
import LecturerRequests from './LecturerRequests';

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

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_SUBMISSIONS = [
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
  {
    id: 2,
    student_nim: '20230202',
    student_name: 'Siti Rahayu',
    symptom_names: ['Penulisan & Struktur'],
    status: 'revision',
    created_at: '2026-06-24T09:00:00Z',
    original_filename: 'draft_revisi.pdf',
    file_url: '/api/files/ccccdddd-0000-0000-0000-444455556666/',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderRequests() {
  return render(
    <MemoryRouter>
      <LecturerRequests />
    </MemoryRouter>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LecturerRequests', () => {
  beforeEach(() => {
    // Default: return whatever the request's own status/search filter narrows to.
    server.use(
      http.get('/api/submissions/lecturer/', ({ request }) => {
        const url = new URL(request.url);
        const statusParam = url.searchParams.get('status');
        const searchParam = url.searchParams.get('search');

        let filtered = [...MOCK_SUBMISSIONS];

        if (statusParam) {
          filtered = filtered.filter((s) => s.status === statusParam);
        }
        if (searchParam) {
          const q = searchParam.toLowerCase();
          filtered = filtered.filter(
            (s) =>
              s.student_nim.includes(q) ||
              s.student_name.toLowerCase().includes(q)
          );
        }

        return HttpResponse.json(filtered);
      })
    );
  });

  it('renders submission cards with NIM, symptom labels, and status badge', async () => {
    renderRequests();

    // Default tab is "Menunggu" (status=pending), so only Ahmad Fauzi loads first.
    await waitFor(() => {
      expect(screen.getByText('Ahmad Fauzi')).toBeInTheDocument();
    });
    expect(screen.getByText('20230101')).toBeInTheDocument();
    expect(screen.getByText('Analisis Data')).toBeInTheDocument();
    // "Menunggu" also labels the active tab, so the status badge is one of two matches.
    expect(screen.getAllByText('Menunggu').length).toBeGreaterThanOrEqual(2);

    // Switch to "Semua" to see the revision submission too.
    fireEvent.click(screen.getByRole('tab', { name: 'Semua' }));

    await waitFor(() => {
      expect(screen.getByText('Siti Rahayu')).toBeInTheDocument();
    });
    expect(screen.getByText('20230202')).toBeInTheDocument();
    expect(screen.getByText('Penulisan & Struktur')).toBeInTheDocument();
    expect(screen.getByText('Perlu Revisi')).toBeInTheDocument();
  });

  it('shows the draft filename as a preview control for submissions with a file', async () => {
    renderRequests();

    await waitFor(() => {
      expect(screen.getByText('Ahmad Fauzi')).toBeInTheDocument();
    });

    expect(screen.getByText('draft_bab1.pdf')).toBeInTheDocument();
  });

  it('switching the Menunggu tab filters submissions by status=pending', async () => {
    let capturedStatusParam: string | null | undefined;

    server.use(
      http.get('/api/submissions/lecturer/', ({ request }) => {
        const url = new URL(request.url);
        capturedStatusParam = url.searchParams.get('status');

        const filtered = capturedStatusParam
          ? MOCK_SUBMISSIONS.filter((s) => s.status === capturedStatusParam)
          : MOCK_SUBMISSIONS;

        return HttpResponse.json(filtered);
      })
    );

    renderRequests();

    await waitFor(() => {
      expect(capturedStatusParam).toBe('pending');
    });

    // Switch away and back to confirm the tab still drives the param.
    fireEvent.click(screen.getByRole('tab', { name: 'Semua' }));
    await waitFor(() => expect(capturedStatusParam).toBe(null));

    fireEvent.click(screen.getByRole('tab', { name: 'Menunggu' }));
    await waitFor(() => expect(capturedStatusParam).toBe('pending'));
  });

  it('typing in search field issues a request with the search param', async () => {
    let capturedSearchParam: string | null = null;

    server.use(
      http.get('/api/submissions/lecturer/', ({ request }) => {
        const url = new URL(request.url);
        capturedSearchParam = url.searchParams.get('search');
        return HttpResponse.json(MOCK_SUBMISSIONS);
      })
    );

    renderRequests();

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Cari NIM atau nama...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('Cari NIM atau nama...');
    fireEvent.change(searchInput, { target: { value: '20230101' } });

    await waitFor(
      () => {
        expect(capturedSearchParam).toBe('20230101');
      },
      { timeout: 1000 }
    );
  });

  it('renders Setujui and Tolak/Revisi buttons for pending submissions (Phase 2)', async () => {
    renderRequests();

    await waitFor(() => {
      expect(screen.getByText('Ahmad Fauzi')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Setujui submission dari Ahmad Fauzi/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Tolak\/Revisi submission dari Ahmad Fauzi/ })).toBeInTheDocument();
  });

  it('renders empty state when no submissions match the filter', async () => {
    server.use(
      http.get('/api/submissions/lecturer/', () => {
        return HttpResponse.json([]);
      })
    );

    renderRequests();

    await waitFor(() => {
      expect(screen.getByText('Belum Ada Permintaan')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Tidak ada submission dengan filter yang dipilih.')
    ).toBeInTheDocument();
  });

  it('renders search placeholder "Cari NIM atau nama..."', async () => {
    renderRequests();

    expect(screen.getByPlaceholderText('Cari NIM atau nama...')).toBeInTheDocument();
  });
});
