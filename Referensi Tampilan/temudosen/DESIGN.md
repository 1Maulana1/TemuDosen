---
name: TemuDosen
colors:
  surface: '#f8f9ff'
  surface-dim: '#d0dbed'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e6eeff'
  surface-container-high: '#dee9fc'
  surface-container-highest: '#d9e3f6'
  on-surface: '#121c2a'
  on-surface-variant: '#534434'
  inverse-surface: '#27313f'
  inverse-on-surface: '#eaf1ff'
  outline: '#867461'
  outline-variant: '#d8c3ad'
  surface-tint: '#855300'
  primary: '#855300'
  on-primary: '#ffffff'
  primary-container: '#f59e0b'
  on-primary-container: '#613b00'
  inverse-primary: '#ffb95f'
  secondary: '#006c49'
  on-secondary: '#ffffff'
  secondary-container: '#7ef6be'
  on-secondary-container: '#00714c'
  tertiary: '#a73a00'
  on-tertiary: '#ffffff'
  tertiary-container: '#ff956b'
  on-tertiary-container: '#7a2800'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffddb8'
  primary-fixed-dim: '#ffb95f'
  on-primary-fixed: '#2a1700'
  on-primary-fixed-variant: '#653e00'
  secondary-fixed: '#81f9c1'
  secondary-fixed-dim: '#63dca6'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdbce'
  tertiary-fixed-dim: '#ffb599'
  on-tertiary-fixed: '#370e00'
  on-tertiary-fixed-variant: '#7f2b00'
  background: '#f8f9ff'
  on-background: '#121c2a'
  surface-variant: '#d9e3f6'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-bold:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '600'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  container-margin: 24px
  gutter: 16px
  card-padding: 24px
  section-gap: 32px
---

# TemuDosen Design System

## Brand Identity
TemuDosen is a warm, academic, and trustworthy platform for skripsi (thesis) supervision between students and academic advisors.

## Color Palette
- **Primary / Brand:** Amber `#F59E0B` — used for CTA buttons, logo, accents
- **Button text on amber background:** Always DARK `#1F2937` (NEVER white on amber)
- **Page background:** Warm gradient from `#FFFBEB` to `#FEF3C7`
- **Card background:** White `#FFFFFF` with subtle shadow and 12px border radius
- **Success / Selesai:** Green `#0E9F6E`
- **Error / Dibatalkan:** Red `#E02424`
- **Warning / Menunggu:** Orange `#EA580C`
- **Approved / Disetujui:** Blue `#1D4ED8`
- **Body text:** `#1F2937` (dark gray)
- **Muted text:** `#6B7280`

## CSS Variables (Source of Truth)
Disepakati 2026-07-01. Nilai di bawah ini adalah rujukan resmi untuk `frontend/src/index.css` — jika ada perbedaan antara prosa di atas dan blok ini, **blok ini yang berlaku**.

```css
:root {
  /* --- Brand (Amber) --- */
  --color-primary:        #F59E0B; /* amber 500 — fill tombol, aksen; JANGAN untuk teks di atas putih */
  --color-primary-hover:  #D97706; /* amber 600 — state hover/active tombol */
  --color-on-primary:     #1F2937; /* teks/ikon DI ATAS amber. Dark, bukan putih (putih gagal AA di amber) */
  --color-accent-link:    #B45309; /* amber 700 — teks link di atas putih (~5:1, lolos AA). Putih=F59E0B gagal */

  /* --- Surface & Teks --- */
  --color-background:        #FAFAF9; /* warm white, dashboard & layar konten */
  --color-surface:           #FFFFFF; /* kartu, panel */
  --color-on-surface:        #111827; /* teks utama */
  --color-on-surface-variant:#6B7280; /* teks sekunder/caption/label — alias dipertahankan */
  --color-border:            #E5E7EB;

  /* --- Warning (bg & teks DIPISAH, bukan opacity) --- */
  --color-warning-bg:   #FEF3C7;
  --color-warning-text: #92400E;

  /* --- Status Badge (semantik, LEPAS dari brand amber) --- */
  --color-status-pending-bg:    #FEF3C7; --color-status-pending-text:    #92400E; /* Menunggu */
  --color-status-approved-bg:   #DBEAFE; --color-status-approved-text:   #1E40AF; /* Disetujui (biru, sesuai keputusan) */
  --color-status-ongoing-bg:    #CCFBF1; --color-status-ongoing-text:    #0F766E; /* Berlangsung */
  --color-status-done-bg:       #D1FAE5; --color-status-done-text:       #065F46; /* Selesai */
  --color-status-cancelled-bg:  #FEE2E2; --color-status-cancelled-text:  #991B1B; /* Dibatalkan */

  /* --- Gradient auth (Opsi B: amber penuh, HANYA layar login/auth) --- */
  --gradient-auth: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
}
```

`--color-success` (`#0E9F6E`) dan `--color-error` (`#E02424`) generik tetap dipertahankan apa adanya di `index.css` untuk pemakaian non-badge (toast, validasi form, upload) — nilainya sudah identik dengan palet di atas dan tidak didefinisikan ulang di sini.

## Typography
- Headlines: Plus Jakarta Sans, bold, tight tracking
- Body: Inter, regular, comfortable line-height
- All UI text in Bahasa Indonesia

## Component Rules
- Primary CTA button: amber `#F59E0B` background, dark `#1F2937` text, bold, large (min 48px height), full rounded or 12px radius
- Cards: white, shadow-sm, border-radius 12px, generous padding (24px)
- Status badges: pill-shaped colored background
  - Menunggu: orange `#FEF3C7` bg, text `#EA580C`
  - Disetujui: blue `#DBEAFE` bg, text `#1D4ED8`
  - Selesai: green `#D1FAE5` bg, text `#065F46`
  - Dibatalkan: red `#FEE2E2` bg, text `#B91C1C`

## Accessibility
- Touch targets minimum 48x48px
- High contrast on all backgrounds

## Tone
- Clean, friendly, modern, spacious
- For non-technical university students