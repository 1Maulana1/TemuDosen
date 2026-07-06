# Breakdown Fase 6: STT, AI Summarization & Logbook

> Dokumen kerja untuk AI dan developer — breakdown teknis sebelum masuk ke `/gsd-plan-phase 6` resmi. Ditulis berdasarkan pola yang sudah dipakai di `apps/bimbingan/` (services terpisah, `SystemLog` untuk audit, APScheduler untuk job berkala, `SessionRecording` dari Fase 5).

**Goal fase**: Setiap sesi selesai dengan rekaman otomatis menghasilkan entri logbook yang bisa diedit dan harus disetujui dosen, melalui pipeline asinkron STT → ringkasan LLM — dengan fallback ke catatan manual jika pipeline gagal.

**Requirements**: STT-01, STT-02, STT-03, STT-04, STT-05, STT-06, STT-07, ADMIN-05
**Depends on**: Phase 5 (SessionRecording sudah ada sejak 2026-07-04)
**Status saat ini**: 0/6 — lihat [`06-VERIFICATION.md`](06-VERIFICATION.md)

---

## 0. Keputusan desain yang harus diambil DULU (gray area)

Sebelum menulis kode, ini keputusan yang akan menentukan bentuk semua kode di bawahnya — sebaiknya dijawab eksplisit sebelum mulai:

| Keputusan | Opsi | Rekomendasi untuk proyek ini |
|---|---|---|
| **Mekanisme async** | (a) APScheduler polling job baru seperti `check_h15_notifications`, (b) Celery+Redis worker terpisah, (c) thread per-request seperti `_create_calendar_event_async` | **(a)** — konsisten dengan pola yang sudah ada, tidak menambah infra baru (tidak perlu Redis/broker), cocok untuk skala kampus |
| **Di mana faster-whisper jalan** | Proses in-process Django, atau subprocess terpisah | In-process dulu (model load sekali saat scheduler start), pindah ke proses terpisah kalau load CPU/RAM jadi masalah |
| **LLM provider** | API eksternal (OpenAI/Anthropic/lainnya) vs self-host | Sesuai `requirements.txt` belum ada klien LLM — perlu API key baru di settings, mirip pola `GOOGLE_CLIENT_ID`/`GOOGLE_CALENDAR_ENABLED` (feature flag + graceful degradation) |
| **Retry policy** | Berapa kali retry sebelum dianggap gagal & fallback ke manual notes | Rekomendasi: 1x retry otomatis, lalu tandai `FAILED` dan expose fallback manual (STT-07) |
| **State machine status pipeline** | Field `pipeline_status` di model baru | `PENDING → TRANSCRIBING → TRANSCRIBED → SUMMARIZING → SUMMARIZED → PENDING_REVIEW → APPROVED` / `FAILED` di titik mana pun |

> Ini persis jenis pertanyaan yang idealnya dijawab lewat `/gsd-ai-integration-phase` (karena ada komponen AI: STT model + LLM call) sebelum `/gsd-plan-phase 6`.

---

## 1. Model Data Baru

Tambah ke `backend/apps/bimbingan/models.py` (migration baru, mengikuti pola migration 0004):

```python
class SessionSummary(models.Model):
    class PipelineStatus(models.TextChoices):
        PENDING = 'pending', 'Menunggu'
        TRANSCRIBING = 'transcribing', 'Transkripsi'
        TRANSCRIBED = 'transcribed', 'Transkrip Selesai'
        SUMMARIZING = 'summarizing', 'Meringkas'
        PENDING_REVIEW = 'pending_review', 'Menunggu Review Dosen'
        APPROVED = 'approved', 'Disetujui'
        FAILED = 'failed', 'Gagal'
        MANUAL = 'manual', 'Catatan Manual'

    session = models.OneToOneField(Session, on_delete=models.CASCADE, related_name='summary')
    pipeline_status = models.CharField(max_length=20, choices=PipelineStatus.choices, default=PipelineStatus.PENDING)

    transcript = models.TextField(blank=True, default='')
    transcript_generated_at = models.DateTimeField(null=True, blank=True)

    ai_summary_raw = models.JSONField(null=True, blank=True)   # output mentah LLM (advice points + notes)
    edited_summary = models.JSONField(null=True, blank=True)   # setelah diedit dosen
    approved_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)

    failure_reason = models.TextField(blank=True, default='')
    retry_count = models.PositiveSmallIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

Catatan penting:
- **`ActionItem` (sudah ada) jadi konsumen `edited_summary`** — saat dosen approve, advice points dari `edited_summary` dipecah jadi baris-baris `ActionItem` baru (menyambung ke Fase 7 yang sudah menunggu ini).
- Field `session.result_notes` (Fase 5, manual notes) **tetap dipakai sebagai fallback** kalau `pipeline_status = MANUAL/FAILED` — tidak perlu field baru untuk itu, STT-07 tinggal reuse.

---

## 2. Struktur Service Baru (ikut pola `services/calendar.py`)

```
backend/apps/bimbingan/services/
  stt.py             # wrapper faster-whisper
  llm_summary.py     # wrapper panggilan LLM
