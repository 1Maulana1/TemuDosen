# Dokumentasi Tim — TemuDosen

Satu folder berisi semua yang perlu dilihat tim: cara deploy + semua masalah/temuan
yang pernah tercatat. Sebelumnya tersebar di root repo dan `.planning/` — sekarang
dikumpulkan di sini.

## Isi

| File | Isinya |
|------|--------|
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Cara deploy frontend (Cloudflare Pages) + backend (Railway/Render/Tunnel), env var, aturan cookie cross-domain |
| [`BACKLOG.md`](BACKLOG.md) | Semua gap/ide yang pernah ditemukan (audit 2026-07-07) — mayoritas sudah **✅ RESOLVED** (ada catatan di bagian atas file), sisa terbuka: `U7`, `N-04`, `S3` (semua prioritas rendah, sengaja belum dikerjakan) |
| [`UI-REVIEW.md`](UI-REVIEW.md) | Temuan review UI langsung dari browser (2026-07-07) — U1–U8, sebagian sudah diperbaiki (ditandai di file) |
| [`AUDIT.md`](AUDIT.md) | Hasil audit penuh 8 fase (requirement vs implementasi) |

## Status singkat (per catatan terakhir)

- **Semua 8 fase project selesai.** Backend 337/337 test, frontend 63/63 test hijau.
- **Milestone v1 final** — v2 (P2: penjadwalan sidang multi-penguji, dan fitur v2
  lain) sengaja **tidak** dikerjakan, di luar scope.
- Sisa item terbuka semuanya **prioritas rendah**, tidak memblokir apa pun:
  - `U7` — klik tombol "Masuk" sebelum JS termuat tidak ada feedback
  - `N-04` — fallback estimasi waktu masih kasar
  - `S3` — belum ada guard concurrency level-DB di approve/complete

## Status project & requirement yang selalu akurat (live, bukan snapshot)

- `.planning/STATE.md` — status per-fase terkini
- `.planning/REQUIREMENTS.md` — traceability requirement → kode
