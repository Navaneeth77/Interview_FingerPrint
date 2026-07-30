'use client';

import { useEffect, useState } from 'react';

import type { HealthResponseBody } from '@/app/api/health/route';

type State =
  | { kind: 'checking' }
  | { kind: 'live'; model: string; latencyMs: number }
  | { kind: 'down'; message: string };

/**
 * Live connectivity badge. It round-trips a real prompt through Gemma, so if the key or
 * model is misconfigured on Vercel it is visible on the landing page rather than at the
 * moment a judge clicks "Start interview".
 */
export function GemmaStatus() {
  const [state, setState] = useState<State>({ kind: 'checking' });

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/health', { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(payload?.error?.message ?? 'Gemma is unreachable.');
        }
        const health = payload as HealthResponseBody;
        setState({ kind: 'live', model: health.model, latencyMs: health.latencyMs });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({
          kind: 'down',
          message: error instanceof Error ? error.message : 'Gemma is unreachable.',
        });
      });

    return () => controller.abort();
  }, []);

  const dot =
    state.kind === 'live' ? 'bg-accent' : state.kind === 'down' ? 'bg-flag' : 'bg-line-strong';

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[0.7rem] tracking-wide text-ink-soft"
      title={state.kind === 'down' ? state.message : undefined}
    >
      <span className={`size-1.5 rounded-full ${dot} ${state.kind === 'checking' ? 'animate-pulse' : ''}`} />
      {state.kind === 'checking' && 'checking gemma…'}
      {state.kind === 'live' && `${state.model} · ${(state.latencyMs / 1000).toFixed(1)}s`}
      {state.kind === 'down' && 'gemma unreachable'}
    </span>
  );
}