```

**`stt.py`** — kontrak fungsi:

```python
def transcribe_audio(recording: SessionRecording) -> str:
    """
    Jalankan faster-whisper large-v3-turbo terhadap recording.file_path.
    Raise exception jika gagal — caller (job) yang menangani logging+fallback.
    TIDAK boleh raise ke luar pipeline runner tanpa tertangkap (ikuti pola
    calendar.py: semua try/except di titik pemanggilan, bukan di sini).
    """
```

**`llm_summary.py`** — kontrak fungsi:

```python
def generate_summary(transcript: str) -> dict:
    """
    Panggil LLM API, return JSON terstruktur:
    {"advice_points": [str, ...], "improvement_notes": [str, ...]}
    Timeout eksplisit (mis. 30s). Raise exception jika gagal/timeout.
    """
```

Kedua fungsi ini **sengaja dibuat pure/testable** (menerima input, return value, raise saat gagal) — semua try/except, logging ke `SystemLog`, dan update status ada di **runner/job**, bukan di service, persis seperti `check_h15_notifications` yang membungkus logic dalam try/except di level job.

---

## 3. Pipeline Runner — job asinkron baru

Tambah ke `backend/apps/bimbingan/scheduler.py` (job baru, bukan file terpisah — konsisten dengan 2 job yang sudah ada):

```python
def process_pending_summaries():
    """
    STT-01..07: cari SessionSummary yang butuh diproses, jalankan tahap
    berikutnya. Dipanggil tiap interval pendek (mis. 30 detik) supaya
    "asinkron" terasa responsif tanpa perlu message broker.
    """
    try:
        # 1. Sesi DONE + punya recording, belum ada SessionSummary -> buat PENDING
        # 2. PENDING atau TRANSCRIBING(stuck) -> transcribe_audio() -> TRANSCRIBED
        # 3. TRANSCRIBED -> generate_summary() -> PENDING_REVIEW
        # setiap tahap: try/except sendiri, gagal -> retry_count++,
        #   jika retry_count >= MAX -> FAILED + SystemLog ERROR + notify dosen
    except Exception as e:
        logger.exception('process_pending_summaries error: %s', e)
