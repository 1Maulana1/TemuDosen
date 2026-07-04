# Interface Contracts

Shared contracts between team members. Update this file when you finalize a model field or function signature. Others read this before calling your code.

> **Cara pakai (lihat `KERJA_PARALEL.md`):** kerjakan **melawan kontrak di sini**, bukan melawan implementasi orang lain. Yang belum jadi → pakai **stub/mock**, jangan menunggu. Kalau kontrak perlu berubah → diskusikan & update file ini DULU, jangan ubah diam-diam.

> **⚠️ Catatan penting (2026-06-30):** implementasi nyata Phase 2–3 **menyimpang** dari rencana lama. Queue TIDAK pakai `apps/queue/QueueSlot` — yang dipakai adalah **`Session` di `apps/bimbingan/`**. Dokumen ini sudah disinkronkan dengan kode asli. Jangan pakai nama lama (`QueueSlot`, `rejection_notes`, `apps/queue/quota.py`).

---

# BAGIAN 1 — Kontrak Phase 1–4 (sudah ter-implementasi)

## Models

### `CustomUser` (apps/accounts/models.py) — Owner: Person A
```python
email           # login identifier (USERNAME_FIELD)
full_name
role            # 'student' | 'lecturer' | 'admin' | 'kaprodi'
nim             # students only (unique, null untuk non-student)
nidn            # lecturers only (unique, null untuk non-lecturer)
is_approved     # False sampai admin approve
adviser         # self-FK ke lecturer, diisi mahasiswa saat registrasi
google_oauth_token  # JSONField, forward-compat (token nyata di DosenCalendarToken)
```
**Status:** ✅ Done

---

### `SymptomCategory` (apps/symptoms/models.py) — Owner: Person B
```python
name
duration_minutes    # bobot untuk hitung durasi triage
is_active
```
**Status:** ✅ Done

---

### `Submission` (apps/submissions/models.py) — Owner: Person B
```python
student            # FK ke CustomUser (role=student)
symptoms           # M2M ke SymptomCategory
description
status             # 'pending' | 'approved' | 'rejected' | 'revision' | 'cancelled'
rejection_reason   # TextField — diisi dosen saat reject/revisi (BUKAN 'rejection_notes')
created_at
updated_at
```
**Status:** ✅ Done. `SubmissionFile` (OneToOne) menyimpan PDF: `uuid`, `original_filename`, `file_path`, `file_size`.

---

### `Session` (apps/bimbingan/models.py) — Owner: Person C/D  ← INI pengganti `QueueSlot`
Dibuat saat dosen meng-approve sebuah `Submission`. Inilah "slot antrian".
```python
submission          # OneToOne FK ke Submission
status              # 'waiting' | 'in_progress' | 'done' | 'cancelled'
method              # 'offline' | 'online' (null sampai di-approve)
meeting_link        # URL, wajib jika method='online'
estimated_minutes   # durasi estimasi = sum(symptom.duration_minutes)
scheduled_at        # DateTimeField — slot jadwal estimasi
notification_sent   # BooleanField — sudah dikirim notif H-15?
google_event_id     # id event Google Calendar (null jika tidak sync)
ts1                 # DateTimeField — timestamp "Mulai & Rekam" (Phase 5)
ts2                 # DateTimeField — timestamp "Selesai" (Phase 5, SESSION-04)
result_notes        # TextField — catatan hasil manual opsional saat Selesai
consent_by_dosen     # BooleanField — FR-M04
consent_by_mahasiswa # BooleanField — FR-M04
consent_given_at     # DateTimeField null — terisi hanya jika KEDUA pihak setuju
created_at
updated_at
```
> Nomor antrian TIDAK disimpan sebagai field — dihitung on-the-fly dari urutan `scheduled_at` sesama Session WAITING milik dosen yang sama (lihat `LecturerQueueItemSerializer.get_position`).

**Status:** ✅ Done (Phase 2–3; ts2/result_notes/consent ditambah Phase 5)

---

### `SessionRecording` (apps/bimbingan/models.py) — Owner: Person 1 (Phase 5)
File audio rekaman sesi, dibuat saat dosen menekan "Selesai" dengan consent tercatat.
```python
session            # OneToOne FK ke Session, related_name='recording'
uuid               # UUIDField unique — nama file di disk (pola SubmissionFile)
original_filename  # CharField
file_path          # CharField — MEDIA_ROOT/recordings/<uuid>.<ext>, TIDAK via MEDIA_URL
file_size          # PositiveIntegerField (bytes)
mime_type          # CharField, mis. 'audio/webm' | 'audio/ogg' | 'audio/mp4'
uploaded_at        # DateTimeField auto_now_add
```
> Server MENOLAK upload audio jika `consent_given_at` null (gerbang FR-M04 ditegakkan di backend, bukan cuma UI). Validasi: magic bytes WebM/Ogg/MP4 + batas `settings.RECORDING_MAX_UPLOAD_SIZE` (default 100MB).

