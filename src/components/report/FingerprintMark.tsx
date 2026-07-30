import type { FingerprintDimension } from '@/types/interview';

/**
 * The fingerprint mark itself: one arc per scored dimension, each sweeping in proportion
 * to its score and offset slightly from the last. Two candidates never get the same shape,
 * and the shape is drawn from the actual numbers rather than decoration.
 */
export function FingerprintMark({
  dimensions,
  size = 176,
}: {
  dimensions: FingerprintDimension[];
  size?: number;
}) {
  const center = size / 2;
  const rings = dimensions.slice(0, 5);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Fingerprint chart: ${rings.map((d) => `${d.name} ${d.score} out of 100`).join(', ')}`}
    >
      {rings.map((dimension, index) => {
        const radius = 20 + index * 15;
        const circumference = 2 * Math.PI * radius;
        // Floor the sweep so a zero score still shows a tick rather than vanishing.
        const sweep = Math.max(0.04, Math.min(1, dimension.score / 100)) * circumference;

        return (
          <g key={dimension.name} transform={`rotate(${-90 + index * 16} ${center} ${center})`}>
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="var(--color-line)"
              strokeWidth="5"
            />
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${sweep} ${circumference - sweep}`}
              opacity={0.4 + index * 0.13}
            />
          </g>
        );
      })}
    </svg>
  );
}
