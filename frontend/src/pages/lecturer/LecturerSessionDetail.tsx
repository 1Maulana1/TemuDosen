/**
 * LecturerSessionDetail — /dosen/sesi/:id
 *
 * Phase 6 (UI-first, partial): dosen mendengar rekaman sesi (jika ada) dan
 * mengisi/menyetujui ringkasan hasil bimbingan secara MANUAL. Ini bukan
 * placeholder kosong — ini jalur fallback resmi di spec (STT-05: manual note
 * editor) selama pipeline STT/LLM otomatis belum dibangun. Begitu Phase 6
 * lanjutan menambah transkripsi otomatis, field `summary` yang sama tinggal
 * di-prefill oleh AI alih-alih diisi tangan.
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useParams, useRouteLoaderData } from 'react-router';
import {
  getLogbookDetail, approveLogbook, saveManualNotes, getSessionRecordingUrl,
  type LogbookDetail, type SessionSummaryContent,
} from '../../api/sessions';
import { logout, type User } from '../../api/auth';
import { AppNavbar, AppBottomNav, NAV_ITEMS } from '../../components/AppNav';
import SummaryContent from '../../components/SummaryContent';

function fmtIDR(v: string | null | undefined): string | null {
  const n = v == null ? NaN : Number(v);
  if (!isFinite(n)) return null;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return '-'; }
}

/** Ratakan ringkasan (manual atau terstruktur AI) menjadi teks untuk textarea. */
function summaryToText(c: SessionSummaryContent | null | undefined): string {
  if (!c) return '';
  if (c.manual_notes) return c.manual_notes;
  const lines: string[] = [];
  for (const a of c.advice_points ?? []) lines.push(`• ${a.topic}: ${a.detail}`);
  for (const n of c.improvement_notes ?? []) lines.push(`→ ${n.area}: ${n.action}`);
  return lines.join('\n');
}

