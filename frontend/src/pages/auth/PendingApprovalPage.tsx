/**
 * PendingApprovalPage (S-05, D-20) — shown to authenticated but unapproved users.
 *
 * Amber/warning card with hourglass_empty icon.
 * Heading: "Akun Menunggu Persetujuan"
 * Body: exact UI-SPEC copy from Copywriting Contract.
 * Only action: logout.
 * No nav (user is not yet approved for feature access).
 */
import { logout } from '../../api/auth';
import { useNavigate } from 'react-router';

export default function PendingApprovalPage() {
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="font-headline font-bold text-2xl text-primary">TemuDosen</h1>
        </div>

        {/* Pending approval banner — amber/warning card */}
        <div className="bg-white rounded-2xl shadow-sm border border-warning/20 p-6">
          <div className="flex flex-col items-center text-center">
            {/* Hourglass icon */}
            <div className="w-16 h-16 bg-warning/10 rounded-2xl flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-warning text-4xl">hourglass_empty</span>
            </div>

            {/* Heading */}
            <h2 className="font-headline font-bold text-lg text-slate-800 mb-3">
              Akun Menunggu Persetujuan
            </h2>

            {/* Body copy — exact from UI-SPEC Copywriting Contract */}
            <p className="text-sm font-body text-slate-500 leading-relaxed mb-6">
              Akun Anda sedang diverifikasi oleh Admin. Anda akan mendapatkan akses penuh setelah
              persetujuan.
            </p>

            {/* Logout — only available action */}
            <button
              type="button"
              onClick={handleLogout}
              className="w-full py-3 px-6 rounded-xl border border-gray-200 bg-white text-sm font-bold text-slate-600 font-body min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              Keluar
            </button>
          </div>
        </div>

        {/* Help text */}
        <p className="text-center mt-6 text-[11px] font-body text-slate-400">
          Hubungi admin jika verifikasi membutuhkan waktu lebih dari 1×24 jam.
        </p>
      </div>
    </main>
  );
}
