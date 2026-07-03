/**
 * SymptomChips component — multi-select chip group for the submission form (S-07).
 *
 * UI-SPEC states:
 * - Unselected: border border-gray-200 bg-white text-slate-600 font-medium
 * - Selected: border-2 border-primary bg-primary text-on-primary font-bold shadow-md shadow-primary/20
 * - Hover (unselected): hover:border-primary/50
 * - Min 1 chip required; caller gates the submit CTA
 *
 * Accessibility:
 * - Each chip is a <button> with type="button" so it doesn't submit the form
 * - aria-pressed reflects selected state
 * - Minimum 44×44px touch target (min-h-[44px] min-w-[44px])
 */

import type { SymptomCategory } from '../api/symptoms';

interface SymptomChipsProps {
  symptoms: SymptomCategory[];
  selectedIds: number[];
  onChange: (selectedIds: number[]) => void;
  error?: string;
}

export default function SymptomChips({
  symptoms,
  selectedIds,
  onChange,
  error,
}: SymptomChipsProps) {
  const toggle = (id: number) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Gejala akademik"
      >
        {symptoms.map((symptom) => {
          const isSelected = selectedIds.includes(symptom.id);
          return (
            <button
              key={symptom.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggle(symptom.id)}
              className={[
                'px-3 py-2 rounded-full text-xs min-h-[44px] min-w-[44px]',
                'transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                isSelected
                  ? 'border-2 border-primary bg-primary text-on-primary font-bold shadow-md shadow-primary/20'
                  : 'border border-gray-200 bg-white text-slate-600 font-normal hover:border-primary/50',
              ].join(' ')}
            >
              {symptom.name}
            </button>
          );
        })}
      </div>
      {error && (
        <p
          className="mt-1 text-xs text-error"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
}