export default function LecturerSessionDetail() {
  const user = useRouteLoaderData('dosen') as User;
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const sessionId = Number(id);

  const [data, setData] = useState<LogbookDetail | null>(null);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getLogbookDetail(sessionId)
      .then((d) => { setData(d); setSummaryDraft(summaryToText(d.summary_edited ?? d.summary_raw)); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat sesi.'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  async function handleApprove() {
    if (!data) return;
    setSaving(true);
    setMsg('');
    try {
      // AI menghasilkan draf → approve dengan ringkasan editan; selain itu jalur manual (STT-07).
      const updated = data.status === 'ready_for_review'
        ? await approveLogbook(sessionId, { manual_notes: summaryDraft })
        : await saveManualNotes(sessionId, summaryDraft);
      setData(updated);
      setMsg('Ringkasan disetujui — mahasiswa sekarang bisa melihatnya.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 5000);
    }
  }

  const isApproved = data?.status === 'approved';

  return (
    <div className="bg-gray-50 min-h-screen flex flex-col">
      <AppNavbar items={NAV_ITEMS.dosen} active="riwayat" userName={user?.full_name ?? 'Dosen'} onLogout={handleLogout} />

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-24 md:pb-8 space-y-5">
        <Link to="/dosen/riwayat" className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded">
          <span className="material-symbols-outlined text-base" aria-hidden="true">arrow_back</span>
          Kembali ke Riwayat
        </Link>

        {loading && (
          <div className="text-center py-16 text-on-surface-variant text-sm" aria-live="polite" aria-busy="true">
            <span className="material-symbols-outlined animate-spin text-3xl block mb-2">progress_activity</span>
            Memuat sesi...
          </div>
        )}

        {!loading && error && (
          <div className="bg-error/5 border border-error/20 rounded-xl p-4 text-center" aria-live="assertive">
            <p className="text-sm text-error">{error}</p>
          </div>
        )}

        {!loading && !error && data && (
          <>
            {msg && <div className="bg-success/10 border border-success/20 rounded-xl p-3 text-sm text-success font-bold">{msg}</div>}

            {/* Info sesi */}
            <section className="bg-surface rounded-2xl border border-gray-200 shadow-sm p-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary flex-shrink-0">
                  {data.mahasiswa_name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')}
                </div>
                <div className="min-w-0">
                  <p className="font-headline font-bold text-lg text-slate-900 truncate">{data.mahasiswa_name}</p>
                  <p className="text-sm text-on-surface-variant">{data.nim} · Selesai {fmtDateTime(data.ts2)}</p>
                </div>
              </div>
            </section>

            {/* Rekaman */}
            <section>
              <h2 className="font-headline font-bold text-lg text-slate-900 mb-3">Rekaman</h2>
              <div className="bg-surface rounded-2xl border border-gray-200 shadow-sm p-5">
                {data.has_recording ? (
                  <audio controls className="w-full" src={getSessionRecordingUrl(sessionId)}>
                    Browser Anda tidak mendukung pemutaran audio.
                  </audio>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-gray-300" aria-hidden="true">mic_off</span>
                    Sesi ini tidak memiliki rekaman.
                  </div>
                )}
              </div>
            </section>

            {/* Transkrip (hasil STT) — hanya muncul bila pipeline menghasilkannya */}
            {data.transcript && (
              <section>
                <h2 className="font-headline font-bold text-lg text-slate-900 mb-3">Transkrip</h2>
                <details className="bg-surface rounded-2xl border border-gray-200 shadow-sm">
                  <summary className="cursor-pointer select-none p-5 text-sm font-bold text-slate-700 flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded-2xl">
                    <span className="material-symbols-outlined text-base text-primary" aria-hidden="true">description</span>
                    Lihat transkrip otomatis
                    <span className="ml-auto text-[11px] font-normal text-on-surface-variant">hasil transkripsi AI — bisa tidak akurat</span>
                  </summary>
                  <div className="px-5 pb-5">
                    <p className="text-sm text-slate-600 whitespace-pre-wrap max-h-72 overflow-y-auto border-t border-gray-100 pt-3">
                      {data.transcript}
                    </p>
                  </div>
                </details>
              </section>
            )}

            {/* Ringkasan */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-headline font-bold text-lg text-slate-900">Ringkasan Hasil Bimbingan</h2>
                {isApproved && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success bg-success/10 rounded-full px-2 py-1">
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">check_circle</span>
                    Disetujui {fmtDateTime(data.approved_at)}
                  </span>
                )}
              </div>
              <div className="bg-surface rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
                {isApproved ? (
                  <SummaryContent content={data.summary_edited ?? data.summary_raw} />
                ) : (
                  <>
                    <p className="text-[11px] text-on-surface-variant">
                      {data.status === 'ready_for_review'
                        ? 'Draf ringkasan otomatis siap ditinjau — perbaiki bila perlu, lalu setujui.'
                        : 'Transkripsi & ringkasan otomatis belum tersedia — tuliskan ringkasan hasil bimbingan secara manual di bawah ini.'}
                    </p>
                    <textarea
                      value={summaryDraft}
                      onChange={(e) => setSummaryDraft(e.target.value)}
                      placeholder="Tuliskan ringkasan hasil bimbingan, saran, dan tindak lanjut untuk mahasiswa…"
                      rows={6}
                      className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                    <button type="button" disabled={saving || !summaryDraft.trim()} onClick={handleApprove}
                      className="w-full py-3 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary-hover disabled:opacity-60 min-h-[44px] flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
                      <span className="material-symbols-outlined text-base" aria-hidden="true">check_circle</span>
                      {saving ? 'Menyetujui…' : 'Setujui & Kirim ke Mahasiswa'}
                    </button>
                  </>
                )}

                {/* D-11: token & estimasi biaya LLM — hanya terisi bila ringkasan dibuat AI */}
                {data.llm_input_tokens != null && data.llm_output_tokens != null && (
                  <p className="flex items-center gap-1.5 text-[11px] text-on-surface-variant border-t border-gray-100 pt-3">
                    <span className="material-symbols-outlined text-sm" aria-hidden="true">smart_toy</span>
                    Diringkas AI · {data.llm_input_tokens.toLocaleString('id-ID')} token masuk,{' '}
                    {data.llm_output_tokens.toLocaleString('id-ID')} token keluar
                    {fmtIDR(data.llm_cost_estimate_idr) && <> · estimasi biaya {fmtIDR(data.llm_cost_estimate_idr)}</>}
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <AppBottomNav items={NAV_ITEMS.dosen} active="riwayat" />
    </div>
  );
}
