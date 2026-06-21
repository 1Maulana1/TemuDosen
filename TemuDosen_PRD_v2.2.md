## **PRODUCT REQUIREMENTS DOCUMENT TemuDosen — Platform Dokumentasi & Kontinuitas Bimbingan** 

_Sistem terpadu yang menjadwalkan, merekam, mentranskripsi, dan meringkas bimbingan akademik secara otomatis, serta melacak tindak lanjut saran lintas sesi—agar isi dan kesinambungan bimbingan terdokumentasi, bukan sekadar terjadwal._ 

|**Field**|**Detail**|
|---|---|
|Version|v2.2 — Keputusan teknis & integrasi (lanjutan v2.1)|
|Date|Juni 2026|
|Team|Kelompok 1: Ihsan Maulana Prasetia, Farel Hafidh Irdyansyah, Maulana<br>Shiddiq A., Rifqi Pramudya, Naurah Lathifah|
|Product Owner|Kelompok 1|
|Client / Stakeholder|Universitas|
|Status|Revised — In Review|



## **0.  Ringkasan Revisi** 

Revisi ini menanggapi masukan dosen pada sesi review (15 Juni 2026) yang menantang proposisi nilai produk: jika produk hanya menjadwalkan, Google Calendar dianggap sudah memadai. Fokus produk karena itu digeser dari sekadar penjadwalan antrean menjadi platform dokumentasi bimbingan dan kontinuitas pembimbingan. Pembeda utama: perekaman sesi, transkripsi otomatis (Speech-to-Text), ringkasan AI ke logbook, dan pelacakan tindak lanjut saran lintas sesi. Penjadwalan dinamis dan integrasi Google Calendar dipertahankan sebagai infrastruktur pendukung, bukan dihapus. 

**Penyesuaian v2.1:** alur sesi disederhanakan sesuai keinginan dosen agar minim friksi. Aksi memulai sesi dan merekam digabung menjadi satu tombol “Mulai & Rekam”, dan pengisian catatan manual saat menutup sesi dijadikan opsional karena ringkasan dihasilkan otomatis lalu cukup disetujui dosen (“duduk bareng, klik rekam, lalu approval”). Inti sistem—antrean dinamis, pencatatan waktu (timestamp), dan logging—tidak berubah. 

**Penambahan v2.2:** ditambahkan Bab 10 “Keputusan Teknis & Integrasi” untuk menutup dua celah yang sebelumnya terbuka—pemilihan layanan STT/LLM dan spesifikasi API logbook kampus beserta strategi fallback-nya. Bab ini bersifat menambah detail implementasi; functional requirements, workflow, dan diagram (BMC, BPMN, workflow sistem) tidak berubah. 

**Penanda warna:** _hijau = baris BARU, oranye = baris DIUBAH/REVISI, putih = tidak berubah dari v1.0._ 

|**Bagian**|**Jenis**|**Ringkasan perubahan**|
|---|---|---|
|1. Problem Statement|Diubah|Menambah dimensi hilangnya isi & riwayat saran<br>bimbingan serta duplikasi logbook manual—bukan hanya<br>waktu tunggu.|
|2. Objectives|Ditambah|Tujuan dokumentasi isi sesi, kontinuitas saran, dan<br>integrasi logbook kampus.|
|3. Success Metrics|Ditambah|Metrik cakupan transkrip+ringkasan, rasio tindak lanjut<br>saran, dan waktu logging manual.|
|4. Scope|Diubah|Proposisi inti digeser; STT, ringkasan AI, dan pelacakan<br>saran masuk MVP; penjadwalan menjadi pendukung.|
|5. Functional<br>Requirements|Ditambah|FR baru untuk perekaman, STT, ringkasan AI, pelacakan<br>saran, dan integrasi kampus.|
|6. Workflows|Ditambah|Workflow baru 6.3 Perekaman, Transkripsi & Ringkasan;<br>langkah “Mulai & Rekam” ditambahkan ke 6.2.|



|**Bagian**|**Jenis**|**Ringkasan perubahan**|
|---|---|---|
|7. Design|Ditambah|Indikator perekaman, tampilan & penyuntingan transkrip,<br>prompt persetujuan rekam.|
|8. Data Requirements|Diubah|Entitas baru Transkrip, Ringkasan/Logbook, Item Saran;<br>Sesi ditautkan ke ringkasan.|
|9. NFRs|Ditambah|NFR akurasi/latensi STT, fallback ringkasan AI, privasi<br>rekaman, reliabilitas integrasi kampus.|
|5 & 6 (v2.1)|Diubah|Tombol “Mulai Sesi” + “Record” digabung menjadi satu<br>“Mulai & Rekam” (mencatat TS1 + mulai rekam);<br>“Selesai” menghentikan rekam + mencatat TS2; catatan<br>manual jadi opsional karena ringkasan AI cukup disetujui<br>dosen.|
|10 (v2.2)|Ditambah|Bab baru Keputusan Teknis & Integrasi: kriteria &<br>rekomendasi STT/LLM (hibrida), spec API logbook<br>kampus, dan strategi fallback.|



## **PART 1: PROBLEM, OBJECTIVES & SCOPE** 

## **1.  Problem Statement** 

## **1.1  Background & Context** 

