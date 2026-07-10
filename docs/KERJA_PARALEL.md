# Panduan Kerja Paralel — Untuk Claude & Anggota Tim

> **Baca ini lebih dulu sebelum mengerjakan apa pun.**
> Dokumen ini menjelaskan **cara 4 orang mengerjakan TemuDosen secara bersamaan (paralel) tanpa saling menunggu dan tanpa menimpa pekerjaan satu sama lain.**
>
> Jika kamu adalah **Claude** yang membantu salah satu anggota tim: tugasmu adalah membuat anggota itu bisa bekerja **sekarang juga**, tanpa bergantung pada kode anggota lain yang belum jadi. Caranya dijelaskan di bawah.

---

## 0. Prinsip Inti (WAJIB paham)

Pekerjaan bisa paralel kalau setiap orang **bekerja melawan KONTRAK, bukan melawan IMPLEMENTASI orang lain.**

- **Kontrak** = nama fungsi, parameter, tipe data kembalian, dan field model. Disepakati di awal dan ditulis di [`INTERFACES.md`](INTERFACES.md).
- **Implementasi** = isi/daging dari fungsi tersebut. Boleh dikerjakan kapan saja oleh pemiliknya.

> Selama **kontrak tidak berubah**, isi boleh berubah bebas tanpa merusak kode orang lain.

Tiga aturan yang membuat ini bekerja:

1. **Sepakati kontrak dulu** → tulis di `INTERFACES.md`.
2. **Sediakan STUB** untuk apa pun yang belum jadi → orang lain tidak perlu menunggu.
3. **Satu file = satu pemilik** + test pakai **mock** → tidak ada yang saling edit, tidak ada yang saling tunggu.

---

## 1. Apa itu STUB dan kenapa penting

**Stub** adalah versi kosong/palsu dari sebuah fungsi atau model: signature-nya sudah benar, tapi isinya masih nilai sementara.

Contoh — Person D belum selesai membuat logika kuota, tapi Person C butuh fungsinya **sekarang**. Person D cukup commit stub ini di hari pertama:

```python
# apps/queue/quota.py — versi STUB (di-commit lebih dulu)
def get_remaining_quota(lecturer, date) -> int:
    return 480  # TODO(D): ganti dengan logika kuota asli

def assign_queue_number(lecturer, date) -> int:
    return 1    # TODO(D): ganti dengan logika nomor antrian asli
```

Akibatnya:

- Person C **langsung bisa** `from apps.queue.quota import get_remaining_quota, assign_queue_number` dan kodenya jalan.
- Saat Person D mengganti isi fungsi dengan logika asli, **kode Person C tidak perlu diubah sama sekali**, karena nama + parameter + tipe kembalian tetap sama.

Itulah arti "dikerjakan bersamaan tetapi tidak saling berhubungan".

---

## 2. "Hari 0" — Sesi Skeleton Bersama (lakukan SEKALI di awal)

Sebelum kerja masing-masing, tim duduk bareng (cukup 1–2 jam) dan membuat **semua kerangka kosong**, lalu commit ke `main`. Setelah ini, **tidak ada lagi yang perlu mengedit file milik orang lain.**

Yang dibuat di Hari 0:

| Item | File | Penjelasan |
|------|------|------------|
| Model `QueueSlot` lengkap | `apps/queue/models.py` | Semua field sesuai `INTERFACES.md`, langsung `makemigrations` + `migrate` + commit. C & D dua-duanya butuh ini. |
| Stub `quota.py` | `apps/queue/quota.py` | Dua fungsi stub seperti contoh di atas. |
| Field `rejection_notes` | `apps/submissions/models.py` | Ditambahkan **sekali saja**, langsung migrate + commit. Jangan ditunda. |
| App `queue` terdaftar | `config/settings/base.py` | `'apps.queue'` masuk `INSTALLED_APPS`. |
| Route kosong | `apps/queue/urls.py`, `config/urls.py` | `urlpatterns = []` dulu tidak apa-apa, yang penting modul-nya bisa di-import. |

Setelah skeleton ini di `main`, setiap orang `git pull` lalu mulai mengisi **hanya file miliknya sendiri.**

> **Kenapa model & field dibuat duluan?** Karena model dan migrasi adalah hal yang paling sering bikin konflik kalau dikerjakan dua orang. Selesaikan di awal, bukan di tengah jalan.

---

## 3. Aturan Kepemilikan File (1 file = 1 pemilik)

Konflik git terjadi kalau dua orang mengedit baris yang sama di file yang sama. Hindari dengan kepemilikan jelas:

