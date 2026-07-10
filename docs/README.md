# Dokumentasi Tim — TemuDosen

Satu folder berisi semua yang perlu dilihat tim: cara deploy + semua masalah/temuan
yang pernah tercatat. Sebelumnya tersebar di root repo dan `.planning/` — sekarang
dikumpulkan di sini.

## Isi

| File | Isinya |
|------|--------|
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Cara deploy frontend (Cloudflare Pages) + backend (Railway/Render/Tunnel), env var, aturan cookie cross-domain |
| [`HOSTING-MATRIX.md`](HOSTING-MATRIX.md) | Perbandingan **semua kombinasi** hosting frontend+backend (Cloudflare Pages/Vercel/Netlify/same-origin × Railway/Render/Tunnel/Supabase) — dipakai kalau butuh pilih opsi sesuai situasi (demo cepat vs jangka panjang), bukan tutorial langkah-demi-langkah (itu ada di `DEPLOYMENT.md`) |
| [`BACKLOG.md`](BACKLOG.md) | Semua gap/ide yang pernah ditemukan (audit 2026-07-07) — mayoritas sudah **✅ RESOLVED** (ada catatan di bagian atas file), sisa terbuka: `U7`, `N-04`, `S3` (semua prioritas rendah, sengaja belum dikerjakan) |
| [`UI-REVIEW.md`](UI-REVIEW.md) | Temuan review UI langsung dari browser (2026-07-07) — U1–U8, sebagian sudah diperbaiki (ditandai di file) |
| [`AUDIT.md`](AUDIT.md) | Hasil audit penuh 8 fase (requirement vs implementasi) |

## Status singkat (per catatan terakhir, 2026-07-10)

- **Semua 8 fase project selesai.** Backend 344/344 test, frontend 64/64 test hijau
  (dijalankan nyata, bukan hitung statis — lihat catatan lingkungan di bawah).
- **Milestone v1 final** — v2 (P2: penjadwalan sidang multi-penguji, dan fitur v2
  lain) sengaja **tidak** dikerjakan, di luar scope.
- Sisa item terbuka semuanya **prioritas rendah**, tidak memblokir apa pun:
  - `U7` — klik tombol "Masuk" sebelum JS termuat tidak ada feedback
  - `N-04` — fallback estimasi waktu masih kasar
  - `S3` — belum ada guard concurrency level-DB di approve/complete
- **Progres Skripsi mahasiswa sekarang read-only** (sejak commit `fddb673`,
  2026-07-08) — bab ditandai oleh dosen pembimbing, bukan mahasiswa sendiri lagi.
  Dokumen lama (mis. catatan audit T2) yang menyebut "mahasiswa menandai sendiri"
  sudah tidak berlaku.
- **`VideoProvider`/Jitsi (panggilan video sesi online) sudah live-wired**, bukan
  kode mati — dipakai di dashboard/antrean dosen & antrean mahasiswa, ter-gate oleh
  `method === 'online'`.

### Catatan lingkungan Windows (penting untuk kontributor baru)

`requirements.txt` mem-pin `python-magic==0.4.27` (varian Unix). Di venv Windows,
`import magic` (dipakai validasi upload PDF, TRIAGE-01) bisa **crash/hang** karena
`libmagic` yang kompatibel tidak ada — try/except di kode tidak bisa menangkap
access-violation level-OS ini. Kalau test backend menggantung tanpa output di
Windows, ini kemungkinan besar penyebabnya. Perbaikan lokal: `pip uninstall
python-magic && pip install python-magic-bin==0.4.14` di venv masing-masing.

## Status project & requirement yang selalu akurat (live, bukan snapshot)

- `.planning/STATE.md` — status per-fase terkini
- `.planning/REQUIREMENTS.md` — traceability requirement → kode