Proses bimbingan akademik dan skripsi di kampus saat ini masih mengandalkan antrean fisik atau penjadwalan statis **sekaligus pencatatan hasil bimbingan yang serba manual** . Mahasiswa menunggu tanpa kepastian waktu, dan hampir seluruh mahasiswa merekam sesi memakai voice note pribadi karena tidak ada dokumentasi resmi. Di sisi dosen, arahan yang sudah diberikan mudah terlupakan antar-sesi sehingga sulit memastikan mahasiswa menindaklanjuti saran sebelumnya. Sistem logbook kampus yang ada (misalnya Sekawan/KPTI) pun masih harus diisi ulang secara manual. Akibatnya, isi dan kesinambungan bimbingan—bukan hanya jadwalnya—tidak terekam, dan Kaprodi tidak memiliki landasan data yang utuh untuk evaluasi serta akreditasi. 

## **1.2  Problem Statement** 

**Mahasiswa dan dosen tidak dapat menyelenggarakan dan mendokumentasikan bimbingan secara efisien dan berkesinambungan** karena tidak adanya sistem terpadu yang menjadwalkan, merekam, dan meringkas isi bimbingan serta melacak tindak lanjut saran, _yang mengakibatkan_ tingginya waktu tunggu, hilangnya rekam isi dan riwayat saran bimbingan, duplikasi pencatatan logbook manual, dan tidak terukurnya kepatuhan mahasiswa terhadap arahan dosen. 

## **1.3  Who is Affected** 

- **Mahasiswa (Primary):** kehilangan waktu antre dan harus merekam serta mencatat sendiri hasil bimbingan, tanpa rangkuman resmi yang dapat dirujuk ulang. 

- **Dosen (Secondary):** selain beban antrean tak terprediksi, mudah lupa arahan yang pernah diberikan ke tiap mahasiswa sehingga tidak dapat memastikan tindak lanjutnya, dan harus mengisi logbook secara manual. 

- **Kaprodi (Stakeholder):** tidak dapat mengukur beban kerja maupun melacak isi, kualitas, dan kesinambungan bimbingan untuk akreditasi, karena rekam yang ada hanya berupa jadwal dan buku kendali kertas. 

## **2.  Objectives** 

## **2.1  Business Objectives** 

|**#**|**Objective**|**Why it matters**|**Success indicator**|
|---|---|---|---|
|1|Menurunkan rata-rata waktu<br>tunggu fisik mahasiswa<br>sebelum bimbingan.|Menghilangkan aktivitas<br>non-value dan<br>mengembalikan waktu<br>produktif mahasiswa.|Rata-rata waiting time turun<br>dari ~120 menit menjadi<br><30 menit (terukur dari log<br>aplikasi).|
|2|Mendigitalkan 100% data<br>riwayat dan durasi bimbingan<br>akademik.|Mengubah tacit knowledge<br>menjadi data tertulis<br>sebagai decision support<br>untuk evaluasi Kaprodi.|100% sesi berstatus<br>“Selesai” memiliki<br>timestamp mulai dan<br>selesai.|
|3|Mencegah overload beban<br>kerja harian dosen pengampu.|Menjaga kualitas bimbingan<br>dan kesejahteraan dosen.|0% dosen menerima jadwal<br>melebihi parameter<br>“Maksimal Jam Bimbingan<br>Harian”.|
|4|**[BARU]**Mendokumentasikan<br>100% isi sesi bimbingan<br>menjadi transkrip + ringkasan<br>terstruktur otomatis.|Mengubah percakapan<br>bimbingan yang selama ini<br>hilang menjadi logbook<br>resmi yang dapat dirujuk<br>dan diaudit.|≥90% sesi “Selesai”<br>memiliki transkrip dan<br>ringkasan yang disetujui<br>dosen.|
|5|**[BARU]**Menjamin|Memastikan mahasiswa|≥80% item saran terlacak|



|**#**|**Objective**|**Why it matters**|**Success indicator**|
|---|---|---|---|
||kesinambungan saran antar-<br>sesi (advisory continuity).|menindaklanjuti arahan dan<br>dosen tidak kehilangan<br>konteks bimbingan<br>sebelumnya.|status tindak lanjutnya pada<br>sesi berikutnya.|
|6|**[BARU]**Mengurangi duplikasi<br>pencatatan melalui integrasi<br>logbook kampus.|Menghapus input ulang<br>manual ke sistem kampus<br>(misalnya Sekawan/KPTI).|Ringkasan tersinkron ke<br>sistem kampus tanpa input<br>ulang, untuk prodi yang<br>API-nya tersedia.|



## **2.2  User Objectives** 

|**Actor**|**What they need to accomplish**|**What stops them today**|
|---|---|---|
|Mahasiswa|Mendapatkan slot dan jam estimasi<br>bimbingan secara instan dari mana saja.|Penjadwalan masih memakai sistem<br>mencatat nama di kertas pintu<br>ruangan dosen.|
|Dosen|Mengetahui kendala spesifik mahasiswa<br>sebelum masuk ruangan dan mengontrol<br>waktu bimbingan.|Mahasiswa datang dengan draft<br>kosong atau masalah berdurasi<br>sangat beragam secara tiba-tiba.|
|Kaprodi|Mengetahui performa layanan akademik<br>harian dan beban masing-masing dosen.|Laporan hanya ada di buku kendali<br>kertas yang tidak bisa direkapitulasi<br>real-time.|
|Mahasiswa|**[BARU]**Memperoleh rangkuman dan<br>daftar saran resmi tiap sesi serta tahu apa<br>yang harus ditindaklanjuti.|Saat ini hanya mengandalkan voice<br>note pribadi dan ingatan.|
|Dosen|**[BARU]**Merekam, meringkas otomatis,<br>dan melihat riwayat saran ke tiap<br>mahasiswa tanpa mengetik manual.|Harus mengingat sendiri dan menulis<br>logbook manual; sering lupa arahan<br>sebelumnya.|



