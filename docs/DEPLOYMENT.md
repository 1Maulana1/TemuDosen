# Panduan Deploy TemuDosen (Frontend + Backend)

Panduan untuk tim yang mau menerbitkan TemuDosen supaya bisa diakses dari
internet (mis. direview dosen dari HP).

## Arsitektur

TemuDosen = **2 bagian terpisah** yang di-deploy di tempat berbeda:

```
  Pengguna (HP/laptop)
        │
        ▼
  ┌─────────────────────────────┐        ┌──────────────────────────────┐
  │  FRONTEND (React + Vite)     │  API   │  BACKEND (Django + Postgres)  │
  │  Cloudflare Pages            │ ─────► │  Railway / Render             │
  │  temudosen.pages.dev         │        │  api...  (nyala 24/7)         │
  └─────────────────────────────┘        └──────────────────────────────┘
```

- **Frontend** = file statis → **Cloudflare Pages** (gratis).
- **Backend** = Django + PostgreSQL, butuh server yang hidup terus → **Railway/Render**
  (Cloudflare TIDAK bisa menjalankan Django).

> Aturan penting: frontend hanya menampilkan UI. Semua login & data datang dari
> backend. Kalau backend belum online, frontend tampil tapi semua gagal.

---

## Bagian A — Deploy Backend (Django)

Repo sudah punya `Dockerfile` (gunicorn + psycopg2). `config/wsgi.py` default ke
`config.settings.prod`. Pilih salah satu platform di bawah.

### Env var yang WAJIB di-set (semua platform)

| Variable | Contoh / Nilai | Keterangan |
|----------|----------------|------------|
| `DJANGO_SETTINGS_MODULE` | `config.settings.prod` | Pakai settings produksi |
| `SECRET_KEY` | (string acak panjang) | JANGAN pakai default. Generate baru. |
| `DATABASE_URL` | `postgres://user:pass@host:5432/db` | Dari PostgreSQL platform (biasanya otomatis) |
| `ALLOWED_HOSTS` | `temudosen.up.railway.app` | Domain backend (pisah koma jika banyak) |
| `CORS_ALLOWED_ORIGINS` | `https://temudosen.pages.dev` | Domain FRONTEND. `CSRF_TRUSTED_ORIGINS` ikut otomatis. |
| `COOKIE_SAMESITE` | `None` | **Wajib `None`** jika frontend di `*.pages.dev` (beda domain). Lihat catatan cookie. |
| `FRONTEND_URL` | `https://temudosen.pages.dev` | Untuk redirect (mis. OAuth Calendar) |

Env var **opsional** (fitur — biarkan default kalau tidak dipakai):

| Variable | Default | Untuk |
|----------|---------|-------|
| `GOOGLE_CALENDAR_ENABLED` | `False` | Integrasi Google Calendar |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | kosong | OAuth Calendar |
| `STT_LLM_ENABLED` | `False` | Pipeline transkrip + ringkasan AI (butuh Redis/Celery) |
| `ANTHROPIC_API_KEY` | kosong | LLM ringkasan |
| `CAMPUS_LOGBOOK_ENABLED` | `False` | Sinkron logbook kampus |

> Generate `SECRET_KEY`:
> `python -c "import secrets; print(secrets.token_urlsafe(50))"`

### Opsi 1 — Railway (mulus, ~$5/bln, tanpa cold start)

