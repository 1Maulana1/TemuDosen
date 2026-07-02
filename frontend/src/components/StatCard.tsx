/**
 * StatCard — small metric card used on dashboard headers (icon + label + value).
 */
interface StatCardProps {
  icon: string;
  label: string;
  value: number | string;
}

export default function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="bg-surface rounded-2xl border border-gray-200 p-5 flex items-center gap-4 shadow-sm">
      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span className="material-symbols-outlined text-primary text-2xl" aria-hidden="true">
          {icon}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-xs text-on-surface-variant truncate">{label}</p>
        <p className="font-headline font-bold text-2xl text-on-surface">{value}</p>
      </div>
    </div>
  );
}
