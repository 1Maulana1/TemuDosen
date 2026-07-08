# Demo Accounts — TemuDosen

Akun test untuk development & testing lokal. **Jangan gunakan di production!**

> **Semua akun demo memakai satu password yang sama: `demo123`** (dosen, mahasiswa, ketua jurusan).

## Cara Setup

Jalankan command berikut untuk membuat akun demo:

```bash
cd backend
python manage.py seed_dev
```

Untuk mengisi **data bimbingan demo** (pengajuan, antrean, sesi berlangsung,
sesi selesai + logbook & saran) agar dashboard dosen dan ketua jurusan terlihat
berisi, jalankan juga:

```bash
python manage.py seed_bimbingan
```

`seed_bimbingan` idempoten per mahasiswa (mahasiswa yang sudah punya pengajuan
dilewati), jadi aman dijalankan berulang. Skenario yang dibuat: pending, revisi,
menunggu di antrean, sedang berlangsung, dan selesai (dengan logbook disetujui +
saran/tindak lanjut).

## Test Accounts

Password semua akun di bawah: **`demo123`**

### 🎓 Mahasiswa

| Email | NIM | Pembimbing | Status |
|-------|-----|-----------|--------|
| `arifin@students.uii.ac.id` | 20210001 | Dr. Siti Rahayu | ✅ Approved |
| `dewi@students.uii.ac.id` | 20210002 | Dr. Budi Santoso | ✅ Approved |
| `rizky@students.uii.ac.id` | 20210003 | Dr. Siti Rahayu | ✅ Approved |
| `putri@students.uii.ac.id` | 20210004 | Dr. Rina Wijaya | ✅ Approved |
| `fajar@students.uii.ac.id` | 20210005 | Dr. Budi Santoso | ✅ Approved |
| `siska@students.uii.ac.id` | 20210006 | Agus Pratama | ✅ Approved |
| `andi@students.uii.ac.id` | 20210007 | Dr. Maya Sari | ✅ Approved |
| `nabila@students.uii.ac.id` | 20210008 | Dr. Rina Wijaya | ✅ Approved |

### 👨‍🏫 Dosen

| Email | NIDN | Status |
|-------|------|--------|
| `siti.rahayu@uii.ac.id` | 0012345678 | ✅ Approved |
| `budi.santoso@uii.ac.id` | 0087654321 | ✅ Approved |
| `rina.wijaya@uii.ac.id` | 0011223344 | ✅ Approved |
| `agus.pratama@uii.ac.id` | 0055667788 | ✅ Approved |
| `maya.sari@uii.ac.id` | 0099887766 | ✅ Approved |

### 👔 Ketua Jurusan

| Email | Nama | Status |
|-------|------|--------|
| `ketuajurusan@uii.ac.id` | Prof. Ahmad Fauzi | ✅ Approved |
| `kaprodi.ti@uii.ac.id` | Dr. Hendra Gunawan, M.Kom | ✅ Approved |

### 🔐 Admin

| Email | Status | Source |
|-------|--------|--------|
| `ketuajurusan@temudosen.ac.id` | ✅ Approved | `seed_admin.py` |

> **Note:** Admin account credentials ditetapkan di `.env` (lihat `ADMIN_DEFAULT_PASSWORD`)

## Workflow Testing

### 1️⃣ Mahasiswa: Ajukan Bimbingan
```
Login sebagai: arifin@students.uii.ac.id / demo123
→ Halaman: /mahasiswa/
→ Tombol: Ajukan Bimbingan
→ Isi: Pilih gejala + upload draft PDF
```

### 2️⃣ Dosen: Approve/Reject Pengajuan
```
Login sebagai: siti.rahayu@uii.ac.id / demo123
→ Halaman: /dosen/requests
→ Aksi: Approve dengan durasi estimasi, atau Reject dengan catatan
```

### 3️⃣ Mahasiswa: Monitor Antrian
```
Login sebagai: arifin@students.uii.ac.id / demo123
→ Halaman: /mahasiswa/queue
→ Lihat: Nomor antrian, estimasi tunggu, info dosen
```

### 4️⃣ Dosen: Lihat Antrian Hari Ini
```
Login sebagai: siti.rahayu@uii.ac.id / demo123
→ Halaman: /dosen/queue
→ Lihat: Mahasiswa menunggu, status sesi, tombol Selesai
```

### 5️⃣ Ketua Jurusan: Dashboard Statistik
```
Login sebagai: ketuajurusan@uii.ac.id / demo123
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
