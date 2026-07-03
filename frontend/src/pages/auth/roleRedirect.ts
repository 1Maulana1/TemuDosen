/**
 * Shared role-redirect helper for the per-role login pages
 * (LoginMahasiswaPage / LoginDosenPage / LoginKaprodiPage).
 *
 * Mirrors the local getRoleRedirect in LoginPage.tsx exactly — duplicated here
 * (not imported from LoginPage.tsx) because LoginPage.tsx is out of scope for
 * this task and its helper isn't exported.
 */
import type { User } from '../../api/auth';

export function getRoleRedirect(user: User): string {
  switch (user.role) {
    case 'student':
      return '/mahasiswa';
    case 'lecturer':
      return '/dosen';
    case 'admin':
      return '/admin/pengguna';
    case 'kaprodi':
      return '/';
    default:
      return '/';
  }
}
