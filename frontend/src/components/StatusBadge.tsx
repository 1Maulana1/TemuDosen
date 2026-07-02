/**
 * StatusBadge component (UI-SPEC Status Badge Contract).
 *
 * Always pairs color WITH text — never color alone (Accessibility Contract).
 * Styles: rounded (4px), px-2 py-1, text-[11px] font-bold uppercase.
 */

type BadgeStatus = 'MENUNGGU' | 'DISETUJUI' | 'BERLANGSUNG' | 'SELESAI' | 'DIBATALKAN' | 'REVISI' | 'DITOLAK';

const STATUS_STYLES: Record<BadgeStatus, string> = {
  MENUNGGU: 'bg-status-pending-bg text-status-pending-text',
  DISETUJUI: 'bg-status-approved-bg text-status-approved-text',
  BERLANGSUNG: 'bg-status-ongoing-bg text-status-ongoing-text',
  SELESAI: 'bg-status-done-bg text-status-done-text',
  DIBATALKAN: 'bg-status-cancelled-bg text-status-cancelled-text',
  REVISI: 'bg-orange-100 text-orange-700',
  DITOLAK: 'bg-status-cancelled-bg text-status-cancelled-text',
};

// FR-D01: teks tampilan berbeda dari key internal (mis. REVISI → "Perlu Revisi").
const STATUS_LABELS: Record<BadgeStatus, string> = {
  MENUNGGU: 'Menunggu',
  DISETUJUI: 'Disetujui',
  BERLANGSUNG: 'Berlangsung',
  SELESAI: 'Selesai',
  DIBATALKAN: 'Dibatalkan',
  REVISI: 'Perlu Revisi',
  DITOLAK: 'Ditolak',
};

interface StatusBadgeProps {
  status: BadgeStatus;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES['MENUNGGU'];
  const label = STATUS_LABELS[status] ?? status;

  return (
    <span
      className={`inline-block rounded px-2 py-1 text-[11px] font-bold uppercase ${style} ${className}`}
    >
      {label}
    </span>
  );
}
