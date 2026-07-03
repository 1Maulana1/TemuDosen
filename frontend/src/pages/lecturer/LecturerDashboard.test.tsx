/**
 * Vitest tests for LecturerDashboard (S-08) — Plan 05.
 *
 * Tests (per plan acceptance criteria):
 * 1. Renders submission cards with student NIM + symptom + status badge
 * 2. Switching the status tab issues a request with the status param
 * 3. The search field issues a request with the search param
 * 4. NO Approve/Reject button is rendered (D-12 compliance)
 * 5. Empty state renders "Belum Ada Permintaan Masuk" when list is empty
 * 6. "Lihat Draft" button is present on a submission card
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

function renderDashboard() {
  return render(
    <MemoryRouter>
      <LecturerDashboard />
    </MemoryRouter>
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('LecturerDashboard (S-08)', () => {
  beforeEach(() => {
    // Default: return full submission list
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

  // TODO: pre-existing — fitur pindah ke LecturerRequests.tsx
  // Pindahkan test ini ke LecturerRequests.test.tsx saat file itu dibuat.
  it('renders submission cards with NIM, symptom labels, and status badge', async () => {
    renderDashboard();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Ahmad Fauzi')).toBeInTheDocument();
    });

    // Student NIM visible
    expect(screen.getByText('20230101')).toBeInTheDocument();
    // Second student
    expect(screen.getByText('Siti Rahayu')).toBeInTheDocument();
    expect(screen.getByText('20230202')).toBeInTheDocument();

    // Symptom labels visible
    expect(screen.getByText('Analisis Data')).toBeInTheDocument();
    expect(screen.getByText('Penulisan & Struktur')).toBeInTheDocument();

    // Status badges visible
    expect(screen.getByText('MENUNGGU')).toBeInTheDocument();
    expect(screen.getByText('REVISI')).toBeInTheDocument();
  });

  // TODO: pre-existing — fitur pindah ke LecturerRequests.tsx
  // Pindahkan test ini ke LecturerRequests.test.tsx saat file itu dibuat.
  it('renders "Lihat Draft" button for submissions with a file', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Ahmad Fauzi')).toBeInTheDocument();
    });

    // "Lihat Draft" buttons visible (one per submission with file)
    const draftButtons = screen.getAllByText('Lihat Draft');
    expect(draftButtons.length).toBeGreaterThan(0);
  });

  // TODO: pre-existing — fitur pindah ke LecturerRequests.tsx
  // Pindahkan test ini ke LecturerRequests.test.tsx saat file itu dibuat.
  it('switching the Menunggu tab filters submissions by status=pending', async () => {
    let capturedStatusParam: string | null = null;

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

    renderDashboard();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Ahmad Fauzi')).toBeInTheDocument();
    });

    // Click "Menunggu" tab
    const menungguTab = screen.getByRole('tab', { name: 'Menunggu' });
    fireEvent.click(menungguTab);

    // Wait for filtered results
    await waitFor(() => {
      expect(capturedStatusParam).toBe('pending');
    });
  });

  // TODO: pre-existing — fitur pindah ke LecturerRequests.tsx
  // Pindahkan test ini ke LecturerRequests.test.tsx saat file itu dibuat.
  it('typing in search field issues a request with the search param', async () => {
    let capturedSearchParam: string | null = null;

    server.use(
      http.get('/api/submissions/lecturer/', ({ request }) => {
        const url = new URL(request.url);
        capturedSearchParam = url.searchParams.get('search');
        return HttpResponse.json(MOCK_SUBMISSIONS);
      })
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Ahmad Fauzi')).toBeInTheDocument();
    });

    // Type in search box
    const searchInput = screen.getByPlaceholderText('Cari NIM atau nama...');
    fireEvent.change(searchInput, { target: { value: '20230101' } });

    // Wait for debounced fetch
    await waitFor(
      () => {
        expect(capturedSearchParam).toBe('20230101');
      },
      { timeout: 1000 }
    );
  });

  // TODO: pre-existing — fitur pindah ke LecturerRequests.tsx
  // Pindahkan test ini ke LecturerRequests.test.tsx saat file itu dibuat.
  // PENTING: assertion D-12 ini harus ada di LecturerRequests.test.tsx
  it('does NOT render Approve/Reject/Setujui/Tolak buttons (D-12 compliance)', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Ahmad Fauzi')).toBeInTheDocument();
    });

    // D-12: No approve/reject action buttons in Phase 1
    expect(screen.queryByText('Setujui')).not.toBeInTheDocument();
    expect(screen.queryByText('Tolak')).not.toBeInTheDocument();
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
    expect(screen.queryByText('Reject')).not.toBeInTheDocument();
  });

  // TODO: pre-existing — fitur pindah ke LecturerRequests.tsx
  // Pindahkan test ini ke LecturerRequests.test.tsx saat file itu dibuat.
  it('renders empty state when no submissions', async () => {
    server.use(
      http.get('/api/submissions/lecturer/', () => {
        return HttpResponse.json([]);
      })
    );

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Belum Ada Permintaan Masuk')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Mahasiswa bimbingan Anda belum mengajukan sesi bimbingan.')
    ).toBeInTheDocument();
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

  // TODO: pre-existing — fitur pindah ke LecturerRequests.tsx
  // Pindahkan test ini ke LecturerRequests.test.tsx saat file itu dibuat.
  it('renders search placeholder "Cari NIM atau nama..."', async () => {
    renderDashboard();

    expect(screen.getByPlaceholderText('Cari NIM atau nama...')).toBeInTheDocument();
  });
});
