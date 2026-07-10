# Audit Menyeluruh — 2026-07-07

Pemeriksaan seluruh phase & fitur atas permintaan user. Semua test dijalankan
nyata (bukan hitung statis) di `backend/.venv` (Python 3.11) + `frontend/node_modules`.

## Ringkasan hasil test & health-check

| Cek | Hasil |
|-----|-------|
| Backend `pytest` | ✅ **300 passed** (0 failed) |
| Frontend `vitest` | ✅ **56 passed** (11 file) |
| `tsc -b` | ✅ bersih (exit 0) |
| `npm run build` | ✅ bersih (92 modul, exit 0) |
| `manage.py check` | ✅ 0 issues |
| `makemigrations --check` | ✅ tidak ada migrasi hilang |

## Status per phase (vs success criteria)

| Phase | Status | Catatan |
|-------|--------|---------|
| 1. Submission & Triage | ✅ | verified |
| 2. Approval & Queue | ✅ | verified |
| 3. Live Queue & Quota | ✅ | verified |
| 4. Google Calendar Sync | ✅ | verified |
| 5. Session + Recording + Consent | ✅ | verified (cek mic real-browser masih manual) |
| 6. STT/AI/Logbook | ✅ | pipeline + graceful degradation, tested |
| 7. Advisory + Campus Logbook | ✅ | SC1–SC6 semua; nits di `07-DEFERRED.md` |
| 8. Admin + Ketua Jurusan | ✅ | SC1–SC4 semua (SC2 ditutup 2026-07-07) |

---

## TEMUAN

### 🟠 T1 — Kartu "Logbook Kampus" di Admin Dashboard salah label (kode)
`frontend/src/pages/admin/AdminDashboard.tsx:263-266` menampilkan kartu status
**"Logbook Kampus"** tapi membaca `data.integrations.logbook.enabled`, yang di
backend (`apps/bimbingan/views.py`, `AdminStatsView`) adalah
`{'enabled': STT_LLM_ENABLED}` — flag **pipeline STT/AI**, bukan integrasi logbook
kampus. Sejak Phase 7 SC6 ada kartu **"Integrasi Logbook Kampus"** yang benar
(pakai `integrations.campus_logbook`), jadi kartu lama kini menyesatkan/duplikat.
**Dampak:** admin bisa salah baca status. **Perbaikan:** relabel kartu lama jadi
"Pemrosesan STT/AI" atau hapus (status STT/AI sudah ada di section "Pemrosesan STT/AI").

### 🟡 T2 — "Progres Skripsi" mahasiswa statis/mock (fitur tak lengkap)
`frontend/src/pages/student/StudentDashboard.tsx:61,356,383` — checklist bab
"Progres Skripsi" adalah data statis/mock; tidak ada model/endpoint backend
(ditandai `TODO(backend)` di kode). **Dampak:** mahasiswa melihat progres yang
tidak nyata. Bukan bagian dari success criteria phase mana pun — fitur UI tambahan
yang belum di-backing. **Perbaikan:** buat model/endpoint progres, atau tandai
jelas sebagai placeholder di UI.

### 🟡 T3 — Flake test: thread calendar vs teardown pytest (test-infra)
Pada run suite penuh muncul `PytestUnhandledThreadExceptionWarning:
"database table is locked: accounts_user"` dari daemon thread
`_create_calendar_event_async` (dipicu saat approve) yang balapan dengan teardown
DB SQLite pytest. **Non-failing** (300 tetap passed), tapi berisik dan sesekali bisa
memunculkan ERROR satu kali di CI. Pra-ada (tercatat sejak 2026-07-04); chip
background pernah difile tapi belum ditindaklanjuti. **Perbaikan:** join/await thread
di test, atau `transaction`-safe teardown, atau jalankan calendar async hanya bila
tidak di test settings.

### 🟡 T4 — REQUIREMENTS.md basi (dokumen)
`.planning/REQUIREMENTS.md` masih menandai `[ ]` "not started" untuk **ADVICE-02,
LOGBOOK-01, LOGBOOK-02, LOGBOOK-03, ADMIN-04** — padahal kelimanya sudah
diimplementasikan + diuji di Phase 7 sesi ini. **Perbaikan:** centang & isi bukti
(view/test) untuk kelima requirement itu.

