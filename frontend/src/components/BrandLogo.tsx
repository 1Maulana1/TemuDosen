/**
 * BrandLogo — logo TemuDosen: dua balon percakapan (gelap + amber) dengan
 * figur orang, diikuti wordmark dua warna ("Temu" gelap, "Dosen" amber).
 *
 * Warna mengikuti token tema di index.css (bukan warna logo asli navy/oranye):
 * - balon/teks gelap  → --color-on-primary (#1F2937)
 * - balon amber       → --color-primary (#F59E0B)
 * - "Dosen"           → --color-primary-hover (#D97706; amber lebih gelap agar
 *   tetap terbaca sebagai teks besar di atas putih — primary murni dilarang
 *   untuk teks di atas putih per DESIGN.md)
 *
 * Dipakai di halaman-halaman login dan header navigasi dashboard.
 */
export default function BrandLogo({
  textClassName = 'text-2xl',
  iconClassName = 'h-8',
  suffix,
}: {
  /** Kelas ukuran teks wordmark, mis. "text-2xl" (login) / "text-xl" (nav). */
  textClassName?: string;
  /** Kelas tinggi ikon, mis. "h-8" / "h-7". */
  iconClassName?: string;
  /** Sufiks setelah wordmark, mis. "Admin". */
  suffix?: string;
}) {
  return (
    <span
      role="img"
      aria-label={suffix ? `TemuDosen · ${suffix}` : 'TemuDosen'}
      className="inline-flex items-center gap-2"
    >
      <svg
        viewBox="0 0 40 31"
        aria-hidden="true"
        className={`${iconClassName} w-auto flex-shrink-0`}
      >
        {/* Balon kiri (gelap) + figur orang */}
        <path
          d="M5 1a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4h2v5l6-5h7a4 4 0 0 0 4-4V5a4 4 0 0 0-4-4H5z"
          fill="var(--color-on-primary)"
        />
        <circle cx="12.5" cy="7" r="2.4" fill="var(--color-surface)" />
        <path
          d="M8 13.5c0-2.3 2-3.7 4.5-3.7s4.5 1.4 4.5 3.7z"
          fill="var(--color-surface)"
        />
        {/* Balon kanan (amber) + figur orang */}
        <path
          d="M20 9a4 4 0 0 0-4 4v8a4 4 0 0 0 4 4h7l6 5v-5h2a4 4 0 0 0 4-4v-8a4 4 0 0 0-4-4H20z"
          fill="var(--color-primary)"
        />
        <circle cx="27.5" cy="15" r="2.4" fill="var(--color-surface)" />
        <path
          d="M23 21.5c0-2.3 2-3.7 4.5-3.7s4.5 1.4 4.5 3.7z"
          fill="var(--color-surface)"
        />
      </svg>
      <span aria-hidden="true" className={`font-headline font-bold ${textClassName}`}>
        <span className="text-on-primary">Temu</span>
        <span className="text-primary-hover">Dosen</span>
        {suffix ? <span className="text-on-surface-variant font-normal"> · {suffix}</span> : null}
      </span>
    </span>
  );
}
