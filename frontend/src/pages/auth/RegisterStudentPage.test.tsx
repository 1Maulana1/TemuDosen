/**
 * Vitest tests for RegisterStudentPage (Plan 02).
 *
 * Tests:
 * 1. Adviser dropdown shows only approved lecturers (MSW-mocked Pitfall 7 compliance)
 * 2. Submitting without filling required fields shows "Kolom ini wajib diisi." errors
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { server } from '../../test/setup';
import RegisterStudentPage from './RegisterStudentPage';

// MSW handler fixtures
const APPROVED_LECTURERS = [
  { id: 1, full_name: 'Dr. Approved One', nidn: '0011111111', email: 'one@test.com' },
  { id: 2, full_name: 'Dr. Approved Two', nidn: '0022222222', email: 'two@test.com' },
];

describe('RegisterStudentPage', () => {
  beforeEach(() => {
    // Override MSW to return only approved lecturers
    server.use(
      http.get('/api/users/lecturers/', () => {
        return HttpResponse.json(APPROVED_LECTURERS);
      })
    );
  });

  it('renders the adviser dropdown with only approved lecturers', async () => {
    render(
      <MemoryRouter>
        <RegisterStudentPage />
      </MemoryRouter>
    );

    // Wait for dropdown to populate
    await waitFor(() => {
      expect(screen.getByText('Dr. Approved One')).toBeInTheDocument();
    });

    expect(screen.getByText('Dr. Approved Two')).toBeInTheDocument();
    // Confirm dropdown itself is present
    const select = screen.getByRole('combobox', { name: /Pilih Dosen Pembimbing/i });
    expect(select).toBeInTheDocument();
    // Should have 3 options: placeholder + 2 lecturers
    expect(select.querySelectorAll('option').length).toBe(3);
  });

  it('shows required-field error when submitting without filling NIM', async () => {
    server.use(
      http.get('/api/users/lecturers/', () => {
        return HttpResponse.json(APPROVED_LECTURERS);
      })
    );

    render(
      <MemoryRouter>
        <RegisterStudentPage />
      </MemoryRouter>
    );

    // Wait for form to be ready
    await waitFor(() => {
      expect(screen.getByText('Dr. Approved One')).toBeInTheDocument();
    });

    // Submit without filling any field
    const submitButton = screen.getByRole('button', { name: /Daftar Sekarang/i });
    fireEvent.click(submitButton);

    // Required field error should appear for NIM
    await waitFor(() => {
      const errors = screen.getAllByText('Kolom ini wajib diisi.');
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it('shows the Daftar Sekarang CTA button', async () => {
    render(
      <MemoryRouter>
        <RegisterStudentPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /Daftar Sekarang/i })).toBeInTheDocument();
  });
});
