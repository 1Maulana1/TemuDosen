/**
 * Vitest test for the StudentDashboard "Progres Skripsi" section — audit T2:
 * real thesis-chapter checklist backed by /api/thesis-progress/ (was static mock).
 */
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router';
import { server } from '../../test/setup';
import StudentDashboard from './StudentDashboard';

vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router')>();
  return {
    ...actual,
    useRouteLoaderData: () => ({
      id: 1, email: 'student@test.com', full_name: 'Budi Santoso',
      role: 'student', is_approved: true, nim: '20230001', adviser: null,
    }),
    useLocation: () => ({ state: null, pathname: '/mahasiswa' }),
  };
});

function chaptersPayload(completedOrders: number[] = []) {
  const titles = ['Bab I — Pendahuluan', 'Bab II — Tinjauan Pustaka', 'Bab III — Metodologi Penelitian'];
  const chapters = titles.map((title, i) => ({
    id: i + 1, order: i + 1, title, is_completed: completedOrders.includes(i + 1),
  }));
  const completed = chapters.filter((c) => c.is_completed).length;
  return { chapters, total: chapters.length, completed, percent: Math.round((completed / chapters.length) * 100) };
}

describe('StudentDashboard — Progres Skripsi (T2)', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/submissions/', () => HttpResponse.json([])),
      http.get('/api/queue/my/', () => HttpResponse.json({ hasActiveQueue: false, session: null })),
      http.get('/api/thesis-progress/', () => HttpResponse.json(chaptersPayload([1]))),
    );
  });

  it('renders real chapters and the completion percent', async () => {
    render(<MemoryRouter><StudentDashboard /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Bab I — Pendahuluan')).toBeInTheDocument());
    expect(screen.getByText('Bab III — Metodologi Penelitian')).toBeInTheDocument();
    expect(screen.getByText('33%')).toBeInTheDocument();  // 1 of 3 done
  });

  it('toggling a chapter PATCHes it and updates the percent optimistically', async () => {
    let patched: { id: string; body: unknown } | null = null;
    server.use(
      http.patch('/api/thesis-progress/:id/', async ({ params, request }) => {
        patched = { id: params.id as string, body: await request.json() };
        return HttpResponse.json({ id: 2, order: 2, title: 'Bab II — Tinjauan Pustaka', is_completed: true });
      })
    );

    render(<MemoryRouter><StudentDashboard /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Bab II — Tinjauan Pustaka')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Bab II — Tinjauan Pustaka'));

    await waitFor(() => expect(screen.getByText('67%')).toBeInTheDocument());  // 2 of 3
    expect(patched?.id).toBe('2');
    expect(patched?.body).toEqual({ is_completed: true });
  });
});
