/**
 * StatusBadge component (UI-SPEC Status Badge Contract).
 *
 * Always pairs color WITH text — never color alone (Accessibility Contract).
 * Styles: rounded (4px), px-2 py-1, text-[11px] font-bold uppercase.
 */

type BadgeStatus = 'MENUNGGU' | 'DISETUJUI' | 'BERLANGSUNG' | 'SELESAI' | 'DIBATALKAN' | 'REVISI';

const STATUS_STYLES: Record<BadgeStatus, string> = {
  MENUNGGU: 'bg-warning/10 text-warning',
  DISETUJUI: 'bg-primary/10 text-primary',
  BERLANGSUNG: 'bg-success/10 text-success',
  SELESAI: 'bg-green-100 text-green-800',
  DIBATALKAN: 'bg-error/10 text-error',
  REVISI: 'bg-orange-100 text-orange-700',
};

interface StatusBadgeProps {
  status: BadgeStatus;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES['MENUNGGU'];

  return (
    <span
      className={`inline-block rounded px-2 py-1 text-[11px] font-bold uppercase ${style} ${className}`}
    >
      {status}
    </span>
  );
}
