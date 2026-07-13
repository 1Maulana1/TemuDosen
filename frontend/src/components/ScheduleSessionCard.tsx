/**
 * ScheduleSessionCard — dosen full control: pilih mahasiswa bimbingan + tanggal
 * lalu klik "Jadwalkan". Sesi langsung dibuat dan mahasiswa otomatis menerima
 * notifikasi (hanya informasi — tidak ada langkah approve di sisi mahasiswa).
 *
 * Dipakai di sidebar LecturerDashboard, di bawah "Sesi Berlangsung".
 */
import { useState, useEffect, type FormEvent } from 'react';
import { getAdvisees, scheduleSession, type Advisee } from '../api/sessions';

export default function ScheduleSessionCard({ onScheduled }: { onScheduled?: () => void }) {
  const [advisees, setAdvisees] = useState<Advisee[]>([]);
  const [studentId, setStudentId] = useState('');
  const [when, setWhen] = useState('');
  const [method, setMethod] = useState<'offline' | 'online'>('offline');
  const [meetingLink, setMeetingLink] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    getAdvisees().then(setAdvisees).catch(() => setAdvisees([]));
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!studentId || !when || submitting) return;
    setSubmitting(true);
    setMsg(null);
    try {
      await scheduleSession({
        student_id: Number(studentId),
        scheduled_at: new Date(when).toISOString(),
        method,
        meeting_link: method === 'online' ? meetingLink.trim() : undefined,
        note: note.trim() || undefined,
      });
      setMsg({ kind: 'ok', text: 'Jadwal dibuat — mahasiswa telah dinotifikasi.' });
      setStudentId(''); setWhen(''); setMethod('offline'); setMeetingLink(''); setNote('');
      onScheduled?.();
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Gagal menjadwalkan sesi.' });
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full text-sm border border-gray-200 bg-white rounded-xl px-3 py-2.5 ' +
    'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary';

  return (
    <section className="bg-surface rounded-xl border border-gray-200 p-4 shadow-sm space-y-3">
      <h2 className="font-headline font-bold text-lg text-on-surface flex items-center gap-1.5">
        <span className="material-symbols-outlined text-primary" aria-hidden="true">edit_calendar</span>
        Jadwalkan Bimbingan
      </h2>
      <p className="text-[11px] text-on-surface-variant -mt-1.5">
        Pilih mahasiswa dan waktu — jadwal langsung dikirim sebagai notifikasi ke mahasiswa.
      </p>

      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        <div>
          <label htmlFor="sched-student" className="block text-xs font-bold text-slate-800 mb-1">Mahasiswa</label>
          <select id="sched-student" value={studentId} onChange={(e) => setStudentId(e.target.value)}
            required className={inputCls} disabled={submitting}>
            <option value="">— pilih mahasiswa bimbingan —</option>
            {advisees.map((a) => (
              <option key={a.id} value={a.id}>{a.full_name}{a.nim ? ` (${a.nim})` : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="sched-when" className="block text-xs font-bold text-slate-800 mb-1">Tanggal &amp; jam</label>
          <input id="sched-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
            required className={inputCls} disabled={submitting} />
        </div>

        <div>
          <label htmlFor="sched-method" className="block text-xs font-bold text-slate-800 mb-1">Metode</label>
          <select id="sched-method" value={method}
            onChange={(e) => setMethod(e.target.value as 'offline' | 'online')}
            className={inputCls} disabled={submitting}>
            <option value="offline">Tatap Muka</option>
            <option value="online">Online</option>
          </select>
        </div>

        {method === 'online' && (
          <div>
            <label htmlFor="sched-link" className="block text-xs font-bold text-slate-800 mb-1">Link meeting</label>
            <input id="sched-link" type="url" value={meetingLink} onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://…" required className={inputCls} disabled={submitting} />
          </div>
        )}

        <div>
          <label htmlFor="sched-note" className="block text-xs font-bold text-slate-800 mb-1">Catatan (opsional)</label>
          <textarea id="sched-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            placeholder="Topik / agenda bimbingan…" className={`${inputCls} resize-none`} disabled={submitting} />
        </div>

        {msg && (
          <p role="alert" aria-live="polite"
            className={`text-xs font-bold ${msg.kind === 'ok' ? 'text-success' : 'text-error'}`}>
            {msg.text}
          </p>
        )}

        <button type="submit" disabled={submitting || !studentId || !when}
          className="w-full py-3 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary-hover
                     disabled:opacity-60 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-1.5
                     focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
          <span className="material-symbols-outlined text-base" aria-hidden="true">event_available</span>
          {submitting ? 'Menjadwalkan…' : 'Jadwalkan'}
        </button>
      </form>
    </section>
  );
}