| Pemilik | File yang BOLEH diedit | Tidak boleh disentuh |
|---------|------------------------|----------------------|
| **A — Auth** | `apps/accounts/views.py`, `serializers.py`, `tests/` | file milik B/C/D |
| **B — Submission** | `apps/submissions/serializers.py`, `views.py`, `tests/` | `accounts/`, `queue/` |
| **C — Approval** | `apps/submissions/approval_views.py` (baru), `urls.py` | `submissions/views.py` (milik B) |
| **D — Queue** | `apps/queue/quota.py`, `views.py`, `serializers.py`, `urls.py` | `queue/models.py` (sudah final dari Hari 0) |

> Kalau kamu (Claude) merasa **harus** mengubah file milik orang lain → **JANGAN langsung edit.** Berhenti, beri tahu anggota tim untuk diskusi dulu, atau cari cara lain (mock/stub). Mengubah file orang lain adalah penyebab nomor satu pekerjaan paralel jadi rusak.

---

## 4. Cara Verifikasi Sendiri Tanpa Menunggu Orang Lain (Mock)

Setiap orang membuktikan kodenya benar **hari ini juga**, tanpa butuh kode anggota lain selesai. Caranya: pakai **mock** untuk menggantikan fungsi orang lain saat test.

```python
# Test Person C — buktikan approve membuat QueueSlot,
# TANPA butuh logika asli Person D.
from unittest.mock import patch

@patch('apps.submissions.approval_views.get_remaining_quota', return_value=480)
@patch('apps.submissions.approval_views.assign_queue_number', return_value=1)
def test_approve_membuat_queue_slot(self, mock_num, mock_quota):
    # ... login sebagai dosen, panggil endpoint approve ...
    # ... assert QueueSlot terbuat dengan queue_number=1 ...
```

Dengan mock, test Person C lulus walau Person D belum menulis logika asli. Saat D selesai, test integrasi akhir tinggal melepas mock-nya.

---

## 5. Instruksi Khusus untuk Claude (per anggota tim)

Saat kamu (Claude) membantu seorang anggota, ikuti langkah ini:

1. **Identifikasi peran anggota** (A/B/C/D) — lihat tabel kepemilikan di atas dan di [`PANDUAN_TIM.md`](PANDUAN_TIM.md).
2. **Baca [`INTERFACES.md`](INTERFACES.md)** untuk tahu kontrak yang sudah disepakati. Itu satu-satunya sumber kebenaran soal nama field & fungsi.
3. **Kerjakan HANYA file milik anggota itu.** Kalau butuh sesuatu dari anggota lain yang belum jadi → **buat/gunakan stub**, jangan menunggu.
4. **Kalau kontrak perlu berubah** (mis. butuh field baru di model orang lain) → **JANGAN ubah diam-diam.** Sampaikan ke anggota bahwa ini harus didiskusikan dan `INTERFACES.md` harus diperbarui lebih dulu.
5. **Tulis test dengan mock** supaya pekerjaan bisa diverifikasi mandiri.
6. **Commit kecil & sering**, hanya file yang relevan (`git add <file>`, bukan `git add .`).

---

## 6. Alur Lengkap (gambaran besar)

```
HARI 0 (bersama):  Sepakati INTERFACES.md
                   → buat semua skeleton: model QueueSlot, stub quota.py,
                     field rejection_notes → migrate → commit ke main
                            │
        ┌──────────┬────────┴────────┬──────────┐
   Person A    Person B         Person C    Person D     ← SEMUA jalan Hari 1, paralel
   isi auth    isi submission   isi approve  isi quota
   (mock B)    (mock C)         (stub D)     (data dummy)
        └──────────┴────────┬────────┴──────────┘
                   INTEGRASI: ganti stub → kode asli.
                   Kontrak tidak berubah, jadi tidak ada yang rusak.
```

**Sebelum (sekuensial — lambat):** `A → B → C → D` (tiap orang menunggu yang sebelumnya).

**Sesudah (paralel — cepat):** semua mulai Hari 1, dihubungkan oleh kontrak + stub.

---

## 7. Checklist Cepat Sebelum Mulai Kerja

- [ ] Sudah `git pull` skeleton Hari 0 dari `main`?
- [ ] Sudah `python manage.py migrate`?
- [ ] Sudah baca `INTERFACES.md` untuk kontrak yang kupakai?
- [ ] Aku hanya mengedit file milikku sendiri?
- [ ] Untuk hal milik orang lain yang belum jadi — aku pakai stub/mock, bukan menunggu?
- [ ] Test-ku lulus secara mandiri (pakai mock kalau perlu)?

---

*Dokumen ini melengkapi [`PANDUAN_TIM.md`](PANDUAN_TIM.md) (pembagian tugas detail) dan [`INTERFACES.md`](INTERFACES.md) (kontrak antar anggota). Kalau ada konflik, `INTERFACES.md` adalah sumber kebenaran untuk kontrak.*