1. Buat project di [railway.app](https://railway.app) → **Deploy from GitHub repo**.
2. Railway auto-deteksi `Dockerfile`. Set **Root directory** ke root repo
   (Dockerfile ada di root, meng-copy `backend/`).
3. Tambah service **PostgreSQL** (New → Database → PostgreSQL). Railway otomatis
   membuat `DATABASE_URL` — link ke service backend.
4. Isi env var dari tabel di atas (Variables tab).
5. Jalankan migrasi + seed admin (Railway → service → Shell, atau tambah ke start command):
   ```
   python manage.py migrate
   python manage.py seed_admin
   ```
6. Domain backend ada di Settings → Networking → Generate Domain.

#### Mengaktifkan pipeline STT/LLM di Railway (opsional)

Rekaman sesi → transkrip (Groq Whisper API, free tier) → ringkasan (Anthropic).
Celery worker ikut jalan **di dalam container backend** (via `start.sh`) karena
Railway tidak bisa share volume antar service — worker harus bisa membaca file
rekaman yang ditulis web service. Dengan provider `groq`, worker hanya
melakukan HTTP call, jadi ringan.

1. Tambah **Redis**: New → Database → Redis.
2. Di Variables service backend, tambahkan:

   | Variabel | Nilai |
   |---|---|
   | `CELERY_BROKER_URL` | `${{Redis.REDIS_URL}}` (reference ke service Redis) |
   | `STT_LLM_ENABLED` | `True` |
   | `GROQ_API_KEY` | dari [console.groq.com](https://console.groq.com) → API Keys (gratis) |
   | `ANTHROPIC_API_KEY` | dari [console.anthropic.com](https://console.anthropic.com) (untuk ringkasan) |

3. Redeploy. Cek log: harus muncul `[start.sh] STT_LLM_ENABLED aktif — menyalakan Celery worker`.

> Tanpa langkah ini app tetap jalan normal — logbook jatuh ke catatan manual
> (graceful degradation). `STT_PROVIDER=local` (faster-whisper) TIDAK
> direkomendasikan di Railway/Render: modelnya butuh RAM ~1–2GB.

### Opsi 2 — Render (gratis, tidur saat idle → cold start ~30 dtk)

1. [render.com](https://render.com) → **New → Web Service** → connect repo.
2. **Runtime:** Docker. **Dockerfile path:** `Dockerfile`. **Root:** root repo.
3. **New → PostgreSQL** (free) → salin **Internal Database URL** ke `DATABASE_URL`.
4. Isi env var dari tabel di atas.
5. **Build/Start:** Docker sudah menjalankan gunicorn. Untuk migrasi, tambah
   di Render "Pre-Deploy Command": `python manage.py migrate && python manage.py seed_admin`.
6. Domain: `https://<nama>.onrender.com`.

> ⚠️ Render free: PostgreSQL gratis kedaluwarsa ~30–90 hari, dan service tidur
> saat idle (request pertama lambat). Untuk demo: buka duluan agar "bangun"
> sebelum dosen mengakses.

### Opsi 3 — Cloudflare Tunnel (GRATIS, tapi PC harus nyala)

Untuk review sesekali tanpa deploy beneran. Backend jalan di komputermu,
diekspos ke URL publik. **Backend mati kalau komputer mati.**

```bash
# 1. Jalankan Django lokal (biarkan hidup)
cd backend && python manage.py runserver 0.0.0.0:8000

# 2. Di terminal lain, jalankan tunnel
cloudflared tunnel --url http://localhost:8000
```

Cloudflare memberi URL acak `https://xxxx.trycloudflare.com`. Pakai URL itu
sebagai `VITE_API_URL` frontend. Karena beda domain dari `pages.dev`, tetap
butuh `COOKIE_SAMESITE=None` (jalankan Django dengan settings yang sesuai).

---

## Bagian B — Deploy Frontend (Cloudflare Pages)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages →
   Create → Pages → Connect to Git** → pilih repo.
2. Setelan build:

   | Field | Nilai |
   |-------|-------|
   | **Root directory** | `frontend` |
   | **Framework preset** | Vite |
   | **Build command** | `npm run build` |
   | **Build output directory** | `dist` |

3. **Environment variables** (Settings → Environment variables → Production):

   | Variable | Nilai |
   |----------|-------|
   | `VITE_API_URL` | URL backend, mis. `https://temudosen.up.railway.app` (tanpa `/` di akhir) |

4. Deploy. URL frontend: `https://<nama>.pages.dev`.

> File `frontend/public/_redirects` sudah ada → menangani SPA routing (deep link
> tidak 404). Tidak perlu diubah.

---

## Bagian C — Menyambungkan keduanya

Karena login pakai **session cookie + CSRF**, konfigurasi domain menentukan
apakah cookie login bisa terkirim.

### Aturan cookie (PENTING)

| Topologi domain | Setting backend |
|-----------------|-----------------|
| Frontend `*.pages.dev` + backend domain lain (**cross-site**) | `COOKIE_SAMESITE=None` (Secure otomatis True) |
| `app.temudosen.com` + `api.temudosen.com` (**same-site**) | biarkan default `Lax` — **lebih andal** |

> Rekomendasi jangka panjang: beli 1 domain, taruh frontend di `app.` dan
> backend di `api.` (subdomain yang sama) → `SameSite=Lax` cukup, lebih tahan
> pemblokiran third-party cookie oleh browser.

### Checklist saling-nyambung

- [ ] Backend online & domainnya ada di `ALLOWED_HOSTS`
- [ ] `CORS_ALLOWED_ORIGINS` backend = URL frontend Pages (persis, dengan `https://`)
- [ ] `COOKIE_SAMESITE=None` (jika cross-site `pages.dev`)
- [ ] `VITE_API_URL` frontend = URL backend (tanpa trailing slash) → **rebuild Pages** setelah diubah
- [ ] `migrate` + `seed_admin` sudah dijalankan di backend
- [ ] Buka frontend → coba login akun demo (lihat `DEMO_ACCOUNTS.md`)

---

## Catatan penting (jangan terlewat)

- **File upload bersifat sementara di Railway/Render.** Filesystem mereka
  ephemeral — PDF yang di-upload HILANG saat redeploy. Untuk produksi nyata,
  arahkan `MEDIA_ROOT`/storage ke object storage (mis. Cloudflare R2/S3).
  Untuk review singkat, tidak masalah.
- **Fitur STT/LLM (`STT_LLM_ENABLED=True`) butuh Redis + worker Celery.** Kalau
  tidak dipakai untuk review, biarkan `False` agar deploy lebih sederhana.
- **Static file admin Django** tidak dilayani gunicorn secara default. API tetap
  jalan normal; hanya tampilan `/admin/` yang mungkin tanpa CSS. Tidak
  memengaruhi app utama.
- Setelah mengubah env var apa pun di Pages, **wajib rebuild** (env di-bake saat
  build, bukan runtime).

---

## Ringkasan pilihan

| Kebutuhan | Backend | Frontend |
|-----------|---------|----------|
| Dosen buka kapan saja, PC boleh mati | **Railway** (mulus) / **Render** (gratis) | Cloudflare Pages |
| Review terjadwal, PC kamu nyala saat itu | **Cloudflare Tunnel** | Cloudflare Pages (atau `vite` lokal + tunnel) |
