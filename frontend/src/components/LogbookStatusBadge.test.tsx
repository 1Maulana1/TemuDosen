/**
 * Vitest tests for LogbookStatusBadge (06-06-T1).
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LogbookStatusBadge from './LogbookStatusBadge';
import type { LogbookStatus } from '../api/logbook';

const EXPECTED_LABELS: Record<LogbookStatus, string> = {
  pending: 'Menunggu Diproses',
  transcribing: 'Mentranskripsi…',
  summarizing: 'Merangkum AI…',
  ready_for_review: 'Siap Ditinjau',
  approved: 'Disetujui',
  failed: 'Gagal Diproses',
};

describe('LogbookStatusBadge', () => {
  (Object.keys(EXPECTED_LABELS) as LogbookStatus[]).forEach((status) => {
    it(`renders the correct Bahasa label for "${status}"`, () => {
      render(<LogbookStatusBadge status={status} />);
      expect(screen.getByText(EXPECTED_LABELS[status])).toBeInTheDocument();
    });
  });

  it('exposes role="status" for the in-progress "transcribing" state', () => {
    render(<LogbookStatusBadge status="transcribing" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('exposes role="status" for the in-progress "summarizing" state', () => {
    render(<LogbookStatusBadge status="summarizing" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('does NOT expose role="status" for terminal states', () => {
    render(<LogbookStatusBadge status="approved" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