**Status:** ✅ Done (Phase 5 — SESSION-03/04)

---

### `DosenCalendarToken` (apps/bimbingan/models.py) — Owner: Person C/D
Token Google OAuth2 per dosen, terenkripsi Fernet. Field: `dosen` (OneToOne lecturer), `access_token_enc`, `refresh_token_enc`, `expires_at`.
**Status:** ✅ Done (Phase 4)

### `SystemLog` (apps/bimbingan/models.py) — Owner: Person C/D
Audit log immutable. Field: `level` ('INFO'|'WARNING'|'ERROR'), `event_type`, `message`, `context` (JSON), `created_at`.
**Status:** ✅ Done

---

## Functions & Services (Phase 2–4)

### Kuota harian dosen — Owner: Person C/D
**LOKASI ASLI:** konstanta inline `DOSEN_DAILY_QUOTA_MINUTES` di `apps/bimbingan/views.py` (default 480, baca dari `settings.DOSEN_DAILY_QUOTA_MINUTES`).
> Tidak ada `apps/queue/quota.py::get_remaining_quota()`. Cek kuota dilakukan langsung di `ApproveSubmissionView`: jumlah `estimated_minutes` Session WAITING hari ini + durasi baru tidak boleh > kuota.

### `_calculate_schedule(dosen)` — `apps/bimbingan/views.py`
Mengembalikan `(scheduled_at, queue_position, total_wait_minutes)` untuk Session baru.

### Calendar service — `apps/bimbingan/services/calendar.py` (semua *graceful degradation*, no-op jika `GOOGLE_CALENDAR_ENABLED=false`)
```python
check_free_busy(dosen, start_time, end_time) -> {'isFree': bool, 'conflicts': [...]}
create_event(dosen, event_data: dict) -> Optional[str]   # return google_event_id
update_event(dosen, google_event_id, event_data: dict) -> bool
delete_event(dosen, google_event_id) -> bool
```

### Notification service — `apps/bimbingan/services/notification.py` (Phase 2 stub → log ke SystemLog)
```python
notify_student(student, message, session=None, event_type='NOTIFICATION')
notify_lecturer(lecturer, message, session=None, event_type='NOTIFICATION')
```

### Scheduler — `apps/bimbingan/scheduler.py` (APScheduler, jalan hanya di runserver/gunicorn)
```python
check_h15_notifications()   # notif H-15 menit sebelum scheduled_at
check_auto_cancel()         # auto-cancel jika lewat 30 menit & ts1 masih null
_recalculate_queue(dosen)   # padatkan ulang jadwal antrian setelah pembatalan
```

## URL Namespaces (aktif)
| Prefix | Isi | Owner |
|--------|-----|-------|
| `/api/auth/`, `/api/users/` | login, registrasi, approval user | A |
| `/api/symptoms/` | CRUD gejala + bobot | B |
| `/api/submissions/` | submission + `/<id>/approve/` + `/<id>/reject/` | B + C |
| `/api/queue/` | `my/`, `<id>/cancel/`, `<id>/start/`, `<id>/complete/`, `lecturer/` | C/D |
| `/api/calendar/` | OAuth Google | C/D |
| `/api/stats/` | `lecturer/`, `admin/`, `admin/emergency-cancel/`, `kaprodi/`, `kaprodi/export/` | D |

---

# BAGIAN 2 — Kontrak Phase 5–8 (BARU — untuk kerja paralel)

> **Status semua di bagian ini: ⏳ Belum dibuat.** Ini kontrak yang disepakati di **"Hari 0"** sebelum kerja paralel dimulai.

## Kenapa dipotong per LAYER, bukan per phase

Phase 5→6→7→8 adalah **rantai dependensi** (6 butuh audio dari 5, 7 butuh ringkasan dari 6, dst). Kalau dibagi "1 orang = 1 phase", orang phase berikutnya harus menunggu. Solusinya (sesuai `KERJA_PARALEL.md`): tiap orang memegang **satu layer** dan bekerja melawan kontrak input/output dengan **data dummy**, lalu integrasi di akhir.

