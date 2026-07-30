interface ProgressRailProps {
  total: number;
  currentIndex: number;
  /** Number of answers Gemma has finished scoring. */
  scored: number;
}

/** Question tracker: filled = answered, ring = current, hollow = upcoming. */
export function ProgressRail({ total, currentIndex, scored }: ProgressRailProps) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1.5" aria-label={`Question ${currentIndex + 1} of ${total}`}>
        {Array.from({ length: total }, (_, index) => {
          const answered = index < currentIndex;
          const current = index === currentIndex;
          return (
            <span
              key={index}
              className={[
                'h-1.5 rounded-full transition-all duration-300',
                current ? 'w-7 bg-accent' : 'w-4',
                answered ? 'bg-accent/40' : current ? '' : 'bg-line-strong',
              ].join(' ')}
            />
          );
        })}
      </div>

      <span className="font-mono text-xs text-muted">
        {currentIndex + 1}/{total}
      </span>

      {scored > 0 ? (
        <span className="hidden font-mono text-xs text-muted sm:inline">
          · gemma scored {scored}
        </span>
      ) : null}
    </div>
  );
}