## **3.  Success Metrics** 

|**Metric**|**Baseline (now)**|**Target (3 bln)**|**How it is measured**|
|---|---|---|---|
|Waktu tunggu fisik<br>mahasiswa|~120 menit|< 30 menit|Selisih timestamp “Notifikasi<br>Panggilan Dikirim” dengan<br>“Sesi Dimulai”.|
|Kelengkapan data log<br>bimbingan|0% (manual)|100%|Query database untuk sesi<br>dengan timestamp lengkap<br>dibagi total sesi.|
|Rasio adopsi dosen|0%|> 80%|Jumlah dosen aktif yang<br>menekan tombol Mulai/Selesai<br>dibagi total dosen prodi.|
|**[BARU]**Cakupan<br>transkrip + ringkasan|0%|≥ 90%|Sesi “Selesai” yang memiliki<br>transkrip & ringkasan disetujui<br>dibagi total sesi selesai.|
|**[BARU]**Rasio tindak<br>lanjut saran|0% (tak<br>terlacak)|≥ 80%|Item saran bertanda<br>“ditindaklanjuti” pada sesi<br>berikutnya dibagi total item<br>saran.|
|**[BARU]**Waktu pencatatan<br>logbook manual|~10–15 mnt/sesi|< 2 mnt/sesi|Selisih waktu antara “ringkasan<br>AI dibuat” dan “ringkasan<br>disetujui dosen”.|



## **4.  Scope** 

## **4.1  In Scope & Out of Scope (MVP)** 

## ✅ **IN Scope (MVP)** 

**[REVISI]** Penjadwalan dinamis berbasis triage gejala + estimasi durasi (kini fitur pendukung, bukan proposisi utama). 

Verifikasi dokumen dan approval digital oleh dosen. 

Integrasi Google Calendar API untuk sinkronisasi jadwal. 

Push notification gateway dan in-app (H-15 menit). 

Perekaman log timestamp Mulai, Selesai, dan auto-cancel. 

**[BARU]** Perekaman audio sesi bimbingan (terpicu satu tombol “Mulai & Rekam”), termasuk untuk sesi offline. 

**[BARU]** Transkripsi otomatis near-real-time (Speech-to-Text, mis. Whisper) bahasa Indonesia. 

**[BARU]** Ringkasan otomatis berbasis AI dari transkrip menjadi poin saran di logbook (disetujui dosen). 

**[BARU]** Pelacakan item saran dan status tindak lanjut lintas sesi. 

**[BARU]** [Should] Integrasi API ke logbook kampus (mis. Sekawan/KPTI) untuk sinkron ringkasan. 

## ❌ **OUT of Scope (v1)** 

Pengecekan plagiarisme (Turnitin/Grammarly) terintegrasi pada dokumen. 

Integrasi video conference native/in-app (sistem hanya menyediakan field link/URL eksternal). 

Penjadwalan sidang akhir skripsi yang melibatkan banyak penguji sekaligus. 

Mobile app native (Android/iOS); fokus ke webbased responsive (PWA) terlebih dahulu. 

**[BARU]** Diarization otomatis (pemisahan suara dosen vs mahasiswa); transkrip MVP berupa teks gabungan. 

**[BARU]** Penilaian/scoring otomatis kualitas bimbingan oleh AI. 

**==> picture [227 x 176] intentionally omitted <==**

## **4.2  Assumptions & Constraints** 

|**Type**|**Description**|
|---|---|
|Assumption|Mahasiswa memiliki smartphone dengan koneksi internet.|
|Assumption|Dosen berkomitmen menekan tombol “Mulai & Rekam” dan “Selesai” tepat saat<br>bimbingan dimulai dan berakhir agar kalkulasi antrean dan durasi tidak rusak.|
|Constraint|Algoritma dynamic queuing tidak akurat jika Admin belum melakukan setup<br>katalog gejala dan dataset acuan model estimasi di awal semester.|
|Assumption|**[BARU]**Dosen dan mahasiswa menyetujui sesinya direkam (informed consent)<br>sebelum perekaman dimulai.|
|Assumption|**[BARU]**Perangkat memiliki mikrofon yang memadai untuk perekaman sesi<br>offline.|
|Constraint|**[BARU]**Akurasi STT bahasa Indonesia bergantung pada kualitas audio dan<br>model; istilah teknis dapat salah transkrip, sehingga ringkasan tetap wajib|



|**Type**|**Description**|
|---|---|
||disetujui dosen.|
|Constraint|**[BARU]**Integrasi logbook kampus hanya mungkin bila pihak kampus<br>menyediakan API/akses; jika tidak, fallback berupa ekspor/sinkron manual.|
|Constraint|**[BARU]**Biaya komputasi STT dan LLM dibatasi anggaran; pemrosesan<br>dijalankan asinkron dalam antrean.|



## **PART 2: FUNCTIONAL REQUIREMENTS & WORKFLOWS** 

