import { createBrowserRouter, redirect } from 'react-router';

import LoginPage from './pages/auth/LoginPage';
import RegisterRolePage from './pages/auth/RegisterRolePage';
import RegisterStudentPage from './pages/auth/RegisterStudentPage';
import RegisterLecturerPage from './pages/auth/RegisterLecturerPage';
import PendingApprovalPage from './pages/auth/PendingApprovalPage';
import UserApproval from './pages/admin/UserApproval';
import SymptomConfig from './pages/admin/SymptomConfig';
import AdminDashboard from './pages/admin/AdminDashboard';
import StudentDashboard from './pages/student/StudentDashboard';
import SubmissionForm from './pages/student/SubmissionForm';
import StudentQueue from './pages/student/StudentQueue';
import LecturerDashboard from './pages/lecturer/LecturerDashboard';
import LecturerRequests from './pages/lecturer/LecturerRequests';
import LecturerQueue from './pages/lecturer/LecturerQueue';
import KaprodiDashboard from './pages/kaprodi/KaprodiDashboard';
import { getCurrentUser } from './api/auth';
import type { User } from './api/auth';

async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw redirect('/login');
  if (!user.is_approved) throw redirect('/pending-approval');
  return user;
}

function requireRole(role: User['role']) {
  return async (): Promise<User> => {
    const user = await requireAuth();
    if (user.role !== role) throw redirect('/');
    return user;
  };
}

// Root: redirect by role
async function rootLoader(): Promise<never> {
  const user = await getCurrentUser();
  if (!user) throw redirect('/login');
  if (!user.is_approved) throw redirect('/pending-approval');
  const dest: Record<string, string> = {
    student: '/mahasiswa',
    lecturer: '/dosen',
    admin: '/admin',
    kaprodi: '/kaprodi',
  };
  throw redirect(dest[user.role] ?? '/login');
}

export const router = createBrowserRouter([
  // Public
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterRolePage /> },
  { path: '/register/mahasiswa', element: <RegisterStudentPage /> },
  { path: '/register/dosen', element: <RegisterLecturerPage /> },
  { path: '/pending-approval', element: <PendingApprovalPage /> },

  // Student
  {
    path: '/mahasiswa',
    loader: requireRole('student'),
    children: [
      { index: true, element: <StudentDashboard /> },
      { path: 'ajukan', element: <SubmissionForm /> },
      { path: 'queue', element: <StudentQueue /> },
    ],
  },

  // Lecturer
  {
    path: '/dosen',
    loader: requireRole('lecturer'),
    children: [
      { index: true, element: <LecturerDashboard /> },
      { path: 'requests', element: <LecturerRequests /> },
      { path: 'queue', element: <LecturerQueue /> },
    ],
  },

  // Admin
  {
    path: '/admin',
    loader: requireRole('admin'),
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: 'pengguna', element: <UserApproval /> },
      { path: 'katalog-gejala', element: <SymptomConfig /> },
    ],
  },

  // Kaprodi
  {
    path: '/kaprodi',
    loader: requireRole('kaprodi'),
    children: [
      { index: true, element: <KaprodiDashboard /> },
    ],
  },

  // Root → redirect by role
  { path: '/', loader: rootLoader, element: <></> },
]);
