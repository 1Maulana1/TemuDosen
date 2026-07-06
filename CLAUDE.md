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

## STATUS AUDIT PHASE 2 (per 2026-07-01) — SUPERSEDED, kept for history only

> **2026-07-06: this entire FR-status audit is stale and no longer maintained.** It was a Phase-2-era snapshot (before Phase 2 itself was even formally verified) using an `FR-M*/FR-D*/FR-S*/FR-AD*/FR-KP*/NFR-*` ID scheme that was later replaced by `.planning/REQUIREMENTS.md`'s `TRIAGE-*/REVIEW-*/QUEUE-*/SESSION-*/STT-*/ADVICE-*/LOGBOOK-*/ADMIN-*/REPORT-*` scheme. Several rows below are now flatly wrong — e.g. FR-M04 (recording consent) and FR-KP04 (advice-compliance report) are both listed "❌ MISSING" here but have been implemented and verified since (see SESSION-02 and REPORT-03 in `.planning/REQUIREMENTS.md`). **For current status, always check `.planning/STATE.md` (Code-Ahead-of-Process Audit table) and `.planning/REQUIREMENTS.md` (Traceability table) instead of this section.** Left in place below as a historical snapshot of Phase 2's file/schema footprint, not as a live status source.

### ✅ FR SELESAI (IMPLEMENTED) — as of 2026-07-01, do not trust for current status

| FR | Deskripsi | Backend File | Frontend File |
|----|-----------|-------------|---------------|
| FR-M01 | Validasi form gejala + upload PDF max 5MB (AND gateway) | `apps/submissions/serializers.py:41-116` | `pages/student/SubmissionForm.tsx:67-123` |
| FR-M02 | Nomor antrian + estimasi waktu real-time (30s refresh) | `apps/bimbingan/views.py:313-333` | `pages/student/StudentQueue.tsx:171-284` |
| FR-M03 | Pembatalan antrian dengan konfirmasi modal | `apps/bimbingan/views.py:336-393` | `pages/student/StudentQueue.tsx:41-67` |
| FR-D04 | Pilih metode OFFLINE/ONLINE + validasi meetingLink wajib | `apps/bimbingan/serializers.py:13-21` | `pages/lecturer/LecturerRequests.tsx:48-131` |
| FR-S01 | Validasi paralel AND gateway (semua error sekaligus) | DRF field-level validators | `pages/student/SubmissionForm.tsx:96-122` |
| FR-S02 | Kalkulasi estimasi dari symptom.duration_minutes + kuota | `apps/bimbingan/views.py:83-158` | — |
| FR-S03 | Scheduler notifikasi H-15 menit (1 menit interval) | `apps/bimbingan/scheduler.py:20-58` | — |
| FR-S05 | Auto-cancel tidak hadir >30 menit (5 menit interval) | `apps/bimbingan/scheduler.py:61-127` | — |
| FR-S06 | Cek free/busy Google Calendar sebelum approve | `apps/bimbingan/services/calendar.py:124-154` | — |
| FR-S07 | Buat Google Calendar event saat approve (+ attendee) | `apps/bimbingan/services/calendar.py:157-199` | — |
| FR-S08 | Hapus/update Calendar event saat cancel/recalculate | `apps/bimbingan/services/calendar.py:202-263` | — |
| FR-AD01 | CRUD katalog gejala + dataset estimasi | `apps/symptoms/views.py` | `pages/admin/SymptomConfig.tsx` |
| FR-KP01 | Rekap beban kerja per dosen | `apps/bimbingan/views.py:711-760` | `pages/kaprodi/KaprodiDashboard.tsx:71-90` |
| NFR-02 | Graceful degradation semua external API | `apps/bimbingan/services/calendar.py` (try/except semua) | — |
| NFR-05 | Error external API dicatat ke SystemLog | Semua error paths | — |

---

### ⚠️ FR PARTIAL (PERLU DILENGKAPI)

