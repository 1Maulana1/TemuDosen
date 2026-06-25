# Business Process Model & Notation (BPMN) — TemuDosen Platform
**Advising Session Lifecycle Flow Mapping**

> **Status: DEFERRED** — Referensi untuk Phase 4–8. Tidak aktif sampai Phase 3 selesai.

---

## Architectural Flow Sequence

1. **Advising Intake Initiation**: Mahasiswa mengajukan permintaan konsultasi dengan memilih pembimbing, mendetailkan hambatan penelitian aktif, dan melampirkan draft skripsi terbaru.

2. **Concurrent Verification & Intake Approval**: Sistem mengevaluasi integritas dokumen dan data pre-advising secara paralel (AND-Gateway logic). Dosen meninjau paket permintaan, menentukan metode venue (Online vs. Offline), dan memberikan otorisasi sesi.

3. **Queue Scheduling & Calendar Sync**: Sistem menghitung durasi sesi menggunakan metrik AI, menempatkan booking ke antrian live dinamis, menulis event ke Google Calendar, dan mengingatkan kedua pengguna 15 menit sebelum sesi dimulai.

4. **Session Execution & Consent**: Jika mahasiswa check-in sebelum batas 30 menit, sistem meminta otorisasi rekaman audio formal. Dosen klik **"Mulai & Rekam"** untuk mengunci timestamp dan memulai perekaman audio latar belakang.

5. **Asynchronous Automated Processing**: Dosen klik **"Selesai"** untuk menutup sesi. Sistem menangkap state, memperbarui antrian, dan merutekan payload audio secara asinkron ke worker Whisper STT dan LLM untuk membangun transkrip teks dan draft log.

6. **Supervisor Validation & Institutional Sync**: Dosen memeriksa, memperbarui, dan menyetujui blok ringkasan AI terstruktur. Sistem menyimpan catatan final secara internal dan memanggil adapter API untuk sinkronisasi langsung ke logbook kampus institusional (Sekawan/KPTI). Jika API kampus tidak tersedia, sistem mengaktifkan opsi ekspor CSV/PDF manual sebagai backup.

7. **Action Item Tracking & Governance**: Mahasiswa meninjau log pertemuan yang disetujui dan memperbarui action item mereka untuk persiapan sesi berikutnya. Kaprodi mengakses dashboard administrasi untuk meninjau workload dosen dan metrik pelacakan untuk audit akreditasi institusional.

---

## Participant Pool Responsibilities

### 1. Student Lane
* **Initiation Phase**: Memasukkan metadata konsultasi, mengidentifikasi masalah akademik, dan mengunggah file PDF draft yang diperlukan.
* **Verification Phase**: Berinteraksi dengan banner consent data sebelum rekaman sesi dimulai.
* **Post-Session Execution**: Mengakses log advisory yang disetujui dosen dan menggunakan panel pelacakan untuk mencentang action item sebelum sesi berikutnya.

### 2. System Core Engine Lane
* **Gatekeeping Routing**: Mengevaluasi jenis dokumen dan parameter permintaan secara paralel. Jika file gagal pemeriksaan kepatuhan, menolak permintaan dan mengirim peringatan format data kembali ke pengguna.
* **Queue Operations**: Memperkirakan runtime sesi dan memesan entri kalender via Google Calendar API, kemudian melacak jendela check-in real-time.
* **Background Orchestration**: Mengelola perutean file, mengirim tugas pemrosesan ke mesin AI, dan memanggil wrapper koneksi data untuk memperbarui database institusional.

### 3. Supervisor Lane
* **Evaluation Phase**: Memeriksa data pre-advising yang dikirimkan dan menyetujui atau mengembalikan permintaan untuk revisi mahasiswa.
* **Session Governance**: Mengontrol pelacakan runtime menggunakan tombol antarmuka terpadu **"Mulai & Rekam"** dan **"Selesai"**.
* **Validation Phase**: Bertindak sebagai otoritas persetujuan dengan meninjau, mengedit, dan merilis log otomatis ke database universitas.

### 4. External Services Lane
* **Google Calendar API**: Menerima instruksi penjadwalan dan menyuntikkan link pertemuan sesi virtual saat diperlukan.
* **AI Infrastructure (Whisper & LLMs)**: Memproses file audio mentah untuk menghasilkan transkrip teks fidelitas tinggi dan draft ringkasan terstruktur.
* **Campus Logbook Database (Sekawan/KPTI)**: Menerima parameter sesi yang disetujui dan mendaftarkannya ke catatan resmi universitas.

---

## AND-Gateway Logic (Phase 2 — Concurrent Verification)

```
Student Submit Request
        │
        ▼
   ┌─── AND Gateway ───┐
   │                   │
   ▼                   ▼
Check PDF           Check Symptom
Validity            Metadata
   │                   │
   └──── AND Join ─────┘
              │
              ▼
      Route to Lecturer
```

Kedua pemeriksaan harus lulus sebelum permintaan diteruskan ke dosen.
