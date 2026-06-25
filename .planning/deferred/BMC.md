# Business Model Canvas (BMC) — TemuDosen Platform
**Automated Advising Documentation & Continuity Tracking System**
**Business Model:** Institutional B2B2C SaaS

> **Status: DEFERRED** — Referensi untuk Phase 4–8. Tidak aktif sampai Phase 3 selesai.

---

### 1. Key Partnerships
* **AI & Cloud Infrastructure Providers**: Whisper Speech-to-Text (STT) engines, Large Language Model (LLM) APIs, dan dedicated GPU inference instances.
* **Academic Information System (SIA) Developers**: Tim IT universitas atau pihak ketiga (e.g., *Sekawan* / *KPTI*) yang mengelola portal mahasiswa dan logbook akademik institusional.
* **Notification & Calendar Gateways**: Google Calendar API untuk penjadwalan otomatis + WhatsApp Business API / SMTP email gateway untuk notifikasi.
* **Universities & Academic Departments**: Institusi pendidikan tinggi sebagai pilot deployment partner.

### 2. Key Activities
* **Platform Development**: Engineering dan maintenance PWA responsif + live queue management engine.
* **AI Pipeline Operations**: Pemrosesan pipeline transkripsi latensi rendah (STT) dan algoritma ringkasan terstruktur (LLM) yang dioptimalkan untuk istilah akademik Indonesia.
* **Integration Lifecycle Management**: Memelihara koneksi API aman mencakup SSO, sinkronisasi kalender, dan logbook institusional kampus.
* **Data Security & Compliance Operations**: Enkripsi end-to-end, manajemen consent rekaman, dan kepatuhan privasi data universitas.
* **Client Onboarding & Training**: Membantu admin departemen saat konfigurasi awal dan pelatihan staf akademik.

### 3. Value Propositions
* **Beyond Basic Scheduling**: Fokus pada dokumentasi sesi otomatis: *Record → Transcribe → AI Summary → Campus Logbook*.
* **Advising Continuity Tracking**: Mencegah dosen kehilangan konteks bimbingan sebelumnya; melacak update mahasiswa dan action item lintas sesi.
* **Accreditation-Ready Logbooks**: Menghasilkan data bimbingan terstruktur, lengkap, dan real-time untuk audit akreditasi universitas.
* **Frictionless Efficiency**: Menghilangkan antrean fisik di depan ruang dosen untuk mahasiswa, sekaligus menghilangkan tugas pengetikan dokumentasi manual untuk dosen.

### 4. Customer Relationships
* **Self-Service Architecture**: UX PWA intuitif yang dioptimalkan untuk penggunaan mandiri oleh mahasiswa dan dosen.
* **Administrative Onboarding Desks**: Dashboard implementasi khusus untuk kepala departemen dan setup IT institusional.
* **Enterprise SLA-Backed Support**: Kontrak operasional dengan jaminan uptime 99.5% untuk sekolah mitra.
* **Cyclical Upgrades**: Penyesuaian model dan peningkatan usability berdasarkan feedback fakultas dan administrasi.

### 5. Customer Segments
* **Economic Buyers / Decision Makers**: Kaprodi, Dekan, dan Biro Akademik yang memegang anggaran pengadaan software dan target akreditasi institusional.
* **Primary Users**: Mahasiswa tingkat akhir yang mengerjakan skripsi atau tesis aktif.
* **End Users**: Dosen pembimbing skripsi.
* **Quality Evaluators**: Tim Gugus Penjamin Mutu (GPM) dan auditor akreditasi.
* **Expansion Target**: Institusi pendidikan tinggi regional yang ingin mengotomatisasi kepatuhan akademik.

### 6. Key Resources
* **Product & Engineering Talent**: Software engineer dan product manager yang mengawasi arsitektur sistem.
* **Cloud Computations & Inference Networks**: Virtual machine skalabel berkinerja tinggi yang menjalankan algoritma transkripsi.
* **AI Models & Scholarly Datasets**: Model Whisper fine-tuned dan konteks sistem LLM yang dioptimalkan untuk kosakata akademik Indonesia.
* **Institutional Access Bridges**: Titik koneksi API yang terhubung aman ke database universitas.

### 7. Channels
* **Responsive PWA**: Platform tanpa instalasi yang dapat diakses dari browser mobile atau desktop apapun.
* **Campus SSO**: Onboarding pengguna otomatis yang terintegrasi ke portal mahasiswa yang ada.
* **Multi-Channel Notification Gateways**: Web push, email transaksional, dan update status WhatsApp.
* **Department-Led Orientations**: Orientasi pelatihan berdampak tinggi untuk dosen di awal setiap semester.
* **Direct Institutional Pitching**: Presentasi penjualan enterprise ke dewan eksekutif universitas.

### 8. Cost Structure
* **Variable AI Inference Fees**: Biaya variabel utama dari GPU processing minutes (Whisper) dan konsumsi token teks (LLM).
* **Cloud Hosting & Secure Storage**: Cluster database untuk file audio terenkripsi, transkrip teks, dan metadata dokumentasi.
* **Engineering & Maintenance Salaries**: Gaji tenaga developer, manajemen API, dan tim dukungan teknis.
* **Compliance & Institutional Acquisition**: Audit kepatuhan privasi mahasiswa + biaya onboarding institusional.

### 9. Revenue Streams
* **Institutional SaaS Subscriptions**: Biaya lisensi software berulang tahunan dihitung per departemen aktif atau jumlah mahasiswa aktif.
* **Setup & Custom Engineering Fees**: Biaya implementasi satu kali untuk SSO kampus dan adapter database institusional kustom.
* **Volume-Based AI Overage Tiers**: Opsi penagihan add-on untuk penggunaan premium melebihi batas rekaman audio bulanan default.
* **Freemium Model Strategy**: Tier penjadwalan dasar gratis untuk membangun densitas kampus, dengan rekaman otomatis, pipeline AI, dan dashboard kepatuhan di balik langganan institusional.
