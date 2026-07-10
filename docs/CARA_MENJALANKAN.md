# Cara Menjalankan Server — TemuDosen

Panduan menjalankan aplikasi secara lokal. Ada **2 cara**: Manual dan Docker.
Aplikasi terdiri dari **backend** (Django, port 8000) dan **frontend** (Vite/React, port 5173).

Login pakai akun demo mana pun dengan password **`demo123`** (lihat [DEMO_ACCOUNTS.md](DEMO_ACCOUNTS.md)).

---

## Cara 1 — Manual (tanpa Docker)

Butuh **2 terminal**. Database memakai SQLite (`backend/db.sqlite3`).

### Terminal 1 — Backend (port 8000)

```powershell
cd "D:\Proyek s4\TemuDosen\backend"

# Aktifkan virtual environment
.\.venv_test\Scripts\Activate.ps1

# (pertama kali / setelah git pull) pasang dependensi + migrasi
pip install -r requirements.txt
python manage.py migrate

# (opsional) isi akun & data bimbingan demo
python manage.py seed_dev
python manage.py seed_bimbingan

# Jalankan server
python manage.py runserver
```

Backend jalan di **http://127.0.0.1:8000**

> Jika `Activate.ps1` ditolak karena execution policy, jalankan sekali:
> `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
> Alternatif tanpa aktivasi: `.\.venv_test\Scripts\python.exe manage.py runserver`

### Terminal 2 — Frontend (port 5173)

```powershell
cd "D:\Proyek s4\TemuDosen\frontend"

# (pertama kali / setelah git pull) pasang dependensi
npm install

# Jalankan dev server
npm run dev
```

Frontend jalan di **http://localhost:5173** — buka ini di browser.

---

## Cara 2 — Docker

> Docker di repo ini **hanya membungkus backend** (Django + PostgreSQL + Redis + Celery).
> **Frontend tetap dijalankan manual** dengan `npm run dev` (Terminal 2 di atas).
> Database memakai PostgreSQL (terpisah dari SQLite manual).

Pastikan **Docker Desktop** menyala.

### Development (runserver)

```powershell
cd "D:\Proyek s4\TemuDosen"
docker compose -f docker-compose.dev.yml up --build
```

Otomatis menjalankan `migrate` + `seed_admin`. Backend jalan di **http://localhost:8000**,
PostgreSQL di **localhost:5432**.

### Production-like (gunicorn)

```powershell
docker compose up --build
```

### Isi akun & data demo (di dalam container)

`docker compose` hanya seed admin. Untuk akun demo (`demo123`) & data bimbingan,
jalankan di terminal lain:

```powershell
docker compose -f docker-compose.dev.yml exec web python manage.py seed_dev
docker compose -f docker-compose.dev.yml exec web python manage.py seed_bimbingan
```

### Frontend (tetap manual)

```powershell
cd "D:\Proyek s4\TemuDosen\frontend"
npm install   # pertama kali saja
npm run dev
```

Buka **http://localhost:5173**.

### Perintah Docker berguna

```powershell
docker compose -f docker-compose.dev.yml up -d        # jalan di background
docker compose -f docker-compose.dev.yml logs -f web  # lihat log backend
docker compose -f docker-compose.dev.yml down         # hentikan
docker compose -f docker-compose.dev.yml down -v      # hentikan + hapus data DB
```

### Menyalakan lewat aplikasi Docker Desktop (bukan CLI)

- **Pembuatan pertama** paling andal lewat CLI (`docker compose ... up --build`) —
  GUI tidak punya tombol build compose dari file.
- **Setelah dibuat sekali**, stack muncul sebagai project `temudosen` di tab
  **Containers** Docker Desktop. Selanjutnya cukup klik tombol **play/stop** untuk
  menyalakan/mematikan seluruh stack tanpa CLI.

---

## Ringkasan perbedaan

| | Manual | Docker |
|---|---|---|
| Database | SQLite (`db.sqlite3`) | PostgreSQL (container) |
| Backend | `python manage.py runserver` | container `web` (:8000) |
| Frontend | `npm run dev` (:5173) | **tetap manual** `npm run dev` |
| Redis/Celery | tidak jalan (pipeline STT/LLM nonaktif) | ikut jalan (`STT_LLM_ENABLED=False`) |
| Data demo | seed di SQLite | seed ulang di dalam container |

> Catatan: database Docker (Postgres) dan manual (SQLite) **terpisah**. Data demo yang
> di-seed di satu lingkungan tidak muncul di lingkungan lain — seed ulang bila berpindah.

---

## Akses aplikasi

Selalu buka lewat frontend: **http://localhost:5173** (bukan `:8000`).
Frontend mem-proxy request `/api` ke backend secara otomatis.
