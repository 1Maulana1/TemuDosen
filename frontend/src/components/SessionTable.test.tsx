/**
 * Vitest test for SessionTable's session/logbook action (audit #1): a row linked
 * to a Session shows an "open session/logbook" button; an unlinked row does not.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SessionTable, { type SessionTableRow } from './SessionTable';

const fmtDate = (iso: string) => iso;

function row(overrides: Partial<SessionTableRow> = {}): SessionTableRow {
  return {
    id: 1, date: '2026-07-04T09:00:00Z', topic: 'Metodologi', dosen: 'Dr. Rina',
    status: 'SELESAI', fileUuid: 'u-1', fileName: 'draft.pdf',
    sessionId: null, logbookStatus: null, ...overrides,
  };
}

describe('SessionTable session linkage', () => {
  it('shows an open-session button for a linked row and calls onOpenSession', () => {
    const onOpenSession = vi.fn();
    render(
      <SessionTable
        rows={[row({ sessionId: 7, logbookStatus: 'approved' })]}
        onView={() => {}}
        onOpenSession={onOpenSession}
        fmtDate={fmtDate}
      />
    );
    const btn = screen.getByRole('button', { name: /Buka sesi & logbook/i });
    expect(btn).toHaveAttribute('title', 'Lihat logbook');
    fireEvent.click(btn);
    expect(onOpenSession).toHaveBeenCalledTimes(1);
    expect(onOpenSession.mock.calls[0][0].sessionId).toBe(7);
  });

  it('hides the open-session button when the row has no session', () => {
    render(
      <SessionTable rows={[row({ sessionId: null })]} onView={() => {}} onOpenSession={() => {}} fmtDate={fmtDate} />
    );
    expect(screen.queryByRole('button', { name: /Buka sesi & logbook/i })).not.toBeInTheDocument();
  });
});