```

Daftarkan di `start_scheduler()`:

```python
_scheduler.add_job(process_pending_summaries, IntervalTrigger(seconds=30), id='stt_llm_pipeline', ...)
```

**Kenapa polling interval pendek, bukan trigger langsung dari `CompleteSessionView`:** memenuhi STT-02 ("UI tidak boleh terblokir") secara alami — job berjalan di background thread scheduler, request HTTP `POST /complete/` selesai instan tanpa menunggu whisper/LLM.

**Trigger awal**: di `CompleteSessionView._save_recording()` (`views.py:838`), setelah `SessionRecording` dibuat, langsung `SessionSummary.objects.get_or_create(session=session)` — supaya job scheduler langsung menemukannya di polling berikutnya (tidak perlu tunggu job scan semua `Session.DONE`).

---

## 4. Endpoint API baru (tambah ke `views.py` + `urls.py`)

Ikut pola permission (`IsLecturer`, `IsAdmin` custom seperti `AdminStatsView`):

| Endpoint | Method | Permission | Fungsi |
|---|---|---|---|
| `/api/queue/<id>/summary/` | GET | Dosen (pemilik sesi) | Lihat transcript + ai_summary_raw + status pipeline |
| `/api/queue/<id>/summary/` | PATCH | Dosen (pemilik sesi) | Simpan edit ke `edited_summary` (draft, belum approve) |
| `/api/queue/<id>/summary/approve/` | POST | Dosen (pemilik sesi) | Set `APPROVED`, `approved_at/by`, **pecah advice_points jadi `ActionItem` baru** (STT-04/05) |
| `/api/queue/<id>/summary/manual/` | POST | Dosen (pemilik sesi) | Fallback STT-07: set `pipeline_status=MANUAL`, isi `session.result_notes` |
| `/api/queue/<id>/summary/` (student) | GET | Mahasiswa (pemilik sesi) | Return **hanya jika `APPROVED`** (403/404 kalau belum) — STT-06 |
| `/api/admin/stt-quota/` | GET | Admin | ADMIN-05 — hitung sesi diproses hari ini, error count, durasi transkripsi rata-rata |

Perluas `AdminStatsView` (`views.py:898`) — tambahkan section baru di response, mengikuti pola `integrations.google_calendar` yang sudah ada:

```python
'integrations': {
    'google_calendar': {...},
    'stt_llm': {
        'enabled': getattr(settings, 'STT_LLM_ENABLED', False),
        'processed_today': ...,
        'failed_today': ...,
        'avg_processing_seconds': ...,
    },
},
```

---

## 5. Settings baru (ikut pola `GOOGLE_CALENDAR_ENABLED`)

`backend/config/settings/base.py`:

```python
STT_LLM_ENABLED = env.bool('STT_LLM_ENABLED', default=False)
STT_MODEL_SIZE = env.str('STT_MODEL_SIZE', default='large-v3-turbo')
LLM_API_KEY = env.str('LLM_API_KEY', default='')
LLM_API_TIMEOUT_SECONDS = env.int('LLM_API_TIMEOUT_SECONDS', default=30)
STT_MAX_RETRIES = env.int('STT_MAX_RETRIES', default=1)
```

Feature flag ini penting: kalau `STT_LLM_ENABLED=False` (mis. belum ada GPU/API key di server dev), pipeline langsung skip dan semua sesi otomatis jatuh ke jalur manual notes — sama persis semangat "graceful degradation" yang sudah dipakai Calendar (NFR-02).

`requirements.txt` tambahan:

```
faster-whisper==1.*
# klien LLM sesuai provider yang dipilih, mis:
anthropic==0.*   # atau openai==1.*
```

---

## 6. Frontend

**Halaman/komponen baru:**

| File | Untuk siapa | Isi |
|---|---|---|
| `frontend/src/pages/lecturer/SessionSummaryReview.tsx` | Dosen | Tampilkan transcript (read-only) + form edit advice_points/improvement_notes + tombol "Setujui" |
| Tambahan di `frontend/src/pages/lecturer/LecturerQueue.tsx` | Dosen | Setelah sesi DONE, tampilkan status pipeline (badge: "Memproses…" / "Siap direview" / "Gagal — isi manual") + link ke review page |
| Tambahan di halaman riwayat mahasiswa (student dashboard) | Mahasiswa | Tampilkan transcript+summary **hanya untuk sesi APPROVED** |
| Tambahan di `frontend/src/pages/admin/AdminDashboard.tsx` | Admin | Card baru: kuota STT/LLM harian + failure log (reuse pola `recent_errors` yang sudah ada) |
| `frontend/src/api/sessions.ts` | — | Tambah fungsi `getSessionSummary`, `updateSessionSummary`, `approveSessionSummary`, `submitManualNotes` |

**Alur UI dosen (SC3):**

1. Sesi selesai → badge "Memproses transkrip…" (polling status tiap beberapa detik, pola sama dengan `StudentQueue.tsx` 30s poll)
2. Status jadi "Siap direview" → tombol buka `SessionSummaryReview`
3. Dosen lihat transcript, edit teks advice/improvement di textarea/list editable
4. Klik "Setujui" → `POST .../approve/` → advice items jadi `ActionItem`, mahasiswa bisa lihat
5. Kalau status "Gagal" → tombol "Isi Catatan Manual" muncul, buka editor sederhana (textarea) → `POST .../manual/`

---

## 7. Pemecahan jadi Wave (mengikuti pola Phase 1 di ROADMAP.md)

| Wave | Isi | Bisa paralel? |
|---|---|---|
| **Wave 0** | Model `SessionSummary` + migration, settings baru, `requirements.txt` | Blocking semua |
| **Wave 1a** | `services/stt.py` + unit test dengan audio fixture pendek | Paralel dengan 1b |
| **Wave 1b** | `services/llm_summary.py` + unit test dengan transcript fixture (mock API call) | Paralel dengan 1a |
| **Wave 2** | `process_pending_summaries()` job di scheduler.py, wiring trigger di `CompleteSessionView` | Depends on 1a+1b |
| **Wave 3** | Endpoint API (summary GET/PATCH/approve/manual, admin quota) + permission tests | Depends on Wave 0 |
| **Wave 4a** | Frontend dosen: `SessionSummaryReview.tsx` + status badge di `LecturerQueue.tsx` | Depends on Wave 3 |
| **Wave 4b** | Frontend mahasiswa: tampilan transcript/summary approved | Paralel dengan 4a |
| **Wave 4c** | Frontend admin: kuota + failure log card | Paralel dengan 4a/4b |
| **Wave 5** | Integration test end-to-end (sesi selesai → pipeline jalan → approve → mahasiswa lihat) + test fallback manual | Depends on semua |

---

## 8. Test coverage yang wajib ada

Ikut pola `test_session_execution.py` (17 test) dan `test_calendar.py` (16 test):

- `test_stt.py` — transcribe berhasil, transcribe gagal/exception ditangkap
- `test_llm_summary.py` — generate berhasil, timeout ditangani
- `test_summary_pipeline.py` — state machine job: `PENDING→TRANSCRIBED→PENDING_REVIEW`, retry logic, jatuh ke `FAILED` setelah `STT_MAX_RETRIES`
- `test_summary_views.py` — permission (dosen lain tidak bisa akses), approve membuat `ActionItem`, mahasiswa tidak bisa lihat sebelum approved (403/404), manual fallback
- Regression: `test_admin.py` — tambah assert untuk field `stt_llm` baru di `AdminStatsView`

---

## 9. Traceability requirement → deliverable

| Req | Dipenuhi oleh |
|---|---|
| STT-01/02 | `services/stt.py` + `process_pending_summaries` job (polling 30s, non-blocking) |
| STT-03 | `services/llm_summary.py` |
| STT-04 | `SessionSummaryReview.tsx` + endpoint PATCH/approve |
| STT-05 | Model `SessionSummary` + `ActionItem` linkage |
| STT-06 | Endpoint GET summary (mahasiswa) dengan guard `APPROVED` |
| STT-07 | `pipeline_status=FAILED/MANUAL` + endpoint `.../manual/` + reuse `session.result_notes` |
| ADMIN-05 | `AdminStatsView.integrations.stt_llm` + frontend card di `AdminDashboard.tsx` |

---

## 10. Rekomendasi langkah eksekusi berikutnya

Karena fase ini punya komponen AI murni (model STT + LLM call, bukan sekadar CRUD), sebaiknya **jangan langsung `/gsd-plan-phase 6`** — lewati dulu:

1. **`/gsd-ai-integration-phase 6`** — untuk menghasilkan `AI-SPEC.md` resmi: pilihan model/provider LLM konkret, strategi evaluasi kualitas ringkasan (bagaimana menilai "ringkasan bagus"), guardrail (mis. LLM jangan halusinasi advice yang tidak ada di transcript), dan rencana monitoring produksi.
2. Baru **`/gsd-plan-phase 6`** — untuk mengubah breakdown di atas jadi `PLAN.md` per-wave yang formal dengan verifikasi goal-backward, seperti Phase 1.

---

*Ditulis: 2026-07-04*
*Status: draft breakdown — belum ada PLAN.md formal*
