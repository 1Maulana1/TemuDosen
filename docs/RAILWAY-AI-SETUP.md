# Setup Pipeline AI di Railway (untuk pemegang akun Railway)

> Panduan mengaktifkan fitur **transkripsi otomatis (Whisper)** + **ringkasan AI
> (Llama)** di deployment Railway TemuDosen. Kode sudah ada di GitHub (`master`)
> — kamu **tidak perlu mengubah kode apa pun**, cukup setting di dashboard.
> Total waktu: ±10 menit. Biaya: **Rp 0** (Groq free tier).

Arsitekturnya setelah aktif:

```
Rekaman sesi → Groq Whisper (transkripsi) → Groq Llama 3.3 70B (ringkasan) → Review dosen
```

---

## A. Pastikan backend sudah redeploy kode terbaru

1. Buka project TemuDosen di [railway.app](https://railway.app)
2. Klik service backend → tab **Deployments**
3. Harus ada deployment dari commit `4868727` _"feat(llm): add Groq (llama-3.3-70b)…"_
   atau yang lebih baru. Kalau belum ada, klik **⋮** → **Redeploy**.

## B. Buat API key Groq (gratis)

1. Daftar/login di [console.groq.com](https://console.groq.com)
2. Menu **API Keys** → **Create API Key** → salin key-nya (`gsk_...`)
   — hanya muncul sekali, simpan dulu di tempat aman.

## C. Tambah Redis

1. Di canvas project Railway, klik **+ New** → **Database** → **Add Redis**
2. Tunggu sampai service Redis muncul dan statusnya hijau

> Redis dipakai sebagai broker Celery — antrian tugas transkripsi/ringkasan.

## D. Tambah env var di service backend

Klik service backend → tab **Variables** → **+ New Variable**, isi satu per satu:

| Nama | Nilai |
|---|---|
| `CELERY_BROKER_URL` | `${{Redis.REDIS_URL}}` |
| `STT_LLM_ENABLED` | `True` |
| `GROQ_API_KEY` | key `gsk_...` dari langkah B |
| `LLM_INPUT_RATE_USD_PER_MTOK` | `0` |
| `LLM_OUTPUT_RATE_USD_PER_MTOK` | `0` |

Catatan:

- `CELERY_BROKER_URL`: ketik nilainya **persis** `${{Redis.REDIS_URL}}` —
  Railway otomatis mengubahnya jadi reference ke service Redis. Kalau nama
  service Redis di canvas-mu bukan `Redis` (mis. `Redis-abc`), sesuaikan:
  `${{Redis-abc.REDIS_URL}}`.
- Dua variabel tarif dinolkan supaya estimasi biaya di UI admin akurat
  (Groq free tier = gratis; default tarifnya mengasumsikan Claude berbayar).

## E. Deploy & verifikasi

1. Klik banner **Apply changes / Deploy** yang muncul setelah variable disimpan.
   Kalau tidak muncul: tab **Deployments** → **⋮** di deployment teratas → **Redeploy**.
2. Tab **Deployments** → klik deployment terbaru → **View Logs** → cari baris:

   ```
   [start.sh] STT_LLM_ENABLED aktif — menyalakan Celery worker (queue stt,llm)
   ```

3. Baris itu muncul → **pipeline AI sudah hidup di produksi.** 🎉

## Troubleshooting

| Gejala | Penyebab umum |
|---|---|
| Log: `PERINGATAN: ... CELERY_BROKER_URL kosong` | Variable `CELERY_BROKER_URL` belum diset / reference Redis salah nama |
| Worker nyala tapi transkripsi tidak jalan | `GROQ_API_KEY` salah/kosong — cek log worker untuk error 401 |
| Tidak ada baris `[start.sh]` sama sekali | Deployment masih memakai kode lama — pastikan commit ≥ `b781c0a` dan redeploy |
| App error saat boot | Cek `View Logs`; app didesain tetap jalan walau pipeline mati (fallback catatan manual) — error boot biasanya bukan dari fitur ini |

> Tanpa setup ini pun web tetap jalan normal — logbook hanya jatuh ke mode
> catatan manual. Detail teknis lain: [DEPLOYMENT.md](DEPLOYMENT.md) bagian
> "Mengaktifkan pipeline STT/LLM di Railway".
