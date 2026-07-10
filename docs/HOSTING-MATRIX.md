# Matriks Kombinasi Hosting — TemuDosen

Dokumen ini membandingkan **semua kombinasi frontend host + backend host**
yang masuk akal untuk TemuDosen, supaya bisa dipilih sesuai situasi (demo
sekali, demo berulang, dipakai tim jangka panjang) tanpa harus baca ulang
semua opsi dari nol tiap kali.

Untuk **langkah-langkah setup** satu opsi yang sudah dipilih, lihat
[`DEPLOYMENT.md`](DEPLOYMENT.md) — dokumen itu tutorial step-by-step;
dokumen ini murni perbandingan.

## Cara baca dokumen ini

- **Frontend host** — tempat file statis hasil `npm run build` (folder `dist/`) disajikan.
- **Backend compute host** — tempat Django/gunicorn jalan terus-menerus (proses yang harus tetap hidup untuk melayani API).
- **Database host** — tempat PostgreSQL jalan. Bisa bundled dengan compute host (mis. Railway menyediakan keduanya), bisa terpisah (mis. Supabase Postgres dipakai bersama compute host Railway/Render).
- **Keep-alive strategy** — opsional, hanya relevan untuk backend yang "tidur" saat idle (Render free).

Kombinasi penuh = **frontend** × **(compute + database)** × **(keep-alive, kalau perlu)**. Pilihan frontend memengaruhi topologi cookie/CORS — lihat [bagian 5](#5-aturan-lintas-kombinasi-cookiecors-tergantung-topologi-domain).

---

## 1. Matriks opsi frontend

### (i) Cloudflare Pages
- **Biaya**: Gratis.
- **Cold start / delay**: Nyaris instan — file statis di CDN edge global.
- **Setup**: Sudah didokumentasikan penuh di [DEPLOYMENT.md Bagian B](DEPLOYMENT.md#bagian-b--deploy-frontend-cloudflare-pages).
- **Custom domain & SSL**: Gratis, mudah (Cloudflare mengurus SSL otomatis).
- **Implikasi cookie/CORS**: Selalu domain terpisah dari backend (`*.pages.dev` atau domain custom) → **cross-site** kecuali backend juga ditaruh di subdomain domain yang sama.
- **Cocok untuk**: Semua skenario — pilihan default yang solid.

### (ii) Vercel
- **Biaya**: Gratis (hobby tier).
- **Cold start / delay**: Nyaris instan, CDN edge global — setara Cloudflare Pages.
- **Setup**: Import repo di [vercel.com](https://vercel.com) → Root Directory `frontend`, Framework Preset `Vite`, Build Command `npm run build`, Output Directory `dist`. Env var `VITE_API_URL` diisi sama seperti di DEPLOYMENT.md Bagian B.
- **Custom domain & SSL**: Gratis, mudah.
- **Implikasi cookie/CORS**: Sama seperti Cloudflare Pages — cross-site terhadap backend.
- **Cocok untuk**: Alternatif langsung kalau Cloudflare Pages tidak dipakai; sangat umum untuk proyek Vite/React, dokumentasi luas.

### (iii) Netlify
- **Biaya**: Gratis (starter tier).
- **Cold start / delay**: Nyaris instan.
- **Setup**: Import repo di [netlify.com](https://netlify.com) → Base directory `frontend`, Build command `npm run build`, Publish directory `frontend/dist`. Perlu file redirect SPA (`_redirects` — repo sudah punya di `frontend/public/_redirects`, format sama dipakai Netlify).
- **Custom domain & SSL**: Gratis, mudah.
- **Implikasi cookie/CORS**: Sama seperti Cloudflare Pages/Vercel — cross-site.
- **Cocok untuk**: Alternatif lain yang setara Cloudflare Pages/Vercel; pilih berdasarkan preferensi tim, bukan karena kelebihan teknis signifikan untuk app ini.

### (iv) Same-origin dengan backend
Django menyajikan `frontend/dist/` langsung (mis. via `whitenoise`), atau nginx sidecar di compute host yang sama menyajikan file statis + reverse-proxy API — frontend dan backend jadi **satu domain, satu deployment**.

- **Biaya**: Tidak ada biaya tambahan — nempel di backend host yang sudah dipilih (lihat bagian 2).
- **Cold start / delay**: Sama seperti backend host-nya (lihat bagian 2) — tidak ada lapisan tambahan.
- **Setup**: **Belum ada di repo ini** — perlu tambahan build step (copy `frontend/dist/` ke static files Django, atau tambah `whitenoise` ke `requirements.txt` + `MIDDLEWARE`) dan Dockerfile perlu build stage frontend. Di luar scope dokumen ini; catat sebagai kerja tambahan kalau opsi ini dipilih.
- **Custom domain & SSL**: Satu domain saja untuk keduanya — lebih sederhana dari sisi DNS.
- **Implikasi cookie/CORS**: **Tidak ada isu cookie/CORS sama sekali** — satu origin, `COOKIE_SAMESITE=Lax` default Django sudah cukup, tidak perlu `CORS_ALLOWED_ORIGINS` khusus.
- **Cocok untuk**: Demo cepat yang ingin hindari kerumitan cross-site sama sekali, atau tim yang tidak mau kelola 2 platform terpisah. Trade-off: kehilangan CDN edge (frontend ikut lambat kalau compute host jauh dari user), dan butuh kerja setup tambahan yang belum ada.

### (v) GitHub Pages
- **Biaya**: Gratis.
- **Setup**: **Stub — belum diverifikasi di repo ini.** Catatan penting kalau mau dicoba: GitHub Pages tidak punya server-side rewrite bawaan, jadi SPA routing (mis. `/mahasiswa/sesi/5` di-refresh langsung) akan 404 kecuali ditambahkan workaround (redirect 404→`index.html`, atau pakai HashRouter alih-alih BrowserRouter — repo ini pakai `createBrowserRouter`, jadi butuh workaround). Tidak direkomendasikan kecuali Cloudflare Pages/Vercel/Netlify semua tidak bisa dipakai.
- **Implikasi cookie/CORS**: Cross-site terhadap backend, sama seperti (i)-(iii).
- **Cocok untuk**: Fallback saja — bukan rekomendasi utama.

---

## 2. Matriks opsi backend (compute + database)

### (a) Railway (compute) + Railway Postgres (bundled)
- **Biaya**: ~$5/bln.
- **Cold start**: Tidak ada — service tetap hidup.
- **Setup**: [DEPLOYMENT.md Opsi 1](DEPLOYMENT.md#opsi-1--railway-mulus-5bln-tanpa-cold-start).
- **Reliabilitas untuk demo live**: Tinggi — tidak ada risiko "tidur" di tengah demo.
- **Umur panjang / expiry**: Tidak ada expiry selama tagihan dibayar.
- **Gotcha spesifik**: Filesystem ephemeral — PDF upload hilang saat redeploy (lihat [bagian 6](#6-catatan-upload-file-ephemeral)).
- **Cocok untuk**: Demo 2 hari (biaya minimal untuk durasi segitu) maupun pemakaian jangka panjang.

### (b) Render free (compute) + Render free Postgres
- **Biaya**: Gratis.
- **Cold start**: Ya — tidur setelah idle, request pertama ~30 detik.
- **Setup**: [DEPLOYMENT.md Opsi 2](DEPLOYMENT.md#opsi-2--render-gratis-tidur-saat-idle--cold-start-30-dtk).
- **Reliabilitas untuk demo live**: Rendah kalau tidak dibuka dulu — request pertama di depan orang bisa terasa "aplikasi hang" 30 detik.
- **Umur panjang / expiry**: PostgreSQL gratis Render kedaluwarsa ~30–90 hari — perlu diperhatikan kalau dipakai lebih dari itu.
- **Gotcha spesifik**: Sama seperti (a) soal file upload ephemeral, ditambah DB expiry.
- **Cocok untuk**: Demo santai (tidak live di depan orang), atau budget benar-benar nol.

### (b2) Render free + keep-alive ping eksternal
Varian (b): tambahkan cron eksternal (cron-job.org / UptimeRobot, tiap ~10 menit) yang nge-ping endpoint ringan supaya container tidak sempat tidur.

- **Biaya**: Tetap gratis (cron eksternal juga gratis di tier dasar).
- **Cold start**: Diminimalkan, **tidak dijamin 100%** — Render tetap bisa restart untuk maintenance/redeploy kapan saja, dan cron eksternal punya delay/downtime sendiri.
- **Setup**: Sama seperti (b), ditambah endpoint `/api/health/` (lihat [bagian 4](#4-opsional-endpoint-apihealth)) dan konfigurasi cron eksternal.
- **Reliabilitas untuk demo live**: Sedang — jauh lebih baik dari (b) polos, tapi tetap ada risiko residual dibanding (a)/(c)/(d).
- **Umur panjang / expiry**: Sama seperti (b) — DB expired 30-90 hari.
- **Gotcha spesifik**: Perlu endpoint tambahan + layanan cron pihak ketiga untuk dipelihara; menambah moving parts dibanding opsi lain.
- **Cocok untuk**: Mau tetap gratis tapi ingin cold start jarang terjadi — bukan pengganti reliabilitas (a)/(c)/(d) untuk demo yang benar-benar kritis.

### (c) Render paid (compute) + Postgres
- **Biaya**: ~$7/bln (Starter tier).
- **Cold start**: Tidak ada — sama seperti Railway.
- **Setup**: Sama seperti [DEPLOYMENT.md Opsi 2](DEPLOYMENT.md#opsi-2--render-gratis-tidur-saat-idle--cold-start-30-dtk), tinggal upgrade tier instance di dashboard Render (bukan langkah terpisah).
- **Reliabilitas untuk demo live**: Tinggi.
- **Umur panjang / expiry**: Tidak ada expiry selama tagihan dibayar.
- **Gotcha spesifik**: Sama soal file upload ephemeral.
- **Cocok untuk**: Kalau sudah terlanjur di ekosistem Render dan mau hilangkan cold start tanpa pindah platform.

### (d) Cloudflare Tunnel dari PC sendiri
- **Biaya**: Gratis.
- **Cold start**: Tidak ada — server Django jalan langsung, live.
- **Setup**: [DEPLOYMENT.md Opsi 3](DEPLOYMENT.md#opsi-3--cloudflare-tunnel-gratis-tapi-pc-harus-nyala).
- **Reliabilitas untuk demo live**: Tinggi **selama PC tetap nyala & terkoneksi** — kalau PC tidur/wifi putus, backend langsung mati tanpa peringatan.
- **Umur panjang / expiry**: Tidak relevan (tidak ada platform, tapi juga tidak "always-on" tanpa PC menyala).
- **Gotcha spesifik**: URL Cloudflare Tunnel acak berubah tiap kali dijalankan ulang (kecuali pakai tunnel permanen berbayar) — perlu update `VITE_API_URL` frontend tiap sesi baru.
- **Cocok untuk**: Demo singkat/terjadwal di mana laptop akan tetap di tangan dan menyala sepanjang acara — 100% gratis dan tanpa cold start sama sekali.

### (e) Railway/Render (compute) + Supabase Postgres (hybrid)
- **Biaya**: Biaya compute host (Railway ~$5/bln atau Render) + Supabase gratis (tier free, 500MB DB).
- **Cold start**: Tergantung compute host yang dipilih (tidak ada kalau Railway/Render paid; ada kalau Render free).
- **Setup**: Sama seperti Opsi 1/2 di DEPLOYMENT.md, tapi `DATABASE_URL` diarahkan ke connection string Supabase Postgres (bukan Postgres bundled platform) — pastikan `sslmode=require` di connection string.
- **Reliabilitas untuk demo live**: Sama seperti compute host yang dipilih.
- **Umur panjang / expiry**: **Database tidak pernah expired** (beda dari Render free Postgres) — kelebihan utama kombinasi ini.
- **Gotcha spesifik**: Dua dashboard terpisah untuk dikelola (compute host + Supabase), satu network hop tambahan antara compute host dan Supabase (biasanya masih cepat, tapi bukan nol).
- **Cocok untuk**: Pemakaian jangka panjang oleh tim yang ingin DB stabil tanpa risiko expiry, tanpa terikat penuh ke satu platform.

### (f) Fly.io
- **Setup**: **Stub — belum diverifikasi di repo ini.** Fly.io punya model scale-to-zero yang bisa dikonfigurasi (`auto_stop_machines`), berpotensi cocok untuk kombinasi biaya-rendah-tanpa-cold-start kalau dikonfigurasi `min_machines_running = 1`, tapi belum pernah dicoba/diuji dengan `Dockerfile` repo ini. Jangan asumsikan langkah di atas benar tanpa uji coba nyata — evaluasi terpisah kalau mau dikejar.

---

## 3. Tabel keputusan cepat

| Situasi | Frontend disarankan | Backend disarankan | Kenapa |
|---|---|---|---|
| Demo 2 hari, mau 100% gratis & 0 cold start | Cloudflare Pages / Vercel | (d) Cloudflare Tunnel | Gratis penuh, tidak ada cold start, asal laptop dijaga menyala |
| Demo 2 hari, budget kecil OK (~$5) | Cloudflare Pages / Vercel | (a) Railway | Paling aman untuk demo live — tanpa cold start, tanpa perlu jaga laptop |
| Demo super cepat, males kelola 2 platform | (iv) Same-origin | (a) Railway atau (c) Render paid | Satu deployment, satu domain, nol isu cookie/CORS — tapi butuh kerja setup tambahan yang belum ada di repo |
| Dipakai jangka panjang oleh tim | Cloudflare Pages | (a) Railway, atau (e) + Supabase DB | Stabil, tanpa expiry DB (kalau pakai Supabase) |
| Mau gratis, terima cold start ~30 detik | Cloudflare Pages / Vercel | (b) Render free | Gratis penuh, cukup untuk review santai (bukan demo live) |

---

## 4. Opsional: endpoint `/api/health/`

Hanya dibutuhkan untuk kombinasi backend **(b2)** — keep-alive ping ke Render free. Semua kombinasi lain tidak butuh perubahan kode.

**Kalau mau ditambahkan:**
1. Tambah view di `backend/core/views.py`, meniru pola `csrf_cookie` yang sudah ada (`@api_view(['GET'])`, `@authentication_classes([])`, `@permission_classes([AllowAny])`), return `Response({'status': 'ok'})` — tanpa query DB, murni ping cepat.
2. Daftarkan di `backend/core/urls.py`: `path('health/', health_check, name='health-check')`.
3. Konfigurasi cron eksternal (cron-job.org / UptimeRobot) untuk ping `https://<domain-backend>/api/health/` tiap ~10 menit.

Ini perubahan kode kecil dan opsional — tidak perlu dikerjakan kalau memilih kombinasi lain selain (b2).

---

## 5. Aturan lintas-kombinasi: cookie/CORS tergantung topologi domain

Ini berlaku untuk **semua** kombinasi kecuali (iv) same-origin:

| Topologi domain | Setting backend |
|---|---|
| Frontend & backend beda domain (mis. Cloudflare Pages + Railway) — **cross-site** | `COOKIE_SAMESITE=None` wajib |
| Frontend & backend di subdomain domain yang sama (`app.` + `api.`) — **same-site** | `COOKIE_SAMESITE=Lax` cukup, lebih tahan pemblokiran third-party cookie browser |
| (iv) Same-origin | Tidak ada isu sama sekali — satu origin |

Detail env var (`CORS_ALLOWED_ORIGINS`, `VITE_API_URL`, checklist penyambungan) sudah lengkap di [DEPLOYMENT.md Bagian C](DEPLOYMENT.md#bagian-c--menyambungkan-keduanya) — tidak diulang di sini.

---

## 6. Catatan upload file ephemeral

Berlaku untuk **semua kombinasi backend compute host terkelola** (Railway, Render — baik (a), (b), (b2), (c), maupun (e)): PDF yang diupload mahasiswa **hilang saat redeploy**, karena filesystem platform-platform ini ephemeral. Ini **tidak terselesaikan** dengan mengganti kombinasi hosting manapun (termasuk ganti frontend) — perlu object storage (Cloudflare R2, S3, atau Supabase Storage) untuk fix sungguhan. Di luar scope dokumen ini.

Kombinasi (d) Cloudflare Tunnel tidak kena masalah ini (filesystem lokal PC persisten selama PC tidak di-reset), tapi punya risiko lain (PC harus tetap nyala).

---

## 7. Catatan maintenance

Kalau ada opsi baru (frontend atau backend) yang ingin dievaluasi/ditambahkan: buat subsection baru di bagian 1 atau 2 dengan field checklist yang sama persis dengan opsi sejenis yang sudah ada (supaya tetap benar-benar comparable), lalu update tabel keputusan di bagian 3 kalau relevan.
