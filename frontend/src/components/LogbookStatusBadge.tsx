/**
 * LogbookStatusBadge — SessionLogbook status badge (06-UI-SPEC.md
 * "SessionLogbook Status Badge Contract"). A DISTINCT vocabulary from
 * StatusBadge's queue-status union — do not merge the two.
 */
import type { LogbookStatus } from '../api/logbook';

const STATUS_STYLES: Record<LogbookStatus, string> = {
  pending: 'bg-status-pending-bg text-status-pending-text',
  transcribing: 'bg-status-ongoing-bg text-status-ongoing-text',
  summarizing: 'bg-status-ongoing-bg text-status-ongoing-text',
  ready_for_review: 'bg-status-approved-bg text-status-approved-text',
  approved: 'bg-status-done-bg text-status-done-text',
  failed: 'bg-status-cancelled-bg text-status-cancelled-text',
};

const STATUS_LABELS: Record<LogbookStatus, string> = {
  pending: 'Menunggu Diproses',
  transcribing: 'Mentranskripsi…',
  summarizing: 'Merangkum AI…',
  ready_for_review: 'Siap Ditinjau',
  approved: 'Disetujui',
  failed: 'Gagal Diproses',
};

const STATUS_ICONS: Record<LogbookStatus, string> = {
  pending: 'schedule',
  transcribing: 'graphic_eq',
  summarizing: 'auto_awesome',
  ready_for_review: 'rate_review',
  approved: 'check_circle',
  failed: 'error_outline',
};

const IN_PROGRESS: ReadonlySet<LogbookStatus> = new Set(['transcribing', 'summarizing']);

interface LogbookStatusBadgeProps {
  status: LogbookStatus;
  className?: string;
}

export default function LogbookStatusBadge({ status, className = '' }: LogbookStatusBadgeProps) {
  const style = STATUS_STYLES[status];
  const label = STATUS_LABELS[status];
  const icon = STATUS_ICONS[status];
  const inProgress = IN_PROGRESS.has(status);

  const badge = (
    <span className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-bold uppercase ${style} ${className}`}>
      {inProgress && (
        <span className={`material-symbols-outlined text-sm ${inProgress ? 'animate-pulse' : ''}`} aria-hidden="true">
          {icon}
        </span>
      )}
      {label}
    </span>
  );

  if (inProgress) {
    return (
      <span role="status" aria-live="polite">
        {badge}
      </span>
    );
  }

  return badge;
}
