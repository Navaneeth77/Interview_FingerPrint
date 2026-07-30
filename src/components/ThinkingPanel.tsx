'use client';

import { useEffect, useState } from 'react';

import { Spinner } from '@/components/ui/Spinner';

interface ThinkingPanelProps {
  title: string;
  /** Ordered description of what the model is doing, cycled while the request is open. */
  steps: string[];
  intervalMs?: number;
}

/**
 * Shown while a Gemma call is in flight. Question generation and the final report take
 * 20-30 seconds, which is a long time to stare at a spinner — these lines describe the
 * work that single call is actually doing rather than inventing fake progress.
 */
export function ThinkingPanel({ title, steps, intervalMs = 5500 }: ThinkingPanelProps) {
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const stepTimer = setInterval(
      () => setIndex((current) => Math.min(current + 1, steps.length - 1)),
      intervalMs,
    );
    const clock = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => {
      clearInterval(stepTimer);
      clearInterval(clock);
    };
  }, [steps.length, intervalMs]);

  return (
    <div className="rounded-2xl border border-line bg-surface px-6 py-7">
      <div className="flex items-center gap-3">
        <Spinner className="size-4 text-accent" />
        <p className="font-display text-2xl leading-none">{title}</p>
        <span className="ml-auto font-mono text-xs text-muted">{elapsed}s</span>
      </div>

      <ol className="mt-5 space-y-2.5">
        {steps.map((step, stepIndex) => {
          const done = stepIndex < index;
          const active = stepIndex === index;
          return (
            <li
              key={step}
              className={[
                'flex items-start gap-2.5 text-sm transition-colors duration-300',
                active ? 'text-ink' : done ? 'text-muted' : 'text-muted/50',
              ].join(' ')}
            >
              <span
                className={[
                  'mt-1.5 size-1.5 shrink-0 rounded-full transition-colors duration-300',
                  active ? 'bg-accent' : done ? 'bg-line-strong' : 'bg-line',
                ].join(' ')}
              />
              {step}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