### 🟡 T5 — STATE.md basi (dokumen)
`.planning/STATE.md` masih mencerminkan kondisi 2026-07-06 (269 backend / 51
frontend; Phase 7 "hanya SC1 selesai, ADVICE-02 belum dibangun"). Belum mencakup
kerja sesi ini (Phase 7 SC2–SC6 + Phase 8 SC2). Kondisi sebenarnya: **300/56, Phase 7 & 8
COMPLETE**. **Perbaikan:** resync STATE.md (Code-Ahead-of-Process table + test evidence
+ current position).

---

## Sudah tercatat sebelumnya (bukan temuan baru)
- **Phase 7 nits** — `07-DEFERRED.md`: (a) field catatan/bukti opsional saat mahasiswa
  tandai advice selesai (SC1); (b) API Sekawan/KPTI asli belum pernah diuji langsung
  (by design — verifikasi via mock); (c) belum ada verifikasi live browser campus-sync.
- **Phase 5** — cek mic di Chrome/Firefox/Safari + "Merekam…" 360px masih human-verify
  (per `05-VERIFICATION.md`).

## Bukan masalah (dikonfirmasi sehat)
- `SummaryContent.tsx` menangani bentuk `{manual_notes}` + default `?? []` → tidak ada
  bug crash render (bug yang pernah ada di jalur lokal tidak ada di base remote ini).
- `celery==5.6.3` + `redis==8.0.1` pin — regresi celery#10294 tidak terpicu
  (`CELERY_RESULT_BACKEND` tak diset, `ignore_result=True`); rasional terdokumentasi di
  `requirements.txt`.
- Migrasi konsisten, tidak ada yang hilang; Django system check bersih.

## Status resolusi (2026-07-07)

- **T1 — ✅ DIPERBAIKI**: kartu "Logbook Kampus" di `AdminDashboard.tsx` kini membaca
  `integrations.campus_logbook` (enabled/configured), bukan flag STT lagi.
- **T2 — ✅ DIPERBAIKI (2026-07-07)**: `ThesisChapter` model (submissions app, migration
  0004, seed Bab I–V) + `GET/PATCH /api/thesis-progress/`; StudentDashboard "Progres
  Skripsi" kini data nyata yang bisa ditandai sendiri (optimistic update). 9 backend + 2
  frontend test.
  > **Update 2026-07-08 (`fddb673`) + 2026-07-10 (dibersihkan):** desain berubah —
  > penandaan bab kini otoritatif di sisi **dosen** (scoped ke advisee-nya), mahasiswa
  > read-only. Endpoint `PATCH /api/thesis-progress/<id>/` (student-write) yang jadi
  > yatim sejak perubahan itu sudah dihapus 2026-07-10, bersama test & wrapper API
  > frontend-nya yang tidak lagi terpakai.
- **T3 — ✅ DIPERBAIKI**: thread calendar hanya spawn saat `GOOGLE_CALENDAR_ENABLED`;
  suite penuh kini **300 passed, 0 warning "database table is locked"**. `test_calendar.py`
  kelas sync opt-in via fixture `_calendar_enabled`.
- **T4 — ✅ DIPERBAIKI**: REQUIREMENTS.md di-resync (ADVICE-02, LOGBOOK-01/02/03,
  ADMIN-04, REPORT-01 dicentang dengan bukti).
- **T5 — ✅ DIPERBAIKI**: STATE.md frontmatter + Current Position di-resync (8/8 phase,
  100%, 300/56).

## Catatan lingkungan (untuk tim)
- `backend/.venv` yang ada di-copy dari mesin lain (interpreter rusak, menunjuk path
  `C:\Users\A s u s\...`). Diperbaiki di sesi ini dengan mengarahkan ulang ke Python 3.11
  uv. Anggota tim yang clone baru perlu **recreate venv** sendiri (`uv venv` + install
  `requirements.txt`) — jangan andalkan `.venv` yang ter-copy.
