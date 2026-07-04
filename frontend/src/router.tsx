import { createBrowserRouter, redirect } from 'react-router';

import LoginPage from './pages/auth/LoginPage';
import LoginMahasiswaPage from './pages/auth/LoginMahasiswaPage';
import LoginDosenPage from './pages/auth/LoginDosenPage';
import LoginKetuaJurusanPage from './pages/auth/LoginKetuaJurusanPage';
import RegisterRolePage from './pages/auth/RegisterRolePage';
import RegisterStudentPage from './pages/auth/RegisterStudentPage';
import RegisterLecturerPage from './pages/auth/RegisterLecturerPage';
import PendingApprovalPage from './pages/auth/PendingApprovalPage';
import UserApproval from './pages/admin/UserApproval';
import SymptomConfig from './pages/admin/SymptomConfig';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminLogs from './pages/admin/AdminLogs';
import StudentDashboard from './pages/student/StudentDashboard';
import SubmissionForm from './pages/student/SubmissionForm';
import StudentQueue from './pages/student/StudentQueue';
import StudentProfile from './pages/student/StudentProfile';
import LecturerDashboard from './pages/lecturer/LecturerDashboard';
import LecturerRequests from './pages/lecturer/LecturerRequests';
import LecturerQueue from './pages/lecturer/LecturerQueue';
import LecturerSettings from './pages/lecturer/LecturerSettings';
import KetuaJurusanDashboard from './pages/ketua-jurusan/KetuaJurusanDashboard';
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
    ketua_jurusan: '/ketua-jurusan',
  };
  throw redirect(dest[user.role] ?? '/login');
}

export const router = createBrowserRouter([
  // Public
  { path: '/login', element: <LoginPage /> },
  { path: '/login/mahasiswa', element: <LoginMahasiswaPage /> },
  { path: '/login/dosen', element: <LoginDosenPage /> },
  { path: '/login/ketua-jurusan', element: <LoginKetuaJurusanPage /> },
  { path: '/register', element: <RegisterRolePage /> },
  { path: '/register/mahasiswa', element: <RegisterStudentPage /> },
  { path: '/register/dosen', element: <RegisterLecturerPage /> },
  { path: '/pending-approval', element: <PendingApprovalPage /> },

  // Student
  {
    id: 'mahasiswa',
    path: '/mahasiswa',
    loader: requireRole('student'),
    children: [
      { index: true, element: <StudentDashboard /> },
      { path: 'ajukan', element: <SubmissionForm /> },
      { path: 'queue', element: <StudentQueue /> },
      { path: 'profil', element: <StudentProfile /> },
    ],
  },

  // Lecturer
  {
    id: 'dosen',
    path: '/dosen',
    loader: requireRole('lecturer'),
    children: [
      { index: true, element: <LecturerDashboard /> },
      { path: 'requests', element: <LecturerRequests /> },
      { path: 'queue', element: <LecturerQueue /> },
      { path: 'pengaturan', element: <LecturerSettings /> },
    ],
  },

  // Admin
  {
    id: 'admin',
    path: '/admin',
    loader: requireRole('admin'),
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: 'pengguna', element: <UserApproval /> },
      { path: 'katalog-gejala', element: <SymptomConfig /> },
      { path: 'logs', element: <AdminLogs /> },
    ],
  },

  // Ketua Jurusan
  {
    id: 'ketua-jurusan',
    path: '/ketua-jurusan',
    loader: requireRole('ketua_jurusan'),
    children: [
      { index: true, element: <KetuaJurusanDashboard /> },
    ],
  },

  // Root → redirect by role
  { path: '/', loader: rootLoader, element: <></> },
]);
