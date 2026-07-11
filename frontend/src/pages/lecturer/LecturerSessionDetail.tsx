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
  getLogbookDetail, approveLogbook, rejectLogbook, saveManualNotes, getSessionRecordingUrl,
  getActionItems, addActionItem, updateActionItem, deleteActionItem, getLogbookExportUrl, retryPipeline,
  type LogbookDetail, type SessionSummaryContent, type ActionItem, type CampusSyncStatus,
} from '../../api/sessions';
import { logout, type User } from '../../api/auth';
import { getStudentThesisProgress, updateStudentThesisChapter, type ThesisProgress } from '../../api/thesis';
import { AppNavbar, AppBottomNav, NAV_ITEMS } from '../../components/AppNav';
import SummaryContent from '../../components/SummaryContent';
import RejectLogbookModal from '../../components/RejectLogbookModal';

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

/**
 * Inverse of summaryToText — reconstructs advice_points/improvement_notes from
 * the edited textarea using the same '•'/'→' line markers, so approving an
 * AI-generated draft preserves structure (backend splits advice_points into
 * ActionItem rows for Phase 7 on approve). If the lecturer rewrote the text
 * as free prose and dropped the markers, falls back to a manual_notes blob
 * instead of losing the edit or crashing — same graceful-degradation pattern
 * used throughout the STT/LLM pipeline (STT-07).
 */
function textToSummary(text: string): SessionSummaryContent {
  const advice_points: { topic: string; detail: string }[] = [];
  const improvement_notes: { area: string; action: string }[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    const isAdvice = line.startsWith('•');
    const isImprovement = line.startsWith('→');
    if (!isAdvice && !isImprovement) continue;
    const rest = line.slice(1).trim();
    const sep = rest.indexOf(':');
    if (sep === -1) continue;
    const key = rest.slice(0, sep).trim();
    const value = rest.slice(sep + 1).trim();
    if (!key || !value) continue;
    if (isAdvice) advice_points.push({ topic: key, detail: value });
    else improvement_notes.push({ area: key, action: value });
  }
  if (advice_points.length === 0 && improvement_notes.length === 0) {
    return { manual_notes: text };
  }
  return { advice_points, improvement_notes };
}

const CAMPUS_STATUS_META: Record<CampusSyncStatus, { label: string; cls: string }> = {
  synced: { label: 'Tersinkron', cls: 'text-success bg-success/10' },
  pending_retry: { label: 'Menunggu coba ulang', cls: 'text-warning bg-warning/10' },
  failed: { label: 'Gagal disinkron', cls: 'text-error bg-error/10' },
  not_synced: { label: 'Belum disinkron', cls: 'text-on-surface-variant bg-gray-100' },
};