## **5.  Functional Requirements** 

## **5.1  FR Table: Mahasiswa** 

|**FR ID**|**Actor**|**The system shall…**|**Condition / Trigger**|**Priorit**<br>**y**|**M**<br>**oS**<br>**Co**<br>**W**|
|---|---|---|---|---|---|
|**FR-M01**|Mahasis<br>wa|Mewajibkan pengisian “Gejala<br>Akademik” (dropdown) dan<br>upload file draft maksimal 5MB.|Saat mahasiswa<br>melakukan request<br>jadwal bimbingan baru.|High|M|
|**FR-M02**|Mahasis<br>wa|Menampilkan nomor urut,<br>estimasi waktu, dan status real-<br>time.|Saat permintaan telah<br>di-approve oleh dosen.|High|M|
|**FR-M03**|Mahasis<br>wa|Mengizinkan pembatalan antrean<br>mandiri.|Jika mahasiswa berubah<br>pikiran sebelum status<br>“Giliran Anda”.|Mediu<br>m|S|
|**[BARU]**<br>FR-M04|Mahasis<br>wa|Memberikan persetujuan<br>perekaman (consent) sebelum<br>sesi direkam.|Sebelum dosen<br>menekan “Mulai &<br>Rekam”.|High|M|
|**[BARU]**<br>FR-M05|Mahasis<br>wa|Melihat transkrip dan ringkasan<br>saran tiap sesi yang telah<br>disetujui dosen.|Setelah dosen<br>menyetujui ringkasan.|High|M|
|**[BARU]**<br>FR-M06|Mahasis<br>wa|Menandai item saran sebagai<br>“sudah ditindaklanjuti” beserta<br>keterangan/bukti.|Sebelum atau saat<br>mengajukan sesi<br>berikutnya.|Mediu<br>m|S|



## **5.2  FR Table: Sistem** 

|**FR ID**|**Actor**|**The system shall…**|**Condition / Trigger**|**Priorit**<br>**y**|**M**<br>**oS**<br>**Co**<br>**W**|
|---|---|---|---|---|---|
|**FR-S01**|Sistem|Mengecek kelengkapan file draft<br>dan form gejala secara paralel<br>(AND gateway).|Sesaat setelah<br>mahasiswa klik<br>“Submit”.|High|M|
|**FR-S02**|Sistem|Menghitung estimasi durasi<br>bimbingan berdasarkan prediksi<br>model dari gejala dan isi draft.|Saat dosen menekan<br>tombol Approve.|High|M|
|**[REVISI**<br>**]**FR-<br>S03|Sistem|Menyediakan tombol “Mulai &<br>Rekam” dan mengirim notifikasi<br>ke mahasiswa.|Saat estimasi<br>menyentuh batas H-15<br>menit.|High|M|
|**FR-S04**|Sistem|Menyimpan Timestamp 1 (Mulai)<br>dan Timestamp 2 (Selesai) ke<br>database.|Saat dosen menekan<br>“Mulai & Rekam” dan<br>“Selesai”.|High|M|
|**FR-S05**|Sistem|Mengeksekusi terminate end<br>event (auto-cancel) jika<br>mahasiswa tidak hadir.|Jika tidak ada aktivitas<br>“Mulai & Rekam” 30<br>menit sejak jadwal.|High|M|
|**FR-S06**|Sistem|Memeriksa ketersediaan slot<br>kosong (free/busy) pada Google|Saat mahasiswa<br>membuka halaman|High|M|



|**FR ID**|**Actor**|**The system shall…**|**Condition / Trigger**|**Priorit**<br>**y**|**M**<br>**oS**<br>**Co**<br>**W**|
|---|---|---|---|---|---|
|||Calendar dosen.|pemilihan jadwal.|||
|**FR-S07**|Sistem|Membuat calendar event<br>otomatis dengan mahasiswa<br>sebagai attendee dan detail<br>gejala.|Sesaat setelah dosen<br>menekan Approve.|High|M|
|**FR-S08**|Sistem|Menghapus/memperbarui event<br>di Google Calendar saat auto-<br>cancel atau recalculation.|Saat status antrean<br>berubah karena<br>keterlambatan/pembatal<br>an.|High|M|
|**[BARU]**<br>FR-S09|Sistem|Mentranskripsi audio sesi<br>menjadi teks secara near-real-<br>time via layanan STT (mis.<br>Whisper).|Saat dosen menekan<br>“Selesai” (perekaman<br>berhenti).|High|M|
|**[BARU]**<br>FR-S10|Sistem|Menghasilkan ringkasan<br>terstruktur (poin saran & catatan<br>perbaikan) dari transkrip via LLM.|Setelah transkrip<br>tersedia.|High|M|
|**[BARU]**<br>FR-S11|Sistem|Menyimpan transkrip, ringkasan,<br>dan item saran yang tertaut ke<br>sesi dan mahasiswa.|Setelah ringkasan<br>dibuat.|High|M|
|**[BARU]**<br>FR-S12|Sistem|Menyinkronkan ringkasan yang<br>disetujui ke sistem logbook<br>kampus bila API tersedia.|Setelah dosen<br>menyetujui ringkasan.|Mediu<br>m|S|
|**[BARU]**<br>FR-S13|Sistem|Menyediakan editor catatan<br>manual sebagai fallback bila<br>STT/LLM gagal/timeout, dan<br>mencatat ke Dashboard Admin.|Saat layanan STT atau<br>LLM gagal/melewati<br>timeout.|High|M|
|**5.3  FR Table: Dosen**||||||
|**FR ID**|**Actor**|**The system shall…**|**Condition / Trigger**|**Priorit**<br>**y**|**M**<br>**oS**<br>**Co**<br>**W**|
|**FR-D01**|Dosen|Mengizinkan dosen Approve atau<br>Reject/minta revisi awal atas<br>request mahasiswa.|Saat dosen me-review<br>pengajuan di dashboard.|High|M|
|**[REVISI**<br>**]**FR-<br>D02|Dosen|Menyediakan SATU tombol<br>“Mulai & Rekam” yang sekaligus<br>mencatat Timestamp Mulai (TS1)<br>dan memulai perekaman audio<br>sesi.|Setelah persetujuan<br>rekam, saat dosen<br>memulai bimbingan<br>(offline/online).|High|M|
|**[REVISI**<br>**]**FR-<br>D03|Dosen|Menyediakan SATU tombol<br>“Selesai” yang menghentikan<br>perekaman sekaligus mencatat<br>Timestamp Selesai (TS2).<br>Pengisian catatan manual<br>bersifat opsional karena<br>ringkasan dihasilkan otomatis<br>(lihat FR-D05).|Saat diskusi telah usai.|High|M|



