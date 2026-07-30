'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { describePresence, FrameSampler, FRAME_SAMPLE_INTERVAL_MS } from '@/lib/vision';
import type { VisualMetrics } from '@/types/interview';

interface CameraPanelProps {
  /** Bumped by the parent when the question changes, so metrics restart per answer. */
  questionKey: number;
  onMetrics: (metrics: VisualMetrics | undefined) => void;
  metrics?: VisualMetrics;
}

type State = 'off' | 'starting' | 'on' | 'denied' | 'unavailable';

/**
 * Optional camera. Off by default, and the interview works identically without it.
 * Frames are sampled in-page to a 32×24 canvas and discarded — no video is recorded,
 * uploaded or stored, and nothing here attempts to read emotion or confidence.
 */
export function CameraPanel({ questionKey, onMetrics, metrics }: CameraPanelProps) {
  const [state, setState] = useState<State>('off');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samplerRef = useRef<FrameSampler | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    samplerRef.current = null;
    setState('off');
    onMetrics(undefined);
  }, [onMetrics]);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState('unavailable');
      return;
    }

    setState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 },
        audio: false,
      });
      streamRef.current = stream;
      samplerRef.current = new FrameSampler();
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setState('on');
    } catch {
      setState('denied');
    }
  }, []);

  // Sampling loop. Publishes metrics upward so they ride along with the answer.
  useEffect(() => {
    if (state !== 'on') return;

    const timer = setInterval(() => {
      const video = videoRef.current;
      const sampler = samplerRef.current;
      if (!video || !sampler) return;

      sampler.sample(video);
      onMetrics(sampler.result());
    }, FRAME_SAMPLE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [state, onMetrics]);

  // Fresh measurements for each question; the parent clears its own copy on submit.
  useEffect(() => {
    samplerRef.current?.reset();
  }, [questionKey]);

  // Never leave the camera running after leaving the interview.
  useEffect(() => {
    return () => streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={state === 'on' || state === 'starting' ? stop : start}
        className={[
          'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors',
          state === 'on'
            ? 'border-accent bg-accent-wash text-accent'
            : 'border-line-strong bg-surface text-ink-soft hover:border-ink hover:text-ink',
        ].join(' ')}
      >
        <span
          className={[
            'size-2 rounded-full',
            state === 'on' ? 'animate-pulse bg-accent' : 'bg-line-strong',
          ].join(' ')}
        />
        {state === 'on' ? 'Camera on — turn off' : state === 'starting' ? 'Starting…' : 'Practise on camera'}
      </button>

      {/* Kept mounted but tiny: the candidate can see their framing, which is the point. */}
      <video
        ref={videoRef}
        muted
        playsInline
        className={[
          'h-16 w-[5.5rem] rounded-lg border border-line object-cover',
          state === 'on' ? 'block' : 'hidden',
        ].join(' ')}
      />

      {state === 'on' && metrics ? (
        <span className="hidden font-mono text-[0.7rem] text-muted lg:inline">
          movement {metrics.movementIndex}/100 · {describePresence(metrics)}
        </span>
      ) : null}

      {state === 'denied' ? (
        <span className="text-xs text-flag">
          Camera access was blocked. The interview works exactly the same without it.
        </span>
      ) : null}

      {state === 'unavailable' ? (
        <span className="text-xs text-muted">No camera available in this browser.</span>
      ) : null}
    </div>
  );
}
