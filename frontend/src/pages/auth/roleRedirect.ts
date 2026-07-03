/**
 * Shared role-redirect helper for the per-role login pages
 * (LoginMahasiswaPage / LoginDosenPage / LoginKetuaJurusanPage / LoginPage).
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
    case 'ketua_jurusan':
      return '/ketua-jurusan';
    default:
      return '/';
  }
}