| FR | Yang Sudah Ada | Yang Masih Kurang |
|----|---------------|-------------------|
| FR-D01 | Approve/reject/revisi backend + frontend modal | Blokir REJECTED resubmit; tampilkan catatan revisi ke mahasiswa; tombol "Ajukan Ulang" |
| FR-AD02 | `AdminEmergencyCancelView` di `apps/bimbingan/views.py:663-708` | Field `alasan` di backend; frontend masih pakai `prompt()` bukan modal proper |
| FR-AD03 | 8 recent errors tampil di AdminDashboard | Endpoint `/api/admin/logs/` dengan filter type/pagination; badge warna per tipe; auto-refresh; hapus log >30 hari |
| FR-KP02 | `avg_wait_minutes` + `total_sessions_month` | Field `sesi_selesai`, `sesi_dibatalkan`; filter periode (weekly/monthly/semester) |
| FR-KP03 | CSV export `GET /api/stats/kaprodi/export/` | PDF export belum ada |
| NFR-01 | Calendar check_free_busy + create_event dipanggil di approve | Calls masih synchronous/blocking (bukan threading.Thread) |
| NFR-03 | Fernet encryption untuk token OAuth | Fernet = AES-128-CBC, spec minta AES-256 |
| NFR-04 | Fallback `or 30` min jika symptom kosong | Tidak ada timeout 5 detik; tidak ada DEFAULT_ESTIMATES per kategori |

---

### ❌ FR MISSING (BELUM ADA)

| FR | Deskripsi | Backend | Frontend |
|----|-----------|---------|----------|
| FR-M04 | Consent rekaman sebelum sesi dimulai | Tidak ada field `consent_given_at`, `consent_by_dosen`, `consent_by_mhs` di Session model | Tidak ada consent modal di LecturerQueue |
| FR-KP04 | Rekap kepatuhan tindak lanjut saran | Tidak ada endpoint `/api/kaprodi/compliance/` | Tidak ada di KaprodiDashboard |

---

### 📂 FILE YANG SUDAH DIUBAH/DITAMBAH (Phase 2)

**Backend — baru ditambahkan (untracked):**
- `backend/apps/bimbingan/` — app baru seluruhnya:
  - `models.py` — Session, DosenCalendarToken, SystemLog
  - `serializers.py` — Approve, Reject, Queue serializers
  - `views.py` — ApproveView, RejectView, QueueViews, StatsViews, CalendarViews
  - `urls.py` — queue_urlpatterns, calendar_urlpatterns, stats_urlpatterns
  - `scheduler.py` — check_h15_notifications, check_auto_cancel
  - `apps.py` — BimbinganConfig.ready() starts scheduler
  - `services/calendar.py` — Google Calendar service (FR-S06/S07/S08)
  - `services/notification.py` — notify_student, notify_lecturer
  - `migrations/0001_initial.py`
- `backend/apps/submissions/migrations/0002_submission_phase2.py` — tambah CANCELLED status + rejection_reason

**Backend — dimodifikasi:**
- `backend/apps/submissions/models.py` — status CANCELLED + rejection_reason
- `backend/apps/submissions/urls.py` — tambah approve/reject routes
- `backend/config/settings/base.py` — GOOGLE_CALENDAR_ENABLED, DOSEN_DAILY_QUOTA_MINUTES
- `backend/config/urls.py` — tambah /api/queue/, /api/calendar/, /api/stats/
- `backend/requirements.txt` — APScheduler, cryptography, google-api-python-client

**Frontend — baru ditambahkan (untracked):**
- `frontend/src/api/sessions.ts` — queue + approve/reject API calls
- `frontend/src/api/stats.ts` — stats + export API calls
- `frontend/src/pages/admin/AdminDashboard.tsx`
- `frontend/src/pages/kaprodi/KaprodiDashboard.tsx`
- `frontend/src/pages/lecturer/LecturerQueue.tsx`
- `frontend/src/pages/lecturer/LecturerRequests.tsx`
- `frontend/src/pages/student/StudentQueue.tsx`

**Frontend — dimodifikasi:**
- `frontend/src/pages/lecturer/LecturerDashboard.tsx`
- `frontend/src/pages/student/StudentDashboard.tsx`
- `frontend/src/router.tsx` — tambah semua route Phase 2

---

### 🔄 DATABASE SCHEMA (Phase 2)

**Tabel baru:**
- `bimbingan_session` — status, method, meeting_link, estimated_minutes, scheduled_at, notification_sent, google_event_id, ts1
- `bimbingan_dosencalendartoken` — encrypted OAuth tokens
- `bimbingan_systemlog` — audit log semua event sistem

**Kolom baru di tabel existing:**
- `submissions_submission.rejection_reason` — TextField
- `submissions_submission.status` — tambah choice CANCELLED

**Kolom yang BELUM ada (perlu FR-M04):**
- `bimbingan_session.consent_given_at` — DateTimeField nullable
- `bimbingan_session.consent_by_dosen` — BooleanField
- `bimbingan_session.consent_by_mhs` — BooleanField
