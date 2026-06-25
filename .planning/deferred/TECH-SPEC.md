# Technical Architecture & Integration Layer — TemuDosen Platform
**System Backend Protocols & API Adapter Specifications**

> **Status: DEFERRED** — Referensi untuk Phase 4–8 (STT, LLM, Campus Logbook). Tidak aktif sampai Phase 3 selesai.

---

## 1. Hybrid AI Execution Topology

### 1.1 Speech-to-Text (STT) Processing Pipeline
* **Engine**: Whisper Open-Source Model (faster-whisper large-v3-turbo, self-hosted)
* **Execution Model**: Asynchronous Task Queuing — file audio dikirim ke background task queue, bukan diproses dalam request loop aktif. Ini mencegah timeout antarmuka web dan memungkinkan platform mengantri workload audio berat secara sistematis berdasarkan kapasitas GPU yang tersedia.
* **Privacy**: Audio tetap di server (tidak dikirim ke API eksternal)

### 1.2 Large Language Model (LLM) Orchestration
* **Role**: Summarisasi teks dan ekstraksi saran/action item
* **Provider**: API tier (Gemini Flash / GPT-mini / Claude Haiku) — hanya teks transkrip yang keluar dari server, bukan audio
* **Prompt Architecture**: Konteks prompt dioptimalkan untuk output teks bersih yang sesuai pola logging standar universitas

**Format output LLM yang WAJIB diikuti:**
```json
{
  "topik": "Judul topik bimbingan",
  "ringkasan": "Teks ringkasan narasi hasil bimbingan",
  "saran": [
    "Action item pertama yang harus dilakukan mahasiswa",
    "Action item kedua",
    "..."
  ]
}
```

---

## 2. Campus Logbook Integration Strategy & Fallback Failovers

### 2.1 The Decoupled Adapter Pattern
Layer sinkronisasi berada di balik interface sistem abstrak. Jika universitas memperbarui arsitektur backend-nya, engineer hanya perlu memperbarui modul adapter spesifik tanpa mengubah fitur inti platform.

```
Core Platform
     │
     ▼
LogbookAdapter (abstract interface)
     │
     ├── SekawanAdapter (implement jika Sekawan tersedia)
     ├── KPTIAdapter    (implement jika KPTI tersedia)
     └── FallbackAdapter → ekspor CSV/PDF manual
```

### 2.2 Primary Integration Path (Automated Sync)

Ketika API kampus tersedia, data tersinkronisasi saat dosen menyetujui ringkasan.

* **Endpoint**: `POST /api/v1/logbook/entries`
* **Content-Type**: `application/json`
* **Authentication**: `Authorization: Bearer <token>`

**Request Schema:**
```json
{
  "nim": "20210001",
  "nidn": "0012345678",
  "tanggal": "2026-06-16T14:00:00+07:00",
  "topik": "Bab 3 — Metodologi Penelitian",
  "ringkasan": "Mahasiswa mempresentasikan kerangka analisis data. Layout arsitektur sistem ditinjau dan diverifikasi.",
  "saran": [
    "Perbaiki rumusan masalah di bagian dua",
    "Perluas tinjauan pustaka dengan jurnal terbaru"
  ],
  "durasi_menit": 35
}
```

**Field mapping dari model internal:**

| Field JSON | Sumber di TemuDosen |
|------------|---------------------|
| `nim` | `submission.student.nim` |
| `nidn` | `submission.student.adviser.nidn` |
| `tanggal` | `QueueSlot.estimated_start` |
| `topik` | Output LLM field `topik` |
| `ringkasan` | Output LLM field `ringkasan` |
| `saran` | Output LLM field `saran[]` |
| `durasi_menit` | `QueueSlot.estimated_duration` |

### 2.3 Fallback Strategy

Jika API kampus tidak tersedia atau gagal:
1. Summary tetap tersimpan di database internal TemuDosen
2. Dicatat ke error log Admin Dashboard
3. Dijadwalkan untuk retry otomatis
4. Dosen ditawari ekspor CSV/PDF untuk upload manual

---

## 3. Async Task Queue Architecture (Phase 6)

```
Session Selesai (Dosen klik "Selesai")
        │
        ▼
Simpan audio file ke storage
        │
        ▼
Enqueue task: transcribe_audio(session_id)
        │
        ▼ (background worker)
Whisper STT → simpan Transcript
        │
        ▼
Enqueue task: generate_summary(transcript_id)
        │
        ▼ (background worker)
LLM API → parse output → simpan Draft Summary
        │
        ▼
Notifikasi dosen: "Ringkasan siap untuk ditinjau"
```

**Tools yang akan dipakai:** Celery + Redis (atau Django Q sebagai alternatif lebih ringan)
