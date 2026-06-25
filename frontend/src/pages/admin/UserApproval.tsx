/**
 * UserApproval (S-11) — admin user approval queue.
 *
 * Desktop sidebar layout.
 * Table columns: Nama | Role | Email | NIM/NIDN | Tanggal Daftar | Status | Aksi
 * Status uses StatusBadge.
 * Aksi: "Setujui" (text-success) + "Tolak" (text-error) — calls approveUser/rejectUser + refetch.
 * Empty state: "Tidak Ada Akun Menunggu" (Copywriting Contract).
 */
import { useState, useEffect } from 'react';
import { fetchPending, approveUser, rejectUser } from '../../api/users';
import StatusBadge from '../../components/StatusBadge';
import type { User } from '../../api/auth';

const SIDEBAR_LINKS = [
  { label: 'Dashboard', icon: 'dashboard', href: '/admin' },
  { label: 'Katalog Gejala', icon: 'category', href: '/admin/katalog-gejala' },
  { label: 'Pengguna', icon: 'group', href: '/admin/pengguna', active: true },
];

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    student: 'Mahasiswa',
    lecturer: 'Dosen',
    admin: 'Admin',
    kaprodi: 'Kaprodi',
  };
  return map[role] ?? role;
}

export default function UserApproval() {
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadPending() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPending();
      setPendingUsers(data);
    } catch {
      setError('Gagal memuat daftar pengguna. Coba muat ulang halaman.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPending();
  }, []);

  async function handleApprove(userId: number) {
    setActionLoading(userId);
    try {
      await approveUser(userId);
      await loadPending();
    } catch {
      setError('Gagal menyetujui pengguna. Silakan coba lagi.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(userId: number) {
    setActionLoading(userId);
    try {
      await rejectUser(userId);
      await loadPending();
    } catch {
      setError('Gagal menolak pengguna. Silakan coba lagi.');
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-100">
          <h1 className="font-headline font-bold text-xl text-primary">TemuDosen</h1>
          <p className="text-[11px] text-slate-400 font-label mt-0.5">Panel Admin</p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4">
          {SIDEBAR_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-body transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                link.active
                  ? 'bg-blue-50 text-primary border-r-4 border-primary font-bold'
                  : 'text-slate-600 hover:bg-gray-50 hover:text-slate-800'
              }`}
            >
              <span className="material-symbols-outlined text-xl">{link.icon}</span>
              {link.label}
            </a>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="ml-64 flex-1 overflow-y-auto px-8 py-6">
        {/* Page header */}
        <div className="mb-6">
          <h2 className="font-headline font-bold text-xl text-slate-900">
            Persetujuan Pengguna
          </h2>
          <p className="text-sm text-slate-500 font-body mt-1">
            Tinjau dan setujui pendaftaran mahasiswa dan dosen baru.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-3 bg-error/5 border border-error/20 rounded-xl text-sm text-error font-body" role="alert">
            {error}
          </div>
        )}

        {/* Table card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 font-body text-sm gap-2">
              <span className="material-symbols-outlined animate-spin">autorenew</span>
              Memuat data...
            </div>
          ) : pendingUsers.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mb-3">
                <span className="material-symbols-outlined text-slate-400 text-2xl">group</span>
              </div>
              <h3 className="font-headline font-bold text-slate-700 text-base mb-1">
                Tidak Ada Akun Menunggu
              </h3>
              <p className="text-sm text-slate-400 font-body">
                Semua pendaftaran telah diverifikasi.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-label">
                      Nama
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-label">
                      Role
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-label">
                      Email
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-label">
                      NIM/NIDN
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-label">
                      Tanggal Daftar
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-label">
                      Status
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-label">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pendingUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-body text-slate-800">
                        {user.full_name}
                      </td>
                      <td className="px-4 py-3 text-sm font-body text-slate-600">
                        {getRoleLabel(user.role)}
                      </td>
                      <td className="px-4 py-3 text-sm font-body text-slate-600">
                        {user.email}
                      </td>
                      <td className="px-4 py-3 text-sm font-body text-slate-600 font-label">
                        {user.nim ?? user.nidn ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-sm font-body text-slate-500">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status="MENUNGGU" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleApprove(user.id)}
                            disabled={actionLoading === user.id}
                            className="text-success font-bold text-sm font-body min-h-[44px] min-w-[44px] px-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded disabled:opacity-50 disabled:cursor-not-allowed hover:underline"
                          >
                            {actionLoading === user.id ? (
                              <span className="material-symbols-outlined animate-spin text-sm">autorenew</span>
                            ) : (
                              'Setujui'
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReject(user.id)}
                            disabled={actionLoading === user.id}
                            className="text-error font-bold text-sm font-body min-h-[44px] min-w-[44px] px-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded disabled:opacity-50 disabled:cursor-not-allowed hover:underline"
                          >
                            {actionLoading === user.id ? (
                              <span className="material-symbols-outlined animate-spin text-sm">autorenew</span>
                            ) : (
                              'Tolak'
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