|**FR ID**|**Actor**|**The system shall…**|**Condition / Trigger**|**Priorit**<br>**y**|**M**<br>**oS**<br>**Co**<br>**W**|
|---|---|---|---|---|---|
|**FR-D04**|Dosen|Mengizinkan dosen memilih<br>metode (Offline/Online) dan<br>melampirkan link meeting jika<br>online.|Saat dosen melakukan<br>Approve.|High|M|
|**[BARU]**<br>FR-D05|Dosen|Meninjau, menyunting, dan<br>menyetujui ringkasan & item<br>saran hasil AI sebelum masuk<br>logbook.|Setelah ringkasan AI<br>dihasilkan.|High|M|
|**[BARU]**<br>FR-D06|Dosen|Melihat riwayat seluruh saran<br>dan status tindak lanjut tiap<br>mahasiswa bimbingannya.|Saat membuka<br>profil/riwayat<br>mahasiswa.|High|M|



_**Catatan v2.1:** tombol “Record” terpisah (sebelumnya FR-D05 pada v2.0) digabung ke dalam FR-D02 “Mulai & Rekam”, sehingga dosen cukup satu kali menekan untuk mulai+rekam dan satu kali untuk berhenti. FR pelacakan riwayat saran kini menjadi FR-D06._ 

## **5.4  FR Table: Admin** 

|**FR ID**|**Actor**|**The system shall…**|**Condition / Trigger**|**Priorit**<br>**y**|**M**<br>**oS**<br>**Co**<br>**W**|
|---|---|---|---|---|---|
|**FR-**<br>**AD01**|Admin|Mengelola katalog gejala dan<br>dataset acuan untuk model<br>estimasi.|Saat konfigurasi awal<br>semester atau<br>pemeliharaan model.|High|M|
|**FR-**<br>**AD02**|Admin|Menjalankan emergency cancel<br>yang membatalkan seluruh sisa<br>antrean seorang dosen.|Saat dosen berhalangan<br>mendadak (rapat/sakit).|High|M|
|**FR-**<br>**AD03**|Admin|Menampilkan log error integrasi<br>Google Calendar pada<br>Dashboard Admin.|Saat sinkronisasi/token<br>Google Calendar gagal.|Mediu<br>m|S|
|**[BARU]**<br>FR-<br>AD04|Admin|Mengelola kredensial &<br>konfigurasi integrasi API logbook<br>kampus (mis. Sekawan/KPTI).|Saat setup atau<br>pemeliharaan integrasi.|Mediu<br>m|S|
|**[BARU]**<br>FR-<br>AD05|Admin|Memantau kuota dan log<br>kegagalan layanan STT/LLM.|Saat pemrosesan<br>transkripsi/ringkasan<br>berjalan atau gagal.|Mediu<br>m|S|



## **5.5  FR Table: Kaprodi** 

|**FR ID**|**Actor**|**The system shall…**|**Condition / Trigger**|**Priorit**<br>**y**|**M**<br>**oS**<br>**Co**<br>**W**|
|---|---|---|---|---|---|
|**FR-**<br>**KP01**|Kaprodi|Menampilkan rekap beban kerja<br>(total durasi) per dosen<br>pembimbing.|Saat membuka<br>dashboard evaluasi.|Mediu<br>m|S|
|**FR-**<br>**KP02**|Kaprodi|Menampilkan rekap rata-rata<br>waktu tunggu dan jumlah sesi<br>“Selesai” per periode.|Saat membuka<br>dashboard evaluasi.|Mediu<br>m|S|



|**FR ID**|**Actor**|**The system shall…**|**Condition / Trigger**|**Priorit**<br>**y**|**M**<br>**oS**<br>**Co**<br>**W**|
|---|---|---|---|---|---|
|**FR-**<br>**KP03**|Kaprodi|Mengekspor rekap log bimbingan<br>untuk keperluan akreditasi.|Saat meminta laporan<br>periodik.|Could|C|
|**[BARU]**<br>FR-<br>KP04|Kaprodi|Menampilkan rekap kepatuhan<br>tindak lanjut saran per<br>dosen/mahasiswa.|Saat membuka<br>dashboard evaluasi.|Could|C|



