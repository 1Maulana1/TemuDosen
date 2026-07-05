/**
 * Vitest tests for JitsiVideoProvider (06-08-T1) — mounts with the correct
 * roomName/domain and transitions loading -> ready via the mocked API,
 * using the @jitsi/react-sdk jsdom shim in test/setup.ts.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import JitsiVideoProvider from './JitsiVideoProvider';

describe('JitsiVideoProvider', () => {
  it('mounts with the correct roomName and domain', () => {
    render(<JitsiVideoProvider roomName="temudosen-session-42" displayName="Dr. Test" />);
    const mock = screen.getByTestId('jitsi-mock-fire-ready');
    expect(mock).toHaveAttribute('data-room-name', 'temudosen-session-42');
    expect(mock).toHaveAttribute('data-domain', 'meet.jit.si');
  });

  it('shows the loading state before onApiReady fires', () => {
    render(<JitsiVideoProvider roomName="temudosen-session-42" displayName="Dr. Test" />);
    expect(screen.getByText('Menghubungkan panggilan video…')).toBeInTheDocument();
  });

  it('transitions past loading once the mocked onApiReady fires', () => {
    render(<JitsiVideoProvider roomName="temudosen-session-42" displayName="Dr. Test" />);
    expect(screen.getByText('Menghubungkan panggilan video…')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('jitsi-mock-fire-ready'));

    expect(screen.queryByText('Menghubungkan panggilan video…')).not.toBeInTheDocument();
  });

  it('wraps the container in a labeled group for screen readers', () => {
    render(<JitsiVideoProvider roomName="temudosen-session-42" displayName="Dr. Test" />);
    expect(screen.getByRole('group', { name: 'Panggilan video sesi bimbingan' })).toBeInTheDocument();
  });
});
