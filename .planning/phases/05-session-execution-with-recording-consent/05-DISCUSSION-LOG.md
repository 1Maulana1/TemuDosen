# Phase 5: Session Execution with Recording & Consent - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-02
**Phase:** 5-Session Execution with Recording & Consent
**Areas discussed:** Consent flow, Perekaman audio (recording implementation), Alur "Selesai" (TS2)

---

## Pre-discussion: codebase scout

Before presenting gray areas, a scout of `apps/bimbingan/` found that SESSION-01 (T-15 notification), SESSION-05 (auto-cancel), and SESSION-06 (offline/online + meeting link) were already fully implemented in an earlier bulk commit (55aefb3), and a partial "Mulai" button/endpoint already existed for SESSION-03 (timestamp only, no consent, no recording). This was presented to the user before discussion began so gray-area questions focused only on the genuinely unbuilt parts.

## Consent Flow

| Question | Option | Description | Selected |
|---|--------|-------------|----------|
| Kapan modal consent muncul? | Bagian tombol "Mulai & Rekam" | Modal muncul saat klik, sebelum ts1/recording mulai | ✓ |
| | Langkah terpisah | Step/checkbox tersendiri sebelum tombol aktif | |
| Siapa yang consent? | Dosen konfirmasi atas nama keduanya | Satu tombol, device bersama saat sesi tatap muka | ✓ |
| | Dua konfirmasi terpisah | Dosen + mahasiswa masing-masing consent | |
| Kalau consent ditolak? | ts1 tetap dicatat, status "tanpa rekaman" | Sesi jalan normal tanpa audio | ✓ |
| | Sesi tidak bisa dimulai | Consent wajib untuk memulai | |
| Ditanya tiap sesi? | Tiap sesi | Sesuai SESSION-02 wording | ✓ |
| | Tersimpan, tidak ditanya ulang | Butuh field baru di relasi adviser | |

**Notes:** User first asked "consent ini apa" — clarified consent means explicit recording-permission prompt before audio capture, tied to SESSION-02 and NFR-08. After explanation, user confirmed understanding and answered the timing question directly.

## Perekaman Audio (Recording Implementation)

| Question | Option | Description | Selected |
|---|--------|-------------|----------|
| Format audio? | WebM/Opus | Native browser MediaRecorder output, no client transcode | ✓ |
| | Convert ke MP3 | Perlu library tambahan, lebih kompleks | |
| Kapan upload? | Sekali saat "Selesai" | Buffer di browser, upload utuh, mirrors PDF upload pattern | ✓ |
| | Chunked selama sesi | Lebih tahan crash, jauh lebih kompleks untuk MVP | |
| Batas durasi/ukuran? | Tidak ada batas keras | Hanya warning, sesi sudah dibatasi estimasi symptom | ✓ |
| | Batas keras (2 jam) | Auto-stop di durasi maksimum | |
| Mic permission ditolak? | Sesi tetap jalan tanpa rekaman | Sama seperti consent ditolak, tidak memblokir | ✓ |
| | Sesi tidak bisa dimulai | Wajib fix izin mic dulu | |

## Alur "Selesai" (TS2)

| Question | Option | Description | Selected |
|---|--------|-------------|----------|
| Tombol "Selesai" di mana? | Halaman terpisah khusus sesi berjalan | Active-session page dengan timer + recording indicator | ✓ |
| | Tombol berubah di dashboard/queue | Tidak perlu halaman baru | |
| Catatan manual bentuknya apa? | Textarea di modal konfirmasi "Selesai" | Opsional, isi saat klik Selesai | ✓ |
| | Field terpisah, diisi belakangan | Dari halaman riwayat sesi | |
| Wajib kalau tanpa rekaman? | Tetap opsional, boleh kosong total | Fleksibilitas diutamakan untuk MVP | ✓ |
| | Wajib kalau tanpa rekaman | Satu-satunya dokumentasi jika tanpa audio | |

**Notes:** User explicitly considered making manual notes mandatory in the no-recording case, then chose to keep it fully optional — flagged in CONTEXT.md as a deliberate trade-off (documentation completeness vs. MVP flexibility), not an oversight.

---

## Claude's Discretion

- Consent modal copy/wording (Indonesian, matching existing UI tone)
- Visual placement of the "Merekam…" recording indicator on the active-session page
- Whether the active-session page is a new route or a modal (planner decides from router.tsx conventions)
- Recovery behavior if the dosen navigates away mid-recording (flagged as a risk, not decided)

## Deferred Ideas

None — discussion stayed within Phase 5 scope. Two alternatives were raised and explicitly rejected (not deferred, decided against): chunked/incremental audio upload, and persistent "always allow" consent per dosen-mahasiswa pair.
