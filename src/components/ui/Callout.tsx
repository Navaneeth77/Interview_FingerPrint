import type { ReactNode } from 'react';

import { Button } from '@/components/ui/Button';

interface CalloutProps {
  tone?: 'error' | 'note';
  title: string;
  children?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  busy?: boolean;
}

/**
 * Error and notice block. Failures always say what happened and, when the request is
 * worth repeating, offer a retry — the app never quietly swaps in canned content.
 */
export function Callout({
  tone = 'error',
  title,
  children,
  onRetry,
  retryLabel = 'Try again',
  busy = false,
}: CalloutProps) {
  const isError = tone === 'error';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={[
        'rounded-xl border px-4 py-3.5',
        isError ? 'border-flag/30 bg-flag-wash' : 'border-line bg-surface',
      ].join(' ')}
    >
      <p className={`text-sm font-medium ${isError ? 'text-flag' : 'text-ink'}`}>{title}</p>
      {children ? <div className="mt-1 text-sm text-ink-soft">{children}</div> : null}
      {onRetry ? (
        <Button variant="secondary" size="md" className="mt-3" onClick={onRetry} disabled={busy}>
          {busy ? 'Retrying…' : retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
