/**
 * Vitest tests for StudentLogbookView (06-09-T3) — proves the manual-notes
 * summary shape ({manual_notes: string}, set by ManualNotesView) renders as
 * text instead of crashing, and that the normal structured-summary case is
 * unaffected.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import StudentLogbookView from './StudentLogbookView';
import * as logbookApi from '../../api/logbook';
import type { LogbookDetail } from '../../api/logbook';

vi.mock('../../api/logbook', async () => {
  const actual = await vi.importActual<typeof logbookApi>('../../api/logbook');
  return {
    ...actual,
    getStudentLogbook: vi.fn(),
  };
});

const STRUCTURED_LOGBOOK: LogbookDetail = {
  id: 1,
  session_id: 42,
  student_nim: '20230001',
  student_name: 'Test Student',
  session_date: '2026-07-01T10:00:00Z',
  status: 'approved',
  is_manual: false,
  source_mode: 'offline',
  transcript: 'Ini transkrip contoh sesi bimbingan.',
  summary_raw: {
    advice_points: [{ topic: 'Metodologi', detail: 'Perbaiki metodologi penelitian' }],
    improvement_notes: [],
  },
  summary_edited: null,
  approved_at: '2026-07-01T11:00:00Z',
};

const MANUAL_LOGBOOK: LogbookDetail = {
  ...STRUCTURED_LOGBOOK,
  is_manual: true,
  summary_edited: { manual_notes: 'Catatan manual dosen contoh.' },
};

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/logbook/42']}>
      <Routes>
        <Route path="/logbook/:sessionId" element={<StudentLogbookView />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('StudentLogbookView (S-15)', () => {
  beforeEach(() => {
    vi.mocked(logbookApi.getStudentLogbook).mockReset();
  });

  it('manual_notes_summary_renders_without_crashing: renders manual notes text instead of throwing', async () => {
    vi.mocked(logbookApi.getStudentLogbook).mockResolvedValue(MANUAL_LOGBOOK);
    renderScreen();

    expect(await screen.findByText('Catatan manual dosen contoh.')).toBeInTheDocument();
    expect(screen.getByText('Catatan Manual Dosen')).toBeInTheDocument();
    expect(screen.queryByText('Saran Dosen')).not.toBeInTheDocument();
  });

  it('structured_summary_still_renders: advice_points/improvement_notes render unaffected', async () => {
    vi.mocked(logbookApi.getStudentLogbook).mockResolvedValue(STRUCTURED_LOGBOOK);
    renderScreen();

    expect(await screen.findByText('Metodologi')).toBeInTheDocument();
    expect(screen.getByText('Perbaiki metodologi penelitian')).toBeInTheDocument();
    expect(screen.queryByText('Catatan Manual Dosen')).not.toBeInTheDocument();
  });
});
