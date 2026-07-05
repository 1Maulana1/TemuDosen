/**
 * Vitest tests for LecturerLogbookReview (06-06-T4) — behavioral proof of the
 * anti-rubber-stamp gate and groundedness top-sort, not just build/lint.
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import LecturerLogbookReview from './LecturerLogbookReview';
import * as logbookApi from '../../api/logbook';
import type { LogbookDetail } from '../../api/logbook';

vi.mock('../../api/logbook', async () => {
  const actual = await vi.importActual<typeof logbookApi>('../../api/logbook');
  return {
    ...actual,
    getLogbookDetail: vi.fn(),
    approveLogbook: vi.fn(),
    rejectLogbook: vi.fn(),
  };
});

const BASE_LOGBOOK: LogbookDetail = {
  id: 1,
  session_id: 42,
  student_nim: '20230001',
  student_name: 'Test Student',
  session_date: '2026-07-01T10:00:00Z',
  status: 'ready_for_review',
  is_manual: false,
  source_mode: 'offline',
  transcript: 'Ini transkrip contoh sesi bimbingan.',
  summary_raw: {
    advice_points: [
      { topic: 'Grounded Topic', detail: 'Detail yang ada di transkrip', grounded: true },
      { topic: 'Ungrounded Topic', detail: 'Detail yang tidak ada di transkrip', grounded: false },
    ],
    improvement_notes: [],
  },
  summary_edited: null,
  approved_at: null,
};

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/dosen/logbook/42']}>
      <Routes>
        <Route path="/dosen/logbook/:sessionId" element={<LecturerLogbookReview />} />
        <Route path="/dosen/logbook/:sessionId/manual" element={<div>MANUAL_NOTES_SCREEN</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LecturerLogbookReview (S-13)', () => {
  beforeEach(() => {
    vi.mocked(logbookApi.getLogbookDetail).mockResolvedValue(BASE_LOGBOOK);
    vi.mocked(logbookApi.approveLogbook).mockResolvedValue(BASE_LOGBOOK);
    vi.mocked(logbookApi.rejectLogbook).mockResolvedValue(BASE_LOGBOOK);
  });

  it('disabled_until_transcript_expanded: approve button is disabled before any interaction', async () => {
    renderScreen();
    const approveButton = await screen.findByRole('button', { name: 'Setujui & Simpan ke Logbook' });
    expect(approveButton).toBeDisabled();
  });

  it('stays_enabled_after_recollapse: enabled after expanding once, stays enabled after re-collapsing', async () => {
    renderScreen();
    const approveButton = await screen.findByRole('button', { name: 'Setujui & Simpan ke Logbook' });
    expect(approveButton).toBeDisabled();

    const toggle = screen.getByRole('button', { name: /Lihat Transkrip Lengkap/ });
    fireEvent.click(toggle);
    expect(approveButton).toBeEnabled();

    const collapseToggle = screen.getByRole('button', { name: /Sembunyikan Transkrip/ });
    fireEvent.click(collapseToggle);
    expect(approveButton).toBeEnabled();
  });

  it('ungrounded_chip_renders_and_sorted_first: ungrounded item renders the chip and sorts before the grounded item', async () => {
    renderScreen();
    await screen.findByText('Ungrounded Topic');

    const chips = screen.getAllByTestId('groundedness-chip');
    expect(chips).toHaveLength(1);

    const items = screen.getAllByTestId(/advice-item-/);
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Ungrounded Topic');
    expect(items[1]).toHaveTextContent('Grounded Topic');
    expect(items[1]).not.toHaveTextContent('Perlu Verifikasi');
  });

  it('click_opens_approve_modal: clicking the enabled approve button renders ApproveLogbookModal', async () => {
    renderScreen();

    const toggle = await screen.findByRole('button', { name: /Lihat Transkrip Lengkap/ });
    fireEvent.click(toggle);

    const approveButton = screen.getByRole('button', { name: 'Setujui & Simpan ke Logbook' });
    expect(approveButton).toBeEnabled();
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Konfirmasi Persetujuan Logbook' })).toBeInTheDocument();
    });
  });

  it('reject_button_opens_confirmation_modal: clicking "Tolak Ringkasan" renders RejectLogbookModal', async () => {
    renderScreen();

    const rejectButton = await screen.findByRole('button', { name: 'Tolak Ringkasan' });
    fireEvent.click(rejectButton);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Konfirmasi Penolakan Ringkasan' })).toBeInTheDocument();
    });
  });

  it('confirm_reject_calls_api_and_navigates_to_manual_notes: confirming reject calls rejectLogbook and navigates to the manual-notes route', async () => {
    renderScreen();

    const rejectButton = await screen.findByRole('button', { name: 'Tolak Ringkasan' });
    fireEvent.click(rejectButton);

    const confirmButton = await screen.findByRole('button', { name: 'Ya, Tolak' });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(logbookApi.rejectLogbook).toHaveBeenCalledWith(42);
    });
    await waitFor(() => {
      expect(screen.getByText('MANUAL_NOTES_SCREEN')).toBeInTheDocument();
    });
  });

  it('manual_notes_summary_renders_without_crashing: renders manual notes text instead of throwing', async () => {
    vi.mocked(logbookApi.getLogbookDetail).mockResolvedValue({
      ...BASE_LOGBOOK,
      status: 'approved',
      is_manual: true,
      summary_edited: { manual_notes: 'Catatan manual dosen contoh.' },
    });
    renderScreen();

    expect(await screen.findByText('Catatan manual dosen contoh.')).toBeInTheDocument();
    expect(screen.getByText('Catatan Manual Dosen')).toBeInTheDocument();
    expect(screen.queryByText('Saran Dosen')).not.toBeInTheDocument();
  });
});
