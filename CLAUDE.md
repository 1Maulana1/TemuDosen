# Claude Workspace Instructions

This workspace contains multiple areas. Prefer working in the folder that matches the user's request:

- `library-management` for the application code
- `gsd-new-project` for GSD workflow artifacts and planning files

When acting on this repository:

- Make the smallest change that solves the request.
- Keep edits focused on the relevant folder and avoid touching unrelated files.
- Use the existing VS Code task `Jalankan Claude CLI` to launch Claude from the editor.
- If you need to verify behavior, run the narrowest relevant check first.

If a task or workflow file already points to a different instruction file, treat this file as the workspace root default.

---

## Status proyek & dokumentasi tim

Status FR/requirement per-2026-07-01 yang dulu ada di sini sudah usang dan
dihapus dari file ini (isinya sudah salah dibanding kondisi kode saat ini).
Sumber status yang akurat:

- **`docs/`** — folder terpusat untuk tim: `DEPLOYMENT.md` (cara deploy),
  `BACKLOG.md` (isu/gap tercatat, termasuk yang masih terbuka), `AUDIT.md`
  (hasil audit penuh), `UI-REVIEW.md` (temuan review UI).
- **`.planning/STATE.md`** — status live per-fase (Code-Ahead-of-Process Audit).
- **`.planning/REQUIREMENTS.md`** — traceability requirement → implementasi.