```
Person 1 (Rekaman) → audio_file ─┐
                                 ▼
Person 2 (STT) ── stub: 1 sample audio ── → Transcript.text ─┐
                                                             ▼
Person 3 (AI+Review) ── stub: teks dummy ── → Summary ───────┐
                                                             ▼
Person 4 (Saran+Laporan) ── stub: Summary dummy ── → AdviceItem + CSV/PDF + laporan
```

## 🔒 Aturan Hari 0 (WAJIB sebelum koding paralel)
1. **Buat SEMUA model di bawah sekaligus dalam SATU migration**, `migrate`, commit ke branch utama. Setelah itu **model dibekukan** — tidak ada yang menambah migration lagi selama kerja paralel (migration adalah sumber konflik #1).
2. Tambahkan field Phase-5 ke `Session` (`ts2`, `consent_given`, `consent_at`) di migration yang sama.
3. Daftarkan app/route kosong yang diperlukan.
4. Setelah itu tiap orang **hanya mengisi service/view/frontend di file miliknya sendiri.**

---

## Person 1 — Rekaman & Consent (Phase 5) — ✅ SELESAI (2026-07-04, implementasi menyimpang dari draft)

> **Kontrak asli yang jadi (BERBEDA dari draft lama — pakai nama-nama ini):**
> - Field `Session`: `ts2`, `result_notes`, `consent_by_dosen`, `consent_by_mahasiswa`, `consent_given_at` (BUKAN `consent_given`/`consent_at`) — lihat Bagian 1.
> - Model `SessionRecording`: `uuid`, `original_filename`, `file_path`, `file_size`, `mime_type` (BUKAN `audio_path`/`duration_seconds`) — lihat Bagian 1.
> - Tidak ada `recording_views.py` — view di `apps/bimbingan/views.py` mengikuti pola endpoint yang sudah ada.

### Endpoint yang jadi
```
POST /api/queue/<id>/start/     # StartSessionView — ts1 + consent (sudah ada sejak Phase 2)
POST /api/queue/<id>/complete/  # CompleteSessionView — ts2 + status='done' + notes opsional
                                # + upload 'audio' multipart opsional (ditolak tanpa consent)
GET  /api/queue/lecturer/       # kini juga mengembalikan activeSession (sesi IN_PROGRESS)
```

### Frontend
```
src/hooks/useMediaRecorder.ts   # getUserMedia + MediaRecorder, fallback jika izin ditolak
LecturerDashboard.tsx           # "Mulai & Rekam" → ConsentModal → rekam; kartu "Sesi
                                # Berlangsung" dengan indikator "Merekam…", catatan, "Selesai"
```

**Output untuk Person 2:** baris `SessionRecording` dengan `file_path` valid (`MEDIA_ROOT/recordings/<uuid>.webm`). **Stub bagi Person 2:** sediakan 1 file audio sample tetap.

---

## Person 2 — Speech-to-Text (Phase 6a)

### `Transcript` (apps/bimbingan/models.py) — model baru
```python
session       # OneToOne FK ke Session
text          # TextField
status        # 'pending' | 'processing' | 'done' | 'failed'
engine        # CharField, mis. 'groq-whisper-large-v3-turbo'
error_message # TextField blank
created_at
completed_at  # DateTimeField null
```

### STT client (Owner: Person 2) — file baru `apps/bimbingan/services/stt.py`
```python
def transcribe(audio_path: str) -> str:
    """Kirim audio ke STT (Groq whisper-large-v3-turbo), return teks. Raise di kegagalan."""

# STUB hari pertama:
def transcribe(audio_path: str) -> str:
    return "Transkrip dummy untuk pengembangan paralel."   # TODO(P2)
```

### Async task (Owner: Person 2)
```python
def transcribe_audio(session_id: int) -> None:
    """Baca SessionRecording → transcribe() → simpan Transcript. Dipicu setelah finish."""
```
> **Antrian:** pakai **Django Q** (lebih ringan dari Celery+Redis). Pemicu task = detail implementasi.
> **Privasi:** STT hosted = audio keluar server → **tambahkan ke teks consent** (lihat Person 1).

**Output untuk Person 3:** `Transcript.text`. **Stub bagi Person 3:** teks transkrip dummy.

---

## Person 3 — AI Summary & Review Dosen (Phase 6b)

### `Summary` (apps/bimbingan/models.py) — model baru
```python
session       # OneToOne FK ke Session
topik         # CharField
ringkasan     # TextField
saran         # JSONField — list[str] (sesuai TECH-SPEC)
status        # 'draft' | 'approved'
approved_by   # FK CustomUser null
approved_at   # DateTimeField null
created_at
updated_at
```

### LLM client (Owner: Person 3) — file baru `apps/bimbingan/services/llm.py`
```python
def summarize(transcript_text: str) -> dict:
    """Return {'topik': str, 'ringkasan': str, 'saran': list[str]} — format WAJIB dari TECH-SPEC."""

# STUB hari pertama:
def summarize(transcript_text: str) -> dict:
    return {"topik": "Dummy", "ringkasan": "...", "saran": ["saran 1", "saran 2"]}  # TODO(P3)
```

### Async task + endpoint (Owner: Person 3)
```python
def generate_summary(transcript_id: int) -> None:
    """Baca Transcript → summarize() → simpan Summary status='draft'. Picu setelah transcribe selesai."""
```
```
GET   /api/sessions/<id>/summary/          # dosen lihat draft
PATCH /api/sessions/<id>/summary/          # dosen edit topik/ringkasan/saran
POST  /api/sessions/<id>/summary/approve/  # status='draft' → 'approved'
```
**Output untuk Person 4:** `Summary` status='approved'. **Stub bagi Person 4:** objek Summary dummy approved.

---

## Person 4 — Saran-lanjutan, Logbook & Laporan (Phase 7 fallback + Phase 8)

### `AdviceItem` (apps/bimbingan/models.py) — model baru
Dibuat dari `Summary.saran[]` saat ringkasan di-approve, agar follow-up bisa dilacak per item.
```python
summary       # FK ke Summary
text          # CharField — satu item saran
addressed     # BooleanField default False — mahasiswa tandai sudah ditindaklanjuti
evidence_note # TextField blank
addressed_at  # DateTimeField null
created_at
```

### Logbook adapter (Owner: Person 4) — file baru `apps/bimbingan/services/logbook.py`
```python
class LogbookAdapter:                       # interface abstrak (TECH-SPEC Decoupled Adapter)
    def sync(self, summary) -> dict: ...

class FallbackAdapter(LogbookAdapter):      # ← SATU-SATUNYA yang diimplementasi untuk deadline
    def sync(self, summary) -> dict:        # hasilkan CSV/PDF untuk upload manual
        ...

# SekawanAdapter / KPTIAdapter = stub kosong (NotImplemented) — API kampus tidak dipakai (keputusan 2026-06-30)
```
```
GET /api/summaries/<id>/export/?format=csv|pdf   # ekspor fallback
GET /api/advice/student/                          # mahasiswa lihat & tandai saran
GET /api/advice/lecturer/<student_id>/            # dosen lihat riwayat saran advisee
```

### Phase 8 — Laporan (sebagian SUDAH ADA)
Sudah ter-implementasi di `apps/bimbingan/views.py`: `AdminStatsView`, `KaprodiStatsView`, `AdminEmergencyCancelView`, `KaprodiExportView`. Person 4 menambah **laporan kepatuhan saran** setelah `AdviceItem` ada.

---

## Tabel Kepemilikan File — Phase 5–8 (1 file = 1 pemilik)

| Pemilik | Boleh edit | Jangan sentuh |
|---------|-----------|----------------|
| **Hari 0 (bersama)** | `models.py` (semua model baru + field Session), 1 migration | — |
| **Person 1 — Rekaman** | `recording_views.py`, komponen rekaman frontend | `models.py` (beku), file P2/P3/P4 |
| **Person 2 — STT** | `services/stt.py`, task transcribe | `models.py`, file P1/P3/P4 |
| **Person 3 — AI** | `services/llm.py`, task summary, view+UI review | `models.py`, file P1/P2/P4 |
| **Person 4 — Saran/Laporan** | `services/logbook.py`, advice/export/report views | `models.py`, file P1/P2/P3 |

> Setiap orang verifikasi mandiri pakai **mock** (mis. `@patch('...stt.transcribe', return_value="...")`) — tidak menunggu layer lain.

> **Kalau solo:** urutkan saja layer ini secara sekuensial (1→2→3→4); kontraknya tetap berlaku dan tiap potongan bisa di-tes terpisah dengan stub.

---

## Dependency Order (lama, Phase 1–3 — sudah selesai)
```
A (auth) → B (submission) → C (approval/Session) → D (queue/quota)
```

*Diperbarui 2026-06-30: sinkron dengan kode `apps/bimbingan/` + tambah kontrak Phase 5–8 untuk kerja paralel.*
