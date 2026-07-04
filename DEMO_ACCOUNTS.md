# Demo Accounts — TemuDosen

Akun test untuk development & testing lokal. **Jangan gunakan di production!**

## Cara Setup

Jalankan command berikut untuk membuat akun demo:

```bash
cd backend
python manage.py seed_dev
```

## Test Accounts

### 🎓 Mahasiswa

| Email | Password | NIM | Pembimbing | Status |
|-------|----------|-----|-----------|--------|
| `arifin@students.uii.ac.id` | `mhs123` | 20210001 | Dr. Siti Rahayu | ✅ Approved |
| `dewi@students.uii.ac.id` | `mhs123` | 20210002 | Dr. Budi Santoso | ✅ Approved |

### 👨‍🏫 Dosen

| Email | Password | NIDN | Status |
|-------|----------|------|--------|
| `siti.rahayu@uii.ac.id` | `dosen123` | 0012345678 | ✅ Approved |
| `budi.santoso@uii.ac.id` | `dosen123` | 0087654321 | ✅ Approved |

### 👔 Ketua Jurusan

| Email | Password | Status |
|-------|----------|--------|
| `ketuajurusan@uii.ac.id` | `ketuajurusan123` | ✅ Approved |

### 🔐 Admin

| Email | Status | Source |
|-------|--------|--------|
| `ketuajurusan@temudosen.ac.id` | ✅ Approved | `seed_admin.py` |

> **Note:** Admin account credentials ditetapkan di `.env` (lihat `ADMIN_DEFAULT_PASSWORD`)

## Workflow Testing

### 1️⃣ Mahasiswa: Ajukan Bimbingan
```
Login sebagai: arifin@students.uii.ac.id / mhs123
→ Halaman: /mahasiswa/
→ Tombol: Ajukan Bimbingan
→ Isi: Pilih gejala + upload draft PDF
```

### 2️⃣ Dosen: Approve/Reject Pengajuan
```
Login sebagai: siti.rahayu@uii.ac.id / dosen123
→ Halaman: /dosen/requests
→ Aksi: Approve dengan durasi estimasi, atau Reject dengan catatan
```

### 3️⃣ Mahasiswa: Monitor Antrian
```
Login sebagai: arifin@students.uii.ac.id / mhs123
→ Halaman: /mahasiswa/queue
→ Lihat: Nomor antrian, estimasi tunggu, info dosen
```

### 4️⃣ Dosen: Lihat Antrian Hari Ini
```
Login sebagai: siti.rahayu@uii.ac.id / dosen123
→ Halaman: /dosen/queue
→ Lihat: Mahasiswa menunggu, status sesi, tombol Selesai
```

### 5️⃣ Ketua Jurusan: Dashboard Statistik
```
Login sebagai: ketuajurusan@uii.ac.id / ketuajurusan123
→ Halaman: /ketua-jurusan/
→ Lihat: Rekap beban kerja dosen, stats sesi
```

## Database

Akun-akun ini dibuat di **SQLite (dev)** atau **PostgreSQL** tergantung environment:

- **Development**: `backend/db.sqlite3`
- **Docker**: Database otomatis di-seed saat startup

Untuk reset database:
```bash
python manage.py flush
python manage.py migrate
python manage.py seed_dev
```

## Links

- **Source code**: `backend/apps/accounts/management/commands/seed_dev.py`
- **Settings**: `backend/config/settings/*.py` (DATABASES, INSTALLED_APPS, dll)
- **Documentation lengkap**: Baca `README.md` atau `PANDUAN_TIM.md`
