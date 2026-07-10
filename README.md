# TemuDosen

Platform dokumentasi dan antrian bimbingan akademik berbasis web untuk mahasiswa dan dosen pembimbing skripsi.

## Tentang Proyek

TemuDosen menggantikan sistem antrean manual (nama di kertas di depan ruang dosen) dengan platform digital yang memungkinkan:

- Mahasiswa mengajukan permintaan bimbingan dengan gejala akademik dan upload draft PDF
- Dosen menyetujui/menolak pengajuan dengan estimasi durasi otomatis
- Mahasiswa memantau posisi antrian secara real-time dan bisa self-cancel
- Admin mengkonfigurasi bobot gejala dan mengelola pengguna

## Status Proyek

| Phase | Deskripsi | Status |
|-------|-----------|--------|
| 1. Submission & Triage | Pengajuan mahasiswa, konfigurasi gejala, review dosen | ✅ Selesai |
| 2. Approval & Queue Placement | Approve/reject dosen, hitung durasi, penempatan antrian | 🔄 In Progress |
| 3. Live Queue Management | Status antrian real-time, self-cancel, kuota harian | ⏳ Belum dimulai |
| 4–8. (AI, Recording, Logbook, dll) | Fitur lanjutan | 🗂️ Deferred |

**Deadline MVP (Phase 1–3): 15 Juli 2026**

## Tech Stack

- **Backend**: Python 3.11 + Django 5 + Django REST Framework
- **Database**: SQLite (dev) / PostgreSQL (prod)
- **Auth**: Session-based authentication
- **File Storage**: Server-side protected serving (tidak pakai MEDIA_URL publik)

## Struktur Folder

```
TemuDosen/
├── backend/
│   ├── apps/
│   │   ├── accounts/     # User, login, registrasi, approval
│   │   ├── submissions/  # Pengajuan bimbingan & file upload
│   │   ├── symptoms/     # Kategori gejala & bobot durasi
│   │   └── queue/        # Antrian, kuota, status (Phase 2-3)
│   ├── config/           # Settings, URLs utama
│   └── manage.py
├── frontend/             # (coming soon)
├── docs/                 # Dokumentasi tim (deploy, panduan, kontrak, audit, dll)
│   ├── PANDUAN_TIM.md    # Panduan lengkap per anggota tim (Bahasa Indonesia)
│   └── INTERFACES.md     # Kontrak model & fungsi antar anggota tim
└── .planning/            # Dokumen perencanaan proyek
    ├── ROADMAP.md
    ├── PROJECT.md
    └── deferred/         # Dokumen Phase 4-8 (BMC, BPMN, TECH-SPEC)
```

## Cara Menjalankan

### Dengan Docker (Direkomendasikan)

```bash
# Clone repo
git clone https://github.com/1Maulana1/TemuDosen.git
cd TemuDosen

# Development (runserver + PostgreSQL)
docker-compose -f docker-compose.dev.yml up --build

# Production (gunicorn + PostgreSQL)
docker-compose up --build
```

Server berjalan di `http://localhost:8000`

Database PostgreSQL berjalan di `localhost:5432` — bisa dibuka di phpMyAdmin/DBeaver/TablePlus.

### Tanpa Docker (Manual)

```bash
cd TemuDosen/backend

# Buat virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # Mac/Linux

# Install dependensi
pip install -r requirements.txt

# Setup environment
cp .env.example .env

# Jalankan migrasi & seed admin
python manage.py migrate
python manage.py seed_admin

# Jalankan server
python manage.py runserver
```

Server berjalan di `http://127.0.0.1:8000`

## API Endpoints

| Method | URL | Akses |
|--------|-----|-------|
| POST | `/api/auth/login/` | Publik |
| POST | `/api/auth/logout/` | Login |
| GET | `/api/auth/me/` | Login |
| POST | `/api/auth/register/` | Publik |
| GET | `/api/users/lecturers/` | Publik |
| GET | `/api/users/pending/` | Admin |
| POST | `/api/users/<id>/approve/` | Admin |
| POST | `/api/users/<id>/reject/` | Admin |
| POST | `/api/submissions/` | Mahasiswa |
| GET | `/api/submissions/` | Mahasiswa |
| GET | `/api/submissions/lecturer/` | Dosen |
| GET | `/api/files/<uuid>/` | Owner/Adviser/Admin |
| POST | `/api/submissions/<id>/approve/` | Dosen *(Phase 2)* |
| POST | `/api/submissions/<id>/reject/` | Dosen *(Phase 2)* |
| GET | `/api/queue/my/` | Mahasiswa *(Phase 3)* |
| POST | `/api/queue/<id>/cancel/` | Mahasiswa *(Phase 3)* |
| GET | `/api/queue/lecturer/` | Dosen *(Phase 3)* |

## Untuk Anggota Tim

Baca **[docs/PANDUAN_TIM.md](docs/PANDUAN_TIM.md)** untuk panduan lengkap tugas masing-masing anggota tim dalam Bahasa Indonesia.

Baca **[docs/INTERFACES.md](docs/INTERFACES.md)** untuk kontrak model dan fungsi antar anggota sebelum mulai coding.

Dokumentasi lengkap lainnya (deploy, demo accounts, audit, backlog) ada di **[docs/README.md](docs/README.md)**.

## Tim

Kelompok 1 — Proyek S4, Juni 2026
