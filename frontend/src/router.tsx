/**
 * React Router configuration for TemuDosen.
 *
 * All Phase-1 routes are scaffolded here as placeholders per SKELETON.md.
 * Feature plans replace placeholder components by editing their own page files only —
 * router.tsx is NOT re-edited after Wave 0 except to swap a lazy import target.
 *
 * Auth loaders:
 * - requireAuth: redirects unauthenticated users to /login
 *                redirects unapproved users to /pending-approval (Pitfall 8 prevention)
 * - requireRole(role): requireAuth + role check; redirects wrong-role users to /
 */
import { createBrowserRouter, redirect } from 'react-router';

import LoginPage from './pages/auth/LoginPage';
import RegisterRolePage from './pages/auth/RegisterRolePage';
import RegisterStudentPage from './pages/auth/RegisterStudentPage';
import RegisterLecturerPage from './pages/auth/RegisterLecturerPage';
import PendingApprovalPage from './pages/auth/PendingApprovalPage';
import UserApproval from './pages/admin/UserApproval';
import { getCurrentUser } from './api/auth';
import type { User } from './api/auth';

// ── Route Loaders ──────────────────────────────────────────────────────────────

/**
 * requireAuth loader — called on every protected route.
 * Fetches current user; if absent → /login; if unapproved → /pending-approval.
 */
async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw redirect('/login');
  if (!user.is_approved) throw redirect('/pending-approval');
  return user;
}

/**
 * requireRole loader factory — wraps requireAuth with a role check.
 * Wrong role redirects to / (root).
 */
function requireRole(role: User['role']) {
  return async (): Promise<User> => {
    const user = await requireAuth();
    if (user.role !== role) throw redirect('/');
    return user;
  };
}

// ── Placeholder components for routes implemented by later plans ───────────────

const Placeholder = ({ route }: { route: string }) => (
  <div data-route={route} style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
    <h1>TemuDosen</h1>
    <p>Route: <code>{route}</code></p>
    <p style={{ color: '#6B7280' }}>This page is being built. Check back soon.</p>
  </div>
);

// ── Router ─────────────────────────────────────────────────────────────────────

export const router = createBrowserRouter([
  // ── Public routes (no auth required) ────────────────────────────────────────
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterRolePage />, // Plan 02
  },
  {
    path: '/register/mahasiswa',
    element: <RegisterStudentPage />, // Plan 02
  },
  {
    path: '/register/dosen',
    element: <RegisterLecturerPage />, // Plan 02
  },

  // ── Authenticated + unapproved (D-20 pending-approval gate) ─────────────────
  {
    path: '/pending-approval',
    element: <PendingApprovalPage />, // Plan 02
  },

  // ── Student routes (requireRole('student')) ──────────────────────────────────
  {
    path: '/mahasiswa',
    loader: requireRole('student'),
    children: [
      {
        index: true,
        element: <Placeholder route="/mahasiswa" />, // Plan 04
      },
      {
        path: 'ajukan',
        element: <Placeholder route="/mahasiswa/ajukan" />, // Plan 04
      },
    ],
  },

  // ── Lecturer routes (requireRole('lecturer')) ────────────────────────────────
  {
    path: '/dosen',
    loader: requireRole('lecturer'),
    children: [
      {
        index: true,
        element: <Placeholder route="/dosen" />, // Plan 05
      },
    ],
  },

  // ── Admin routes (requireRole('admin')) ─────────────────────────────────────
  {
    path: '/admin',
    loader: requireRole('admin'),
    children: [
      {
        path: 'katalog-gejala',
        element: <Placeholder route="/admin/katalog-gejala" />, // Plan 03
      },
      {
        path: 'pengguna',
        element: <UserApproval />, // Plan 02
      },
    ],
  },

  // ── Root redirect ────────────────────────────────────────────────────────────
  {
    path: '/',
    loader: requireAuth,
    // Root redirects by role after auth check
    element: <Placeholder route="/" />,
  },
]);
