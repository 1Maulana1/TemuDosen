/**
 * SymptomConfig (S-10) — Admin symptom weight configuration page.
 *
 * Route: /admin/katalog-gejala
 * Layout: Desktop — sidebar nav + main content area (same pattern as UserApproval S-11).
 *
 * Features (D-06, D-07, D-08):
 * - Inline-editable table: No. | Nama Gejala | Durasi (menit) | Aksi
 * - View mode: plain text cells; pencil icon (aria-label="Edit gejala") switches row to edit mode
 * - Edit mode: name text input + duration number input; changes tracked in local state
 * - "Tambah Gejala" (top-right) adds a new editable row
 * - "Simpan Semua Perubahan" (bottom CTA) calls bulkUpdateSymptoms for all in-progress edits (D-07)
 * - Trash icon (aria-label="Hapus gejala", text-error) triggers delete confirm modal
 * - Modal copy: "Hapus gejala ini?" / "Tindakan ini tidak dapat dibatalkan." / "Batal" + "Hapus"
 * - Pre-populated with 6 seeded entries from fetchSymptoms (D-02)
 *
 * Accessibility Contract (UI-SPEC):
 * - 44×44px min touch targets on icon buttons
 * - focus-visible rings on all interactive elements
 * - aria-labels on icon-only buttons
 * - 14px+ font throughout
 */
import { useState, useEffect } from 'react';
import {
  fetchSymptoms,
  createSymptom,
  deleteSymptom,
  bulkUpdateSymptoms,
} from '../../api/symptoms';
import type { SymptomCategory } from '../../api/symptoms';

// ── Types ──────────────────────────────────────────────────────────────────────

interface RowState {
  /** null id = unsaved new row */
  id: number | null;
  name: string;
  duration_minutes: number;
  is_active: boolean;
  /** Whether this row is currently in edit mode */
  editing: boolean;
  /** Whether this is a brand-new row not yet saved to the server */
  isNew: boolean;
}

// ── Sidebar constants ──────────────────────────────────────────────────────────