|**MoSC**<br>**oW**|**Keterangan**|
|---|---|
|M|Must Have: produk tidak rilis tanpa ini.|
|S|Should Have: bernilai tinggi, diharapkan pada sprint/rilis berikutnya.|
|C|Could Have: nice to have; hanya bila item prioritas lebih tinggi selesai.|
|W|Won't Have (this time): ditunda; dicatat agar tidak diam-diam masuk kembali.|



## **6.  User Workflows** 

## **6.1  Workflow: Pengajuan** 

|**Field**|**Field**|**Detail**|
|---|---|---|
|Actor||Mahasiswa & Sistem|
|Goal||Mahasiswa berhasil mendapat nomor urut dan jadwal pasti.|
|FRs covered||FR-M01, FR-M02, FR-S01, FR-S02, FR-D01|
|**Ideal Path:**|||
|**#**|**Step description**||
|1|Mahasiswa memilih dosen, menginput gejala, mengunggah draft, dan klik “Submit”.||
|2|Sistem memvalidasi kelengkapan berkas dan gejala, lalu meneruskan ke dosen.||
|3|Dosen memeriksa notifikasi, membaca gejala, dan klik “Setuju”.||
|4|Sistem mengkalkulasi estimasi, memosisikan ke antrean, membuat Google Calendar event,<br>dan menerbitkan jadwal estimasi.||
|**Decision Points:**|||



|**Decision Point**|**YES / Success**|**YES / Success**|**NO / Error**|
|---|---|---|---|
|File lengkap & valid?|Sistem meneruskan ke dosen.||Sistem menolak: “Harap unggah<br>draft PDF”.|
|Dosen setuju?|Masuk antrean & kalkulasi<br>jadwal.||Status dikembalikan ke “Revisi”<br>dengan catatan dosen.|
|**Edge Cases:**||||
|**Edge Case**||**What the system must do**||
|Kuota dosen penuh||Jika kalkulasi melebihi batas jam kerja dosen hari itu, sistem<br>menolak pengajuan baru untuk hari tersebut.||
|Submission ganda||Jika mahasiswa sudah punya satu sesi “Menunggu”, sistem<br>menolak dan menampilkan pesan hanya satu antrean aktif per<br>mahasiswa.||



## **6.2  Workflow: Eksekusi & Logging Sesi Bimbingan** 

|**Field**|**Detail**|
|---|---|
|Actor|Sistem & Dosen|
|Goal|Sesi berjalan tepat waktu dan log tercatat untuk menghitung durasi bimbingan.|
|FRs covered|FR-S03, FR-S04, FR-S05, FR-D02, FR-D03|
|**Ideal Path:**||



|**#**|**Step description**|
|---|---|
|1|Sistem mendeteksi H-15 menit dari jadwal estimasi mahasiswa urutan pertama.|
|2|Sistem mengirim broadcast: “Giliran Anda segera tiba.”|
|3|**[REVISI]**Mahasiswa hadir. Setelah persetujuan rekam, dosen menekan satu tombol “Mulai<br>& Rekam”. Sistem mencatat Timestamp 1 dan memulai perekaman audio.|
|4|**[REVISI]**Diskusi usai, dosen menekan “Selesai”. Sistem menghentikan perekaman,<br>mencatat Timestamp 2, dan memicu transkripsi (lihat 6.3). Catatan manual opsional.|



## **Decision Points:** 

|**Decision Point**|**YES / Success**|**YES / Success**|**NO / Error**|
|---|---|---|---|
|Mahasiswa hadir <30<br>menit sejak dipanggil?|Dosen klik “Mulai & Rekam”,<br>argometer berjalan normal.||Sistem mengeksekusi auto-<br>terminate, membatalkan antrean<br>mahasiswa.|
|**Edge Cases:**||||
|**Edge Case**||**What the system must do**||
|Dosen mendadak rapat/sakit||Admin mengaktifkan emergency cancel. Sistem memutus<br>sequence flow dan membatalkan seluruh sisa antrean.||
|Token API expired||Jika Google Calendar gagal karena token/autentikasi, sistem tetap<br>menyimpan antrean di database internal dan menampilkan log error<br>ke Dashboard Admin tanpa menghentikan alur (graceful<br>degradation).||



## **6.3  Workflow: Perekaman, Transkripsi & Ringkasan Otomatis  [BARU]** 

|**Field**|**Field**|**Detail**|
|---|---|---|
|Actor||Dosen, Mahasiswa & Sistem|
|Goal||Isi sesi terdokumentasi menjadi ringkasan dan item saran resmi di logbook.|
|FRs covered||FR-M04, FR-M05, FR-D02, FR-D05, FR-S09, FR-S10, FR-S11, FR-S13|
|**Ideal Path:**|||
|**#**|**Step description**||
|1|Saat sesi dimulai, sistem menampilkan prompt persetujuan rekam; dosen menekan “Mulai &<br>Rekam” (mencatat TS1 + memulai perekaman).||
|2|Sistem merekam audio (offline/online) hingga dosen menekan “Selesai” (perekaman<br>berhenti + mencatat TS2).||
|3|Sistem mentranskripsi audio (STT) lalu menghasilkan ringkasan + daftar item saran via LLM.||
|4|Dosen meninjau/menyunting ringkasan, lalu klik “Setujui”. Sistem menyimpan ke logbook<br>dan menautkannya ke mahasiswa.||