function campusStatusChip(status: CampusSyncStatus | undefined) {
  const meta = CAMPUS_STATUS_META[status ?? 'not_synced'];
  return <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${meta.cls}`}>{meta.label}</span>;
}

export default function LecturerSessionDetail() {
  const user = useRouteLoaderData('dosen') as User;
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const sessionId = Number(id);

  const [data, setData] = useState<LogbookDetail | null>(null);
  const [summaryDraft, setSummaryDraft] = useState('');
  // Ringkasan manual dosen (opsional) yang disimpan bersama draf AI saat approve.
  const [manualNotes, setManualNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [newItemText, setNewItemText] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [itemsMsg, setItemsMsg] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const [thesis, setThesis] = useState<ThesisProgress | null>(null);
  const [thesisErr, setThesisErr] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getLogbookDetail(sessionId)
      .then((d) => {
        setData(d);
        setSummaryDraft(summaryToText(d.summary_edited ?? d.summary_raw));
        setThesisErr('');
        getStudentThesisProgress(d.mahasiswa_id)
          .then(setThesis)
          .catch(() => setThesisErr('Gagal memuat progres skripsi mahasiswa.'));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Gagal memuat sesi.'))
      .finally(() => setLoading(false));
    getActionItems(sessionId).then(setActionItems).catch(() => {});
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  async function handleToggleChapter(chapterId: number, next: boolean) {
    if (!data || !thesis) return;
    const prev = thesis;
    const chapters = thesis.chapters.map((c) => (c.id === chapterId ? { ...c, is_completed: next } : c));
    const completed = chapters.filter((c) => c.is_completed).length;
    setThesis({ ...thesis, chapters, completed, percent: chapters.length ? Math.round((completed / chapters.length) * 100) : 0 });
    setThesisErr('');
    try {
      await updateStudentThesisChapter(data.mahasiswa_id, chapterId, next);
    } catch (e) {
      setThesis(prev);  // rollback
      setThesisErr(e instanceof Error ? e.message : 'Gagal memperbarui progres skripsi.');
    }
  }

  async function handleAddItem() {
    const description = newItemText.trim();
    if (!description) return;
    setAddingItem(true);
    setItemsMsg('');
    try {
      const item = await addActionItem(sessionId, description);
      setActionItems((prev) => [item, ...prev]);
      setNewItemText('');
    } catch (e) {
      setItemsMsg(e instanceof Error ? e.message : 'Gagal menambah saran.');
    } finally {
      setAddingItem(false);
    }
  }

  async function handleSaveEdit(id: number) {
    const description = editText.trim();
    if (!description) return;
    setItemsMsg('');
    try {
      const updated = await updateActionItem(sessionId, id, description);
      setActionItems((prev) => prev.map((it) => (it.id === id ? { ...it, description: updated.description } : it)));
      setEditingId(null);
    } catch (e) {
      setItemsMsg(e instanceof Error ? e.message : 'Gagal mengubah saran.');
    }
  }

  async function handleDeleteItem(id: number) {
    setItemsMsg('');
    try {
      await deleteActionItem(sessionId, id);
      setActionItems((prev) => prev.filter((it) => it.id !== id));
    } catch (e) {
      setItemsMsg(e instanceof Error ? e.message : 'Gagal menghapus saran.');
    } finally {
      setDeleteConfirmId(null);
    }
  }

  const [retrying, setRetrying] = useState(false);
  async function handleRetry() {
    setRetrying(true);
    setItemsMsg('');
    try {
      await retryPipeline(sessionId);
      load();  // muat ulang status (pending → pipeline berjalan lagi)
    } catch (e) {
      setItemsMsg(e instanceof Error ? e.message : 'Gagal memproses ulang.');
    } finally {
      setRetrying(false);
    }
  }

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  async function handleApprove() {
    if (!data) return;
    setSaving(true);
    setMsg('');
    try {
      // AI menghasilkan draf → approve draf terstruktur apa adanya, plus
      // ringkasan manual dosen bila diisi; selain itu jalur manual (STT-07).
      const manual = manualNotes.trim();
      const updated = data.status === 'ready_for_review'
        ? await approveLogbook(sessionId, manual
            ? { ...(data.summary_raw ?? {}), manual_notes: manual }
            : (data.summary_raw ?? textToSummary(summaryDraft)))
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

  async function handleReject() {
    setRejecting(true);
    try {
      const updated = await rejectLogbook(sessionId);
      setData(updated);
      setSummaryDraft('');
      setShowRejectModal(false);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Gagal menolak ringkasan.');
    } finally {
      setRejecting(false);
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
                  <>
                    <SummaryContent content={data.summary_edited ?? data.summary_raw} />

                    {/* Phase 7 SC3-4: status sinkron logbook kampus + fallback ekspor manual */}
                    <div className="border-t border-gray-100 pt-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-[11px]">
                          <span className="material-symbols-outlined text-sm text-on-surface-variant" aria-hidden="true">cloud_sync</span>
                          <span className="font-bold text-on-surface-variant">Logbook kampus:</span>
                          {campusStatusChip(data.campus_sync_status)}
                          {data.campus_sync_status === 'synced' && data.campus_entry_id && (
                            <span className="text-[11px] text-on-surface-variant">#{data.campus_entry_id}</span>
                          )}
                        </span>
                        <span className="flex items-center gap-2">
                          <a href={getLogbookExportUrl(sessionId, 'csv')} download
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded">
                            <span className="material-symbols-outlined text-sm" aria-hidden="true">download</span>CSV
                          </a>
                          <a href={getLogbookExportUrl(sessionId, 'pdf')} download
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-primary underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded">
                            <span className="material-symbols-outlined text-sm" aria-hidden="true">download</span>PDF
                          </a>
                        </span>
                      </div>
                      {data.campus_sync_status !== 'synced' && (
                        <p className="text-[11px] text-on-surface-variant mt-1.5">
                          Sinkron otomatis ke logbook kampus belum berhasil — unduh CSV/PDF di atas untuk mengunggah manual.
                        </p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[11px] text-on-surface-variant">
                      {data.status === 'ready_for_review'
                        ? 'Draf ringkasan otomatis siap ditinjau — perbaiki bila perlu, lalu setujui.'
                        : data.status === 'transcribing' || data.status === 'summarizing'
                          ? 'Pipeline AI sedang memproses rekaman — muat ulang halaman beberapa saat lagi untuk melihat draf ringkasan.'
                          : 'Transkripsi & ringkasan otomatis belum tersedia — tuliskan ringkasan hasil bimbingan secara manual di bawah ini.'}
                    </p>
                    {data.status === 'failed' && data.has_recording && (
                      <button type="button" onClick={handleRetry} disabled={retrying}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-primary text-primary text-xs font-bold hover:bg-primary/5 disabled:opacity-60 min-h-[40px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
                        <span className="material-symbols-outlined text-base" aria-hidden="true">refresh</span>
                        {retrying ? 'Memproses…' : 'Coba proses ulang otomatis'}
                      </button>
                    )}
                    {data.status === 'ready_for_review' && (
                      <>
                        {data.transcript && (
                          <details className="border border-gray-100 rounded-xl bg-gray-50/60">
                            <summary className="cursor-pointer select-none p-3 text-xs font-bold text-slate-700 flex items-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded-xl">
                              <span className="material-symbols-outlined text-base text-primary" aria-hidden="true">description</span>
                              Transkrip AI — bahan draf ringkasan
                            </summary>
                            <p className="px-3 pb-3 text-sm text-slate-600 whitespace-pre-wrap max-h-56 overflow-y-auto">
                              {data.transcript}
                            </p>
                          </details>
                        )}
                        <div className="border border-gray-100 rounded-xl p-3 bg-gray-50/60">
                          <SummaryContent content={data.summary_raw} showGroundedness />
                        </div>
                        {/* Ringkasan manual dosen — pelengkap/pengganti bila hasil AI kurang memuaskan */}
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                          <div className="bg-gray-50 px-3 py-2 flex items-center gap-1.5 border-b border-gray-200">
                            <span className="material-symbols-outlined text-base text-on-surface-variant" aria-hidden="true">edit_note</span>
                            <span className="text-xs font-bold text-slate-700">Ringkasan Manual Dosen</span>
                            <span className="text-[11px] text-on-surface-variant">— opsional, isi bila ringkasan AI kurang memuaskan</span>
                          </div>
                          <textarea
                            value={manualNotes}
                            onChange={(e) => setManualNotes(e.target.value)}
                            placeholder="Tuliskan ringkasan hasil bimbingan versi Anda…"
                            rows={3}
                            className="w-full text-sm p-3 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                          />
                        </div>
                      </>
                    )}
                    {data.status !== 'ready_for_review' && (
                      <textarea
                        value={summaryDraft}
                        onChange={(e) => setSummaryDraft(e.target.value)}
                        placeholder="Tuliskan ringkasan hasil bimbingan, saran, dan tindak lanjut untuk mahasiswa…"
                        rows={6}
                        className="w-full text-sm border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      />
                    )}
                    <button type="button"
                      disabled={saving || (data.status !== 'ready_for_review' && !summaryDraft.trim())}
                      onClick={handleApprove}
                      className="w-full py-3 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary-hover disabled:opacity-60 min-h-[44px] flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
                      <span className="material-symbols-outlined text-base" aria-hidden="true">check_circle</span>
                      {saving ? 'Menyetujui…' : 'Setujui & Kirim ke Mahasiswa'}
                    </button>
                    {data.status === 'ready_for_review' && (
                      <button type="button" disabled={saving} onClick={() => setShowRejectModal(true)}
                        className="w-full py-2 text-error text-sm font-bold text-center min-h-[44px] focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none rounded-xl">
                        Tolak Draf AI & Isi Manual
                      </button>
                    )}
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

            {/* Saran & Tindak Lanjut (Phase 7, ADVICE-01) */}
            <section>
              <h2 className="font-headline font-bold text-lg text-slate-900 mb-3">Saran &amp; Tindak Lanjut</h2>
              <div className="bg-surface rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
                {actionItems.length === 0 ? (
                  <p className="text-sm text-on-surface-variant">Belum ada saran untuk sesi ini.</p>
                ) : (
                  <ul className="space-y-2">
                    {actionItems.map((item) => (
                      <li key={item.id} className="flex items-start gap-2 border border-gray-100 rounded-xl p-3">
                        <span
                          className={`material-symbols-outlined text-base flex-shrink-0 mt-0.5 ${item.is_completed ? 'text-success' : 'text-gray-300'}`}
                          aria-hidden="true"
                        >
                          {item.is_completed ? 'check_circle' : 'radio_button_unchecked'}
                        </span>
                        <div className="min-w-0 flex-1">
                          {editingId === item.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                rows={2}
                                className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                              />
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => handleSaveEdit(item.id)} disabled={!editText.trim()}
                                  className="px-2.5 py-1 rounded-lg bg-primary text-on-primary text-xs font-bold disabled:opacity-60">Simpan</button>
                                <button type="button" onClick={() => setEditingId(null)}
                                  className="px-2.5 py-1 rounded-lg text-on-surface-variant text-xs font-bold">Batal</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm text-slate-700">{item.description}</p>
                              <p className="text-[11px] text-on-surface-variant mt-0.5">
                                {item.is_completed
                                  ? `Ditindaklanjuti mahasiswa ${fmtDateTime(item.completed_at)}`
                                  : 'Belum ditindaklanjuti mahasiswa'}
                              </p>
                              {item.completion_note && (
                                <p className="mt-1 text-[13px] text-slate-600 bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                                  <span className="font-bold text-on-surface-variant">Catatan mahasiswa: </span>{item.completion_note}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                        {/* U1: item yang sudah ditindaklanjuti mahasiswa dikunci —
                            edit/hapus disembunyikan agar bukti mahasiswa tak terhapus. */}
                        {editingId !== item.id && !item.is_completed && (
                          deleteConfirmId === item.id ? (
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <span className="text-[11px] font-bold text-error">Hapus?</span>
                              <button type="button" onClick={() => handleDeleteItem(item.id)}
                                className="px-2 py-1 rounded-lg bg-error text-white text-xs font-bold focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none">
                                Ya
                              </button>
                              <button type="button" onClick={() => setDeleteConfirmId(null)}
                                className="px-2 py-1 rounded-lg text-on-surface-variant text-xs font-bold focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button type="button" aria-label="Ubah saran" title="Ubah"
                                onClick={() => { setEditingId(item.id); setEditText(item.description); setItemsMsg(''); }}
                                className="w-8 h-8 rounded-lg text-on-surface-variant hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none">
                                <span className="material-symbols-outlined text-lg" aria-hidden="true">edit</span>
                              </button>
                              <button type="button" aria-label="Hapus saran" title="Hapus"
                                onClick={() => { setDeleteConfirmId(item.id); setItemsMsg(''); }}
                                className="w-8 h-8 rounded-lg text-on-surface-variant hover:bg-error/10 hover:text-error focus-visible:ring-2 focus-visible:ring-error focus-visible:outline-none">
                                <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                              </button>
                            </div>
                          )
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {itemsMsg && <p className="text-sm text-error">{itemsMsg}</p>}

                <div className="flex items-start gap-2 border-t border-gray-100 pt-3">
                  <input
                    type="text"
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddItem(); }}
                    placeholder="Tambahkan saran baru untuk mahasiswa…"
                    className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary min-w-0"
                  />
                  <button
                    type="button"
                    disabled={addingItem || !newItemText.trim()}
                    onClick={handleAddItem}
                    className="px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary-hover disabled:opacity-60 min-h-[40px] flex-shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                  >
                    Tambah
                  </button>
                </div>
              </div>
            </section>

            {/* Progres Skripsi — dosen menandai bab yang sudah diselesaikan mahasiswa.
                Mahasiswa hanya melihat (read-only) di dashboard mereka. */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-headline font-bold text-lg text-slate-900">Progres Skripsi</h2>
                {thesis && <span className="text-sm font-bold text-primary">{thesis.percent}%</span>}
              </div>
              <div className="bg-surface rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
                {thesisErr && <p className="text-sm text-error">{thesisErr}</p>}
                {!thesis && !thesisErr && (
                  <p className="text-sm text-on-surface-variant">Memuat progres skripsi…</p>
                )}
                {thesis && (
                  <>
                    <p className="text-[11px] text-on-surface-variant">
                      Tandai setiap bab yang sudah diselesaikan mahasiswa. Mahasiswa melihat progres ini di dashboard mereka.
                    </p>
                    <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${thesis.percent}%` }} />
                    </div>
                    <ul className="space-y-1">
                      {thesis.chapters.map((c) => {
                        const isActive = !c.is_completed && c.id === thesis.chapters.find((x) => !x.is_completed)?.id;
                        return (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => handleToggleChapter(c.id, !c.is_completed)}
                              aria-pressed={c.is_completed}
                              className="w-full flex items-center gap-3 py-2 text-left rounded-lg hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                            >
                              <span
                                className={`material-symbols-outlined text-xl flex-shrink-0 ${c.is_completed ? 'text-success' : isActive ? 'text-primary' : 'text-gray-300'}`}
                                style={c.is_completed ? { fontVariationSettings: "'FILL' 1" } : undefined}
                                aria-hidden="true"
                              >
                                {c.is_completed ? 'check_circle' : isActive ? 'radio_button_checked' : 'radio_button_unchecked'}
                              </span>
                              <span
                                className={[
                                  'text-sm',
                                  c.is_completed ? 'line-through text-on-surface-variant' : isActive ? 'text-slate-900 font-bold' : 'text-on-surface-variant',
                                ].join(' ')}
                              >
                                {c.title}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      <AppBottomNav items={NAV_ITEMS.dosen} active="riwayat" />

      {showRejectModal && (
        <RejectLogbookModal
          onConfirm={handleReject}
          onClose={() => setShowRejectModal(false)}
          loading={rejecting}
        />
      )}
    </div>
  );
}
