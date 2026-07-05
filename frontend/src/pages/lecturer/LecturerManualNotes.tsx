/**
 * LecturerManualNotes — S-18 (STT-07). Manual-notes fallback when the
 * STT/LLM pipeline failed. Reuses LecturerDashboard's textarea classes.
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { saveManualNotes } from '../../api/logbook';

export default function LecturerManualNotes() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!sessionId || !notes.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      await saveManualNotes(Number(sessionId), notes.trim());
      navigate('/dosen/logbook');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menyimpan catatan manual.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-gray-50 min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 h-16 max-w-md mx-auto flex items-center px-4">
        <span className="font-headline font-bold text-lg text-primary">Catatan Manual</span>
      </header>

      <main className="pt-20 pb-8 px-4 max-w-md mx-auto space-y-4">
        {error && <div className="bg-error/10 border border-error/20 rounded-xl p-3 text-sm text-error font-bold">{error}</div>}

        <section className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-error text-xl" aria-hidden="true">error_outline</span>
            <h2 className="font-headline font-bold text-base text-error">Pemrosesan Otomatis Gagal</h2>
          </div>
          <p className="text-sm text-neutral-gray">
            Transkripsi atau ringkasan otomatis untuk sesi ini gagal diproses. Tulis catatan hasil
            bimbingan secara manual agar tetap tercatat di logbook.
          </p>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tulis catatan hasil bimbingan di sini…"
            rows={4}
            className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />

          <button
            type="button"
            disabled={!notes.trim() || saving}
            onClick={handleSave}
            className="w-full py-3 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            {saving ? 'Menyimpan…' : 'Simpan Catatan Manual'}
          </button>
        </section>
      </main>
    </div>
  );
}
