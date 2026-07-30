'use client';

import { useEffect, useState } from 'react';

/**
 * Per-question stopwatch. Mounted with `key={index}` so each question gets a fresh timer
 * instead of the parent having to reset a counter.
 */
export function QuestionTimer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = Math.floor(seconds / 60);

  return (
    <span className="font-mono text-xs tabular-nums text-muted">
      {minutes}:{String(seconds % 60).padStart(2, '0')}
    </span>
  );
}