## **Decision Points:** 

|**Decision Point**|**YES / Success**|**YES / Success**|**NO / Error**|
|---|---|---|---|
|Mahasiswa & dosen setuju<br>direkam?|Perekaman berjalan.||Sesi tetap berjalan tanpa rekam;<br>dosen mengisi ringkasan manual.|
|STT/LLM berhasil?|Ringkasan draft ditampilkan<br>untuk ditinjau dosen.||Sistem menyediakan editor<br>catatan manual dan menandai<br>log error (graceful degradation).|
|**Edge Cases:**||||
|**Edge Case**||**What the system must do**||
|Audio terputus/buruk||Sistem menyimpan potongan transkrip yang ada, menandai bagian<br>“tidak terdengar”, dan meminta dosen melengkapi.||
|API logbook kampus down||Ringkasan tetap tersimpan internal dan masuk antrean sinkron<br>ulang; error tampil di Dashboard Admin.||



## **PART 3: DESAIN, DATA, NFR & RELEASE PLANNING** 

## **7.  Design Considerations** 

- **Aksesibilitas perangkat (platform constraint):** seluruh alur pendaftaran antrean dan notifikasi wajib berfungsi penuh pada layar lebar minimum 360px tanpa horizontal scrolling. 

- **Standar kontras warna (accessibility constraint):** teks status antrean pada dashboard harus memenuhi WCAG 2.1 Level AA. 

- **[BARU] Indikator perekaman:** status “Merekam…” yang jelas, dengan tombol “Mulai & Rekam” dan “Selesai” yang besar dan mudah dijangkau, termasuk pada layar 360px. 

- **[BARU] Penyuntingan transkrip:** tampilan transkrip & ringkasan harus dapat disunting dosen, dengan pembeda jelas antara teks AI (draft) dan hasil suntingan dosen (final). 

- **[BARU] Prompt persetujuan rekam:** ditampilkan eksplisit sebelum perekaman dimulai. 

## **8.  Data Requirements** 

- **Mahasiswa:** NIM (PK), Nama Lengkap. Constraint: satu mahasiswa tidak boleh memiliki lebih dari satu sesi “Menunggu” pada waktu bersamaan. 

- **Dosen:** NIDN (PK), Nama Lengkap, Kuota Harian. Constraint: kuota harian (menit) tidak boleh kurang dari nol. 

- **Gejala:** ID Gejala (PK), Nama Gejala, Kategori. Catatan: dipakai sebagai masukan model estimasi. 

- **Sesi Bimbingan:** AppointmentID (PK), NIM (FK), NIDN (FK), ID Gejala (FK), Timestamp Mulai/Selesai, Status, Google Event ID, Calendar Sync Status. **[REVISI]** ditambah: Punya Transkrip (bool), Status Ringkasan. Constraint: transisi status satu arah — Menunggu → Disetujui → Berlangsung → Selesai → Dibatalkan. 

- **[BARU] Transkrip:** TranskripID (PK), SesiID (FK), Teks, Bahasa, Status STT (Diproses/Selesai/Gagal), Durasi Audio. Constraint: satu sesi maksimal satu transkrip aktif. 

- **[BARU] Ringkasan / Logbook Entry:** RingkasanID (PK), SesiID (FK), Isi Ringkasan, Status (Draft AI/Disetujui), Disetujui Oleh (NIDN), Logbook Sync Status. 

- **[BARU] Item Saran (Advice):** SaranID (PK), SesiID Asal (FK), NIM (FK), Teks Saran, Status Tindak Lanjut (Belum/Sedang/Selesai), Sesi Tindak Lanjut (FK, nullable). Constraint: status tindak lanjut hanya maju. 

## **9.  Non-Functional Requirements (NFRs)** 

- **NFR-01 [Performance]:** Dashboard antrean memuat data terbaru <3 detik untuk 95% permintaan di beban puncak. Pemanggilan Google Calendar API berjalan asinkron agar tidak memblokir load time. Diuji via load test (500 concurrent users). 

- **NFR-02 [Availability]:** Uptime ≥ 99,5% per bulan di luar jam pemeliharaan terjadwal. 

- **NFR-03 [Security & Integration]:** OAuth2 Access/Refresh Token Google Calendar disimpan terenkripsi (minimal AES-256). Diuji via security code review dan penetration testing sebelum rilis. 

- **NFR-04 [Reliability / Fault Tolerance]:** Jika Google Calendar API terputus, timeout >4 detik, atau token kedaluwarsa, sistem menerapkan graceful degradation: tetap menyimpan antrean di DB lokal dan menampilkan log error ke Dashboard Admin tanpa menghentikan pengguna lain. 

- **NFR-05 [Reliability / AI Fallback]:** Jika estimasi AI gagal/timeout >5 detik, sistem memakai estimasi default (rata-rata historis per kategori gejala) dan mencatat ke Dashboard Admin tanpa menghentikan antrean. 

- **[BARU] NFR-06 [Performance / STT]:** Transkripsi tersedia untuk ditinjau dalam ≤ 2× durasi audio untuk 90% sesi; pemrosesan asinkron agar tidak memblokir UI. 

