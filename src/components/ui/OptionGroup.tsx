'use client';

interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface OptionGroupProps<T extends string> {
  legend: string;
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Renders a description line under each option instead of a compact pill row. */
  detailed?: boolean;
}

/** Segmented radio selector. Used for interview type and difficulty on the setup screen. */
export function OptionGroup<T extends string>({
  legend,
  options,
  value,
  onChange,
  detailed = false,
}: OptionGroupProps<T>) {
  return (
    <fieldset>
      <legend className="label-caps mb-2.5">{legend}</legend>
      <div className={detailed ? 'grid gap-2 sm:grid-cols-3' : 'flex flex-wrap gap-2'}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={[
                'rounded-lg border text-left transition-colors duration-150',
                detailed ? 'px-3.5 py-2.5' : 'px-3.5 py-2',
                selected
                  ? 'border-accent bg-accent-wash text-accent'
                  : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink',
              ].join(' ')}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              {detailed && option.hint ? (
                <span className={`mt-0.5 block text-xs ${selected ? 'text-accent/75' : 'text-muted'}`}>
                  {option.hint}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
