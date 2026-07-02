/**
 * Vitest tests for SymptomConfig (S-10, Plan 03).
 *
 * Tests (MSW-mocked):
 * 1. The 6 seeded rows render after fetching from /api/symptoms/.
 * 2. Entering edit mode, changing a duration, and clicking "Simpan Semua Perubahan"
 *    issues a POST to /api/symptoms/bulk-update/.
 * 3. The delete confirm modal renders with exact Copywriting Contract copy.
 * 4. "Tambah Gejala" button is present.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../../test/setup';
import SymptomConfig from './SymptomConfig';

// ── MSW fixture data ───────────────────────────────────────────────────────────

const SEEDED_SYMPTOMS = [
  { id: 1, name: 'Analisis data', category: 'Umum', duration_minutes: 45, is_active: true, created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' },
  { id: 2, name: 'Konflik dengan pembimbing', category: 'Umum', duration_minutes: 45, is_active: true, created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' },
  { id: 3, name: 'Manajemen waktu', category: 'Umum', duration_minutes: 30, is_active: true, created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' },
  { id: 4, name: 'Metodologi penelitian', category: 'Umum', duration_minutes: 60, is_active: true, created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' },
  { id: 5, name: 'Penulisan & struktur', category: 'Umum', duration_minutes: 30, is_active: true, created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' },
  { id: 6, name: 'Tinjauan pustaka', category: 'Umum', duration_minutes: 30, is_active: true, created_at: '2026-06-25T00:00:00Z', updated_at: '2026-06-25T00:00:00Z' },
];

describe('SymptomConfig (S-10)', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/symptoms/', () => {
        return HttpResponse.json(SEEDED_SYMPTOMS);
      }),
      // Default bulk-update handler (override per test as needed)
      http.post('/api/symptoms/bulk-update/', () => {
        return HttpResponse.json(SEEDED_SYMPTOMS);
      }),
      // Default delete handler
      http.delete('/api/symptoms/:id/', () => {
        return new HttpResponse(null, { status: 204 });
      }),
    );
  });

  // ── Test 1: 6 rows render ──────────────────────────────────────────────────

  it('renders all 6 seeded symptom rows after loading', async () => {
    render(<SymptomConfig />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Analisis data')).toBeInTheDocument();
    });

    // All 6 seeded categories should be in the table
    expect(screen.getByText('Analisis data')).toBeInTheDocument();
    expect(screen.getByText('Konflik dengan pembimbing')).toBeInTheDocument();
    expect(screen.getByText('Manajemen waktu')).toBeInTheDocument();
    expect(screen.getByText('Metodologi penelitian')).toBeInTheDocument();
    expect(screen.getByText('Penulisan & struktur')).toBeInTheDocument();
    expect(screen.getByText('Tinjauan pustaka')).toBeInTheDocument();
  });

  // ── Test 2: edit + save fires bulk-update ─────────────────────────────────

  it('enters edit mode, changes duration, and fires bulk-update on save', async () => {
    const bulkUpdateMock = vi.fn().mockReturnValue(HttpResponse.json(SEEDED_SYMPTOMS));

    server.use(
      http.post('/api/symptoms/bulk-update/', ({ request }) => {
        return bulkUpdateMock(request);
      })
    );

    render(<SymptomConfig />);

    // Wait for rows to appear
    await waitFor(() => {
      expect(screen.getByText('Analisis data')).toBeInTheDocument();
    });

    // Click the first "Edit gejala" button
    const editButtons = screen.getAllByRole('button', { name: 'Edit gejala' });
    expect(editButtons.length).toBeGreaterThan(0);
    fireEvent.click(editButtons[0]);

    // Duration input should now be visible
    const durationInput = screen.getAllByLabelText(/Durasi menit baris 1/i)[0];
    expect(durationInput).toBeInTheDocument();

    // Change the duration value
    fireEvent.change(durationInput, { target: { value: '90' } });
    expect((durationInput as HTMLInputElement).value).toBe('90');

    // Click "Simpan Semua Perubahan"
    const saveButton = screen.getByRole('button', { name: /Simpan Semua Perubahan/i });
    expect(saveButton).toBeInTheDocument();
    fireEvent.click(saveButton);

    // Bulk-update endpoint should have been called
    await waitFor(() => {
      expect(bulkUpdateMock).toHaveBeenCalledTimes(1);
    });
  });

  // ── Test 3: delete confirm modal copy ────────────────────────────────────

  it('shows the delete confirmation modal with exact copy when trash icon is clicked', async () => {
    render(<SymptomConfig />);

    // Wait for rows to load
    await waitFor(() => {
      expect(screen.getByText('Analisis data')).toBeInTheDocument();
    });

    // Click the first "Hapus gejala" button
    const deleteButtons = screen.getAllByRole('button', { name: 'Hapus gejala' });
    expect(deleteButtons.length).toBeGreaterThan(0);
    fireEvent.click(deleteButtons[0]);

    // Modal should render with exact Copywriting Contract copy (FR-AD01)
    expect(screen.getByText('Hapus gejala ini?')).toBeInTheDocument();
    expect(screen.getByText(
      'Menghapus gejala ini akan mempengaruhi kalkulasi estimasi antrian. Yakin ingin menghapus?'
    )).toBeInTheDocument();

    // "Batal" and "Hapus" buttons in the modal
    expect(screen.getByRole('button', { name: /^Batal$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Hapus$/i })).toBeInTheDocument();
  });

  // ── Test 4: Tambah Gejala button present ─────────────────────────────────

  it('renders the "Tambah Gejala" button', async () => {
    render(<SymptomConfig />);

    // The button is in the DOM immediately (before data loads)
    const addButton = screen.getByRole('button', { name: /Tambah Gejala/i });
    expect(addButton).toBeInTheDocument();
  });

  // ── Test 5: page heading and subheading ──────────────────────────────────

  it('renders the page heading and subheading', async () => {
    render(<SymptomConfig />);

    expect(screen.getByText('Katalog Gejala Akademik')).toBeInTheDocument();
    expect(screen.getByText('Atur kategori gejala dan bobot durasi bimbingan')).toBeInTheDocument();
  });

  // ── Test 6: Tambah Gejala adds a new editable row ─────────────────────────

  it('adds a new editable row when "Tambah Gejala" is clicked', async () => {
    render(<SymptomConfig />);

    await waitFor(() => {
      expect(screen.getByText('Analisis data')).toBeInTheDocument();
    });

    // Count existing edit inputs (should be 0 before clicking)
    const rowsBefore = screen.queryAllByLabelText(/Nama gejala baris/i);
    expect(rowsBefore.length).toBe(0);

    // Click "Tambah Gejala"
    const addButton = screen.getByRole('button', { name: /Tambah Gejala/i });
    fireEvent.click(addButton);

    // Now should have one new editable name input
    const nameInputsAfter = screen.getAllByLabelText(/Nama gejala baris/i);
    expect(nameInputsAfter.length).toBeGreaterThan(0);
  });
});
