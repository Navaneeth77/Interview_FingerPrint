import Link from 'next/link';

import { GemmaStatus } from '@/components/GemmaStatus';

/** Wordmark + live model status. Present on every screen so the model is never hidden. */
export function SiteHeader({ showStatus = true }: { showStatus?: boolean }) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <FingerprintGlyph />
          <span className="font-display text-xl leading-none">Interview Fingerprint</span>
        </Link>
        {showStatus ? <GemmaStatus /> : null}
      </div>
    </header>
  );
}

function FingerprintGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {[3, 6.5, 10].map((radius, index) => (
        <circle
          key={radius}
          cx="12"
          cy="12"
          r={radius}
          stroke="var(--color-accent)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeDasharray={`${radius * 4.4} ${radius * 1.9}`}
          transform={`rotate(${index * 55} 12 12)`}
        />
      ))}
    </svg>
  );
}
