# UI Review (Live, Kritis) — 2026-07-07

Metode: aplikasi dijalankan sungguhan (Django :8000 + Vite :5173, DB di-seed kaya:
sesi DONE + logbook approved + saran ± catatan + antrean WAITING + notifikasi),
lalu **keempat role di-login dan dijelajahi** via preview browser (snapshot DOM,
network, interaksi klik/isi form). Screenshot renderer hang, jadi penilaian
murni-visual (presisi warna/spacing) terbatas — struktur, konten, alur, dan
perilaku diverifikasi penuh.

---

## 🔴 U0 — TEMUAN KRITIS (infra, bukan kode UI): dev server melayani salinan BASI

Saat review dimulai, halaman yang tampil adalah **kode lama** ("Notifikasi segera
hadir", "Progres Skripsi: Data contoh"). Penyebab: `E:\Proyek S4\.claude\launch.json`
(root luar) menunjuk ke **salinan luar yang usang** (`E:\Proyek S4\frontend` +
`backend`, tertinggal di ~dd3b225) — bukan `TemuDosen\`. Preview tool memakai file
itu.

**Implikasi penting:** pengujian manual apa pun yang dilakukan hari-hari ini lewat
server dari folder luar (termasuk kemungkinan cek mic tadi) **menguji kode lama**,
bukan hasil kerja terbaru.

**Sudah diperbaiki:** `launch.json` root luar kini menunjuk `TemuDosen\backend` +
`TemuDosen\frontend`. **Rekomendasi lanjutan:** hapus/arsipkan salinan luar
(`E:\Proyek S4\frontend`, `backend`) agar foot-gun ini hilang permanen — satu-satunya
sumber kebenaran adalah `TemuDosen\`.

---

## Temuan UI (dari penjelajahan kode TERBARU)

### U1 — 🟠 Hapus saran: tanpa konfirmasi + boleh pada item yang sudah selesai
Di `LecturerSessionDetail`, tombol hapus saran langsung menghapus **tanpa dialog
konfirmasi** (satu salah-klik = hilang permanen). Lebih serius: edit/hapus tetap
tersedia untuk item yang **sudah ditindaklanjuti mahasiswa** — menghapusnya ikut
melenyapkan catatan/bukti mahasiswa. Saran: modal konfirmasi + sembunyikan (atau
kunci) edit/hapus setelah `is_completed`.

### U2 — 🟡 CSV ekspor logbook: kolom Tanggal = timestamp ISO mentah
`LogbookExportView` menulis `2026-07-06T09:49:30.781997+00:00` apa adanya — jelek
dan menyulitkan upload manual ke logbook kampus. Format ke tanggal/waktu lokal
(mis. `06-07-2026 16:49 WIB`).

### U3 — ✅ DIPERBAIKI SAAT REVIEW: placeholder "-" ter-escape jadi `'-`
Guard CSV-injection (S1) ikut meng-escape placeholder `-` sehingga sel kosong
tampil `'-` di ekspor KJ. Diperbaiki: `-` tunggal dikecualikan (bukan formula).
12 test export tetap hijau.

### U4 — 🟡 NotificationBell tidak pernah refresh sendiri
Bell fetch hanya saat mount & saat dibuka. Notifikasi yang datang ketika user diam
di halaman tak akan muncul sampai reload. Halaman antrean sudah punya pola
auto-refresh 30 detik — bell bisa meniru (polling ringan `unread_count`).

### U5 — 🟡 Pesan throttle login (429) kemungkinan tampil dalam bahasa Inggris
Rate-limit S4 mengembalikan pesan DRF default ("Request was throttled…") yang
diteruskan mentah ke UI berbahasa Indonesia. (Inferensi kode — belum dipicu live.)
Saran: petakan status 429 ke copy Indonesia di `LoginPage`.

### U6 — 💡 Footer "Tentang / Panduan / Kontak" mati (konfirmasi live)
Sudah tercatat sebagai G8 di BACKLOG; terlihat langsung di dashboard mahasiswa.

### U7 — 💡 Klik "Masuk" sebelum JS termuat = tertelan tanpa feedback
Terjadi nyata saat review: pada muatan pertama (module graph Vite masih loading),
klik submit tidak melakukan apa-apa dan tanpa indikator. Di produksi (bundle
ter-build) jendelanya jauh lebih kecil. Nice-to-have: disable tombol sampai
hidrasi siap.

### U8 — 💡 Ikon buka-sesi (menu_book) tampil juga untuk sesi MENUNGGU
Mahasiswa yang mengklik dibawa ke halaman "Ringkasan belum tersedia" (ada state
menunggu + saran, jadi tidak rusak) — tapi ekspektasinya jadi ambigu. Saran: title
dinamis ("Lihat sesi (menunggu)") atau tampilkan hanya setelah sesi berjalan/DONE.

---

## ✅ Terverifikasi BAIK (live, kode terbaru)

- **Mahasiswa**: bell + badge (2) + dropdown + isi benar; Progres Skripsi nyata &
  interaktif (klik Bab II → 0%→20%, PATCH terkirim); status riwayat akurat
  (MENUNGGU/SELESAI/DISETUJUI dari status Session); aksi visibility + menu_book;
  kartu antrean aktif (posisi, ±menit, batalkan); detail sesi: ringkasan
  terstruktur (Saran Dosen / Area Perbaikan), saran + catatan bukti, Tandai
  Selesai + textarea catatan; halaman Antrean (posisi, estimasi WIB, refresh).
- **Dosen**: dashboard (stat, daftar tunggu, Mulai & Rekam); nav 6 item termasuk
  Saran; halaman Saran agregat (kepatuhan 50%, kartu per-advisee, catatan
  mahasiswa, link Lihat sesi); detail sesi: chip status logbook kampus + tautan
  unduh CSV/PDF **berfungsi nyata** (200, text/csv & application/pdf), saran
  dengan edit/hapus + form tambah.
- **Admin**: kartu "Logbook Kampus" kini membaca status campus yang benar; kartu
  konfigurasi campus (provider/URL/token/simpan) tampil; statistik STT/AI; kartu
  Emergency Cancel memakai select + tombol (bukan prompt); persetujuan pengguna.
- **Ketua Jurusan**: stats periode (toggle Minggu/Bulan/Semester), beban per dosen
  (bar vs kuota), tabel kepatuhan per mahasiswa/dosen, ekspor CSV berisi kolom
  "Ringkasan Disetujui" (200), catatan akreditasi.
- **Mobile 375px**: tidak ada overflow horizontal; bottom-nav tampil.
- **Empty states** konsisten di semua halaman yang dilihat; konsol bersih.

## Keterbatasan review
- Screenshot renderer hang → penilaian visual presisi (warna kontras, spacing px)
  tidak dilakukan; struktur/alur diverifikasi via accessibility snapshot + inspect.
- Alur rekam mic & video call (Jitsi) tidak diuji live di sesi ini (butuh
  perangkat + interaksi manusia); mic sudah dikonfirmasi user 2026-07-07 — tapi
  catat implikasi U0: pastikan cek itu dilakukan terhadap server TemuDosen, bukan
  salinan luar.