const SIDEBAR_LINKS = [
  { label: 'Dashboard', icon: 'dashboard', href: '/admin' },
  { label: 'Katalog Gejala', icon: 'clinical_notes', href: '/admin/katalog-gejala', active: true },
  { label: 'Pengguna', icon: 'group', href: '/admin/pengguna' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function toRowState(category: SymptomCategory): RowState {
  return {
    id: category.id,
    name: category.name,
    duration_minutes: category.duration_minutes,
    is_active: category.is_active,
    editing: false,
    isNew: false,
  };
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SymptomConfig() {
  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Delete confirmation modal state
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [deleteTargetName, setDeleteTargetName] = useState<string>('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Load data ────────────────────────────────────────────────────────────────

  async function loadSymptoms() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSymptoms();
      setRows(data.map(toRowState));
    } catch {
      setError('Gagal memuat katalog gejala. Coba muat ulang halaman.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSymptoms();
  }, []);

  // ── Row editing ──────────────────────────────────────────────────────────────

  function handleEdit(index: number) {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, editing: true } : row))
    );
  }

  function handleRowChange(
    index: number,
    field: 'name' | 'duration_minutes',
    value: string
  ) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (field === 'duration_minutes') {
          const parsed = parseInt(value, 10);
          return { ...row, duration_minutes: isNaN(parsed) ? 0 : parsed };
        }
        return { ...row, [field]: value };
      })
    );
  }

  // ── Add new row ──────────────────────────────────────────────────────────────

  function handleAddRow() {
    const newRow: RowState = {
      id: null,
      name: '',
      duration_minutes: 30,
      is_active: true,
      editing: true,
      isNew: true,
    };
    setRows((prev) => [...prev, newRow]);
  }

  // ── Delete flow ──────────────────────────────────────────────────────────────

  function openDeleteModal(id: number, name: string) {
    setDeleteTargetId(id);
    setDeleteTargetName(name);
  }

  function closeDeleteModal() {
    setDeleteTargetId(null);
    setDeleteTargetName('');
  }

  async function confirmDelete() {
    if (deleteTargetId === null) return;
    setDeleteLoading(true);
    try {
      await deleteSymptom(deleteTargetId);
      setRows((prev) => prev.filter((r) => r.id !== deleteTargetId));
      setSuccessMessage('Gejala berhasil dihapus.');
      closeDeleteModal();
    } catch {
      setError('Gagal menghapus gejala. Silakan coba lagi.');
      closeDeleteModal();
    } finally {
      setDeleteLoading(false);
    }
  }

  /** Remove an unsaved new row (no API call needed). */
  function handleRemoveNewRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Save all ─────────────────────────────────────────────────────────────────

  async function handleSaveAll() {
    setError(null);
    setSuccessMessage(null);
    setSaving(true);

    try {
      // Split rows into: new rows (need createSymptom) and existing edits (need bulk-update)
      const newRows = rows.filter((r) => r.isNew);
      const editedRows = rows.filter((r) => !r.isNew && r.editing && r.id !== null);

      // Create new rows one by one (no bulk-create endpoint)
      const createdCategories: SymptomCategory[] = [];
      for (const row of newRows) {
        if (!row.name.trim()) {
          setError('Nama gejala tidak boleh kosong.');
          setSaving(false);
          return;
        }
        if (row.duration_minutes <= 0) {
          setError('Durasi harus berupa angka positif.');
          setSaving(false);
          return;
        }
        const created = await createSymptom({
          name: row.name.trim(),
          duration_minutes: row.duration_minutes,
          is_active: row.is_active,
        });
        createdCategories.push(created);
      }

      // Bulk-update edited existing rows
      if (editedRows.length > 0) {
        const bulkPayload = editedRows.map((r) => ({
          id: r.id as number,
          name: r.name.trim(),
          duration_minutes: r.duration_minutes,
          is_active: r.is_active,
        }));
        await bulkUpdateSymptoms(bulkPayload);
      }

      // Reload from server to reflect final state
      await loadSymptoms();
      setSuccessMessage('Semua perubahan berhasil disimpan.');
    } catch {
      setError('Gagal menyimpan perubahan. Pastikan data valid dan coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const hasUnsavedChanges = rows.some((r) => r.editing || r.isNew);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-40">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-100">
          <h1 className="font-headline font-bold text-xl text-primary">TemuDosen</h1>
          <p className="text-[11px] text-slate-400 font-label mt-0.5">Panel Admin</p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4" aria-label="Admin navigation">
          {SIDEBAR_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm font-body transition-colors min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${
                link.active
                  ? 'bg-blue-50 text-primary font-bold'
                  : 'text-slate-600 hover:bg-gray-50 hover:text-slate-800'
              }`}
              aria-current={link.active ? 'page' : undefined}
            >
              <span className="material-symbols-outlined text-xl" aria-hidden="true">
                {link.icon}
              </span>
              {link.label}
            </a>
          ))}
        </nav>
      </aside>

      {/* ── Main content ── */}
      <main className="ml-64 flex-1 overflow-y-auto px-8 py-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-headline font-bold text-xl text-slate-900">
              Katalog Gejala Akademik
            </h2>
            <p className="text-sm text-neutral-gray font-body mt-1">
              Atur kategori gejala dan bobot durasi bimbingan
            </p>
          </div>

          {/* Tambah Gejala button */}
          <button
            type="button"
            onClick={handleAddRow}
            className="flex items-center gap-2 border border-primary text-primary text-sm font-bold font-body px-4 py-2.5 rounded-lg min-h-[44px] hover:bg-blue-50 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <span className="material-symbols-outlined text-xl" aria-hidden="true">add</span>
            Tambah Gejala
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div
            className="mb-4 p-3 bg-error/5 border border-error/20 rounded-xl text-sm text-error font-body"
            role="alert"
            aria-live="polite"
          >
            {error}
          </div>
        )}

        {/* Success banner */}
        {successMessage && (
          <div
            className="mb-4 p-3 bg-success/5 border border-success/20 rounded-xl text-sm text-success font-body"
            role="status"
            aria-live="polite"
          >
            {successMessage}
          </div>
        )}

        {/* Table card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400 font-body text-sm gap-2">
              <span className="material-symbols-outlined animate-spin" aria-hidden="true">autorenew</span>
              Memuat data...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full" aria-label="Tabel katalog gejala akademik">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-label w-12">
                      No.
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-label">
                      Nama Gejala
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-label w-36">
                      Durasi (menit)
                    </th>
                    <th className="text-left px-4 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider font-label w-28">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.map((row, index) => (
                    <tr key={row.id ?? `new-${index}`} className="hover:bg-gray-50 transition-colors">
                      {/* No. */}
                      <td className="px-4 py-3 text-sm text-slate-500 font-label">
                        {index + 1}
                      </td>

                      {/* Nama Gejala */}
                      <td className="px-4 py-3">
                        {row.editing ? (
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => handleRowChange(index, 'name', e.target.value)}
                            placeholder="Nama gejala"
                            aria-label={`Nama gejala baris ${index + 1}`}
                            className="w-full text-sm font-body text-slate-800 border border-gray-200 rounded-lg px-3 py-2 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none focus:border-primary"
                          />
                        ) : (
                          <span className="text-sm text-slate-700 font-body">{row.name}</span>
                        )}
                      </td>

                      {/* Durasi (menit) */}
                      <td className="px-4 py-3">
                        {row.editing ? (
                          <input
                            type="number"
                            min="1"
                            value={row.duration_minutes}
                            onChange={(e) => handleRowChange(index, 'duration_minutes', e.target.value)}
                            aria-label={`Durasi menit baris ${index + 1}`}
                            className="w-24 text-sm font-body text-slate-800 border border-gray-200 rounded-lg px-3 py-2 min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none focus:border-primary"
                          />
                        ) : (
                          <span className="text-sm text-slate-700 font-body">{row.duration_minutes}</span>
                        )}
                      </td>

                      {/* Aksi */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {row.isNew ? (
                            /* New unsaved row — show remove (×) instead of edit/delete */
                            <button
                              type="button"
                              onClick={() => handleRemoveNewRow(index)}
                              aria-label="Hapus baris baru"
                              className="flex items-center justify-center w-[44px] h-[44px] rounded-lg text-slate-400 hover:bg-error/5 hover:text-error transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                            >
                              <span className="material-symbols-outlined text-xl" aria-hidden="true">close</span>
                            </button>
                          ) : (
                            <>
                              {/* Edit button */}
                              <button
                                type="button"
                                onClick={() => handleEdit(index)}
                                aria-label="Edit gejala"
                                disabled={row.editing}
                                className="flex items-center justify-center w-[44px] h-[44px] rounded-lg text-slate-400 hover:bg-blue-50 hover:text-primary transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:opacity-30 disabled:cursor-default"
                              >
                                <span className="material-symbols-outlined text-xl" aria-hidden="true">edit</span>
                              </button>

                              {/* Delete button */}
                              <button
                                type="button"
                                onClick={() => openDeleteModal(row.id as number, row.name)}
                                aria-label="Hapus gejala"
                                className="flex items-center justify-center w-[44px] h-[44px] rounded-lg text-error hover:bg-error/5 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                              >
                                <span className="material-symbols-outlined text-xl" aria-hidden="true">delete</span>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-400 font-body">
                        Belum ada gejala. Klik "Tambah Gejala" untuk menambahkan kategori pertama.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Save All CTA */}
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || !hasUnsavedChanges}
            aria-busy={saving}
            className="flex items-center gap-2 bg-primary text-white text-sm font-bold font-body px-6 py-3 rounded-lg min-h-[44px] shadow-lg shadow-primary/25 hover:bg-blue-700 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <span className="material-symbols-outlined animate-spin text-xl" aria-hidden="true">autorenew</span>
                Menyimpan...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-xl" aria-hidden="true">save</span>
                Simpan Semua Perubahan
              </>
            )}
          </button>
        </div>
      </main>

      {/* ── Delete Confirmation Modal ── */}
      {deleteTargetId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-error" aria-hidden="true">delete</span>
              </div>
              <h3 id="delete-modal-title" className="font-headline font-bold text-slate-900 text-base">
                Hapus gejala ini?
              </h3>
            </div>

            <p className="text-sm text-slate-600 font-body mb-1">
              Anda akan menghapus gejala:{' '}
              <strong className="text-slate-800">{deleteTargetName}</strong>
            </p>
            <p className="text-sm text-slate-500 font-body mb-6">
              Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="flex items-center gap-3 justify-end">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteLoading}
                className="px-4 py-2.5 text-sm font-bold font-body text-slate-600 border border-gray-200 rounded-lg min-h-[44px] hover:bg-gray-50 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleteLoading}
                aria-busy={deleteLoading}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold font-body bg-error text-white rounded-lg min-h-[44px] hover:bg-red-700 active:scale-[0.98] transition-all focus-visible:ring-2 focus-visible:ring-error focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteLoading ? (
                  <span className="material-symbols-outlined animate-spin text-sm" aria-hidden="true">autorenew</span>
                ) : null}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