- **[BARU] NFR-07 [Reliability / Summarization Fallback]:** Jika layanan ringkasan LLM gagal/timeout, sistem menyediakan editor catatan manual kosong dan menandai log; sesi tetap dapat diselesaikan. 

- **[BARU] NFR-08 [Privacy & Consent]:** Rekaman audio dan transkrip adalah data sensitif: disimpan terenkripsi (AES-256), hanya diakses dosen pembimbing dan mahasiswa terkait, dengan persetujuan rekam tercatat. Retensi dan penghapusan mengikuti kebijakan kampus. 

- **[BARU] NFR-09 [Integration Reliability — Logbook Kampus]:** Jika API logbook kampus gagal/timeout, ringkasan tetap tersimpan internal dan masuk antrean sinkron ulang; error tampil di Dashboard Admin (graceful degradation). 

## **10.  Keputusan Teknis & Integrasi** 

Bagian ini mendokumentasikan keputusan teknis yang sebelumnya terbuka agar tidak menjadi celah saat perencanaan teknis (Phase 6). Keputusan diambil untuk konteks MVP akademik berdurasi singkat: cepat dibangun, infrastruktur minimal, namun tetap menjaga privasi rekaman (NFR-08). Penyebutan produk bersifat indikatif; yang mengikat adalah kriteria pemilihannya. 

## **10.1  Pemilihan Layanan STT & LLM** 

**Kriteria pemilihan:** (1) akurasi bahasa Indonesia, (2) privasi — self-host vs cloud, (3) biaya per menit/token, (4) ketersediaan GPU. 

**Rekomendasi — pendekatan hibrida:** STT di-self-host, ringkasan LLM melalui API. Aset paling sensitif adalah audio rekaman, bukan teksnya; dengan menjalankan STT sendiri, audio tidak pernah keluar dari server (memenuhi NFR-08). Sementara ringkasan LLM—bagian yang paling berat bila diself-host—cukup dilayani API tier murah, dan yang dikirim hanya teks transkrip, bukan audio. 

- **STT:** self-host faster-whisper (large-v3-turbo). Ringan (pip install, GPU sederhana/Colab), gratis, audio tetap lokal. Akurasi memadai untuk audio formal; percakapan informal kurang akurat, namun ditutup oleh persetujuan dosen (human-in-the-loop, FR-D05). 

- **LLM ringkasan:** API tier murah-cepat (kelas Gemini Flash / GPT-mini / Claude Haiku). Kualitas ringkasan bahasa Indonesia baik, tanpa GPU besar, biaya per ringkasan kecil. Hanya teks transkrip yang dikirim ke API. 

|**Kondisi**|**Pilihan stack**|
|---|---|
|**Default (MVP, ada GPU/Colab**<br>**sederhana)**|Hibrida: faster-whisper (self-host) + LLM via API tier murah. —<br>rekomendasi utama.|
|Tanpa akses GPU sama sekali|STT & LLM dua-duanya via API (mis. Whisper API + LLM API).<br>Tercepat dibangun; catat kompromi privasi audio + consent<br>eksplisit pada tahap prototipe.|
|Privasi mutlak + GPU memadai|Self-host keduanya: faster-whisper + LLM open Indonesia<br>(Sahabat-AI / SEA-LION / Qwen) via Ollama/vLLM. Paling<br>aman & murah jangka panjang, tetapi paling lama disiapkan.|



_**Catatan:** keputusan final ditetapkan saat Phase 6 planning. WER Whisper yang lebih tinggi pada percakapan informal bukan risiko fatal karena ringkasan wajib disetujui dosen sebelum masuk logbook._ 

## **10.2  Integrasi Logbook Kampus & Strategi Fallback** 

- Sistem kampus (mis. Sekawan/KPTI) kemungkinan belum menyediakan API publik dalam rentang waktu proyek. Karena itu integrasi dirancang berlapis dan tidak bergantung pada ketersediaan API live. • **Lapisan adapter:** modul integrasi logbook dipisah agar mudah diganti bila API kampus berubah atau baru tersedia, tanpa membongkar sistem inti. 

   - **Jalur utama (berfungsi untuk demo):** ekspor file CSV/PDF ringkasan yang dapat diunggah ke logbook kampus (selaras FR-S12 Should dan NFR-09). 

   - **Jalur opsional:** bila API live tersedia, sinkron otomatis via endpoint POST. 

**Kontrak API minimal** yang diajukan ke pengelola sistem kampus, atau dipakai sebagai mock saat API belum ada: 

```
POST /api/v1/logbook/entries
Authorization: Bearer <token>        # autentikasi
Content-Type: application/json
Request body:
{
  "nim": "20210001",
  "nidn": "0012345678",
  "tanggal": "2026-06-16T14:00:00+07:00",
  "topik": "Bab 3 - Metodologi",
  "ringkasan": "...",            // hasil AI disetujui dosen
  "saran": ["perbaiki rumusan masalah", "tambah referensi"],
  "durasi_menit": 35
}
Response sukses : 201 Created  -> { "entry_id": "LB-8842" }
Response gagal  : 401 (token salah) | 422 (data tak lengkap) | 500
```

**Graceful degradation:** jika endpoint gagal/timeout, ringkasan tetap tersimpan internal dan masuk antrean sinkron ulang, dengan error tampil di Dashboard Admin (NFR-09). Dengan demikian produk tetap utuh saat didemokan tanpa bergantung pada pihak luar. 

