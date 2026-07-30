'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { FrameSampler, FRAME_SAMPLE_INTERVAL_MS } from '@/lib/vision';
import { movementLevel, type VisualMetrics } from '@/types/interview';

interface CameraStageProps {
  /** Changes per question so movement is measured per answer. */
  questionKey: number;
  onMetrics: (metrics: VisualMetrics | undefined) => void;
  metrics?: VisualMetrics;
  /** Live movement readout only appears while an answer is being recorded. */
  recording: boolean;
}

type State = 'off' | 'starting' | 'on' | 'denied' | 'unavailable';

/**
 * The candidate's own camera, given the majority of the room.
 *
 * The movement measurement itself is the existing `FrameSampler` — unchanged. This
 * component only changes how large the camera is and where its numbers go: movement is
 * now stored per answer and becomes evidence in the report.
 */
export function CameraStage({ questionKey, onMetrics, metrics, recording }: CameraStageProps) {
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
        video: { width: 960, height: 720 },
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

  useEffect(() => {
    if (state !== 'on') return;

    const timer = setInterval(() => {
      const video = videoRef.current;
      const sampler = samplerRef.current;
      if (!video || !sampler) return;

      sampler.sample(video);
      const result = sampler.result();
      onMetrics(result ? { ...result, level: movementLevel(result.movementIndex) } : undefined);
    }, FRAME_SAMPLE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [state, onMetrics]);

  // Fresh measurements per question.
  useEffect(() => {
    samplerRef.current?.reset();
  }, [questionKey]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const live = state === 'on';

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[10px] border border-line bg-inset shadow-[var(--shadow-card)]">
      <video
        ref={videoRef}
        muted
        playsInline
        className={`size-full object-cover ${live ? 'block' : 'hidden'}`}
      />

      {!live ? (
        <div className="flex size-full flex-col items-center justify-center gap-4 px-6 text-center">
          <CameraGlyph />
          <div>
            <p className="text-sm text-ink-soft">
              {state === 'denied'
                ? 'Camera access was blocked.'
                : state === 'unavailable'
                  ? 'No camera available in this browser.'
                  : 'Practise on camera'}
            </p>
            <p className="mt-1 text-xs text-muted">
              {state === 'denied' || state === 'unavailable'
                ? 'The interview works exactly the same without it.'
                : 'Optional. Movement is measured in-page; no video is recorded or uploaded.'}
            </p>
          </div>
          {state !== 'denied' && state !== 'unavailable' ? (
            <button
              type="button"
              onClick={start}
              disabled={state === 'starting'}
              className="rounded-full border border-line-strong px-4 py-2 text-sm text-ink transition-colors hover:border-accent hover:bg-accent-wash disabled:opacity-60"
            >
              {state === 'starting' ? 'Starting…' : 'Turn on camera'}
            </button>
          ) : null}
        </div>
      ) : null}

      {live ? (
        <>
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/55 px-2.5 py-1 backdrop-blur-sm">
            <span className="size-1.5 animate-pulse rounded-full bg-accent" />
            <span className="font-mono text-[0.65rem] uppercase tracking-wider text-white/85">
              {recording && metrics ? 'tracking movement' : 'camera on'}
            </span>
          </div>

          <button
            type="button"
            onClick={stop}
            className="absolute right-3 top-3 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[0.65rem] uppercase tracking-wider text-white/85 backdrop-blur-sm transition-colors hover:bg-black/75"
          >
            turn off
          </button>
        </>
      ) : null}
    </div>
  );
}

function CameraGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect
        x="2.5"
        y="6"
        width="13"
        height="12"
        rx="2.5"
        stroke="var(--accent-moss)"
        strokeWidth="1.3"
      />
      <path
        d="M16 11l5-3v8l-5-3v-2z"
        stroke="var(--accent-moss)"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
