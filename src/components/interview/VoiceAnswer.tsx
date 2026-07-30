'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  computeSpeechMetrics,
  describeDelivery,
  getSpeechRecognition,
  LONG_PAUSE_THRESHOLD_MS,
  useSupportsSpeech,
  type SpeechRecognitionLike,
} from '@/lib/speech';
import type { SpeechMetrics } from '@/types/interview';

interface VoiceAnswerProps {
  /** Called with the running transcript so it lands in the answer box, still editable. */
  onTranscript: (text: string) => void;
  /** Called when recording stops, with the delivery numbers for this answer. */
  onMetrics: (metrics: SpeechMetrics | undefined) => void;
  metrics?: SpeechMetrics;
  disabled?: boolean;
}

type State = 'idle' | 'recording' | 'denied';

/**
 * Optional spoken answers. The browser does the recognition and this component only ever
 * handles text — no audio is recorded, uploaded or stored by the app.
 *
 * Everything here is additive: if the API is missing or the microphone is refused, the
 * typed answer box keeps working exactly as before.
 */
export function VoiceAnswer({ onTranscript, onMetrics, metrics, disabled }: VoiceAnswerProps) {
  const supported = useSupportsSpeech();
  const [state, setState] = useState<State>('idle');
  const [elapsed, setElapsed] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTextRef = useRef('');
  const startedAtRef = useRef(0);
  const lastResultAtRef = useRef(0);
  const longPausesRef = useRef(0);

  useEffect(() => {
    if (state !== 'recording') return;
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000)), 500);
    return () => clearInterval(timer);
  }, [state]);

  // Never leave the microphone open if the question changes or the page unmounts.
  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.stop();
  }, []);

  const start = useCallback(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    finalTextRef.current = '';
    longPausesRef.current = 0;
    startedAtRef.current = Date.now();
    lastResultAtRef.current = Date.now();
    setElapsed(0);
    onMetrics(undefined);

    recognition.onresult = (event) => {
      const now = Date.now();
      if (now - lastResultAtRef.current > LONG_PAUSE_THRESHOLD_MS) longPausesRef.current += 1;
      lastResultAtRef.current = now;

      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) finalTextRef.current += `${text.trim()} `;
        else interim += text;
      }

      onTranscript((finalTextRef.current + interim).replace(/\s+/g, ' ').trim());
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setState('denied');
      else setState('idle');
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      const transcript = finalTextRef.current.replace(/\s+/g, ' ').trim();
      const duration = (Date.now() - startedAtRef.current) / 1000;

      if (transcript) {
        onTranscript(transcript);
        onMetrics(computeSpeechMetrics(transcript, duration, longPausesRef.current));
      }

      recognitionRef.current = null;
      setState((current) => (current === 'recording' ? 'idle' : current));
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setState('recording');
    } catch {
      setState('idle');
    }
  }, [onMetrics, onTranscript]);

  if (!supported) {
    return (
      <p className="text-xs text-muted">
        Spoken answers need the Web Speech API — available in desktop Chrome. Typing works
        everywhere.
      </p>
    );
  }

  const recording = state === 'recording';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={disabled}
        aria-pressed={recording}
        className={[
          'inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors',
          recording
            ? 'border-flag bg-flag-wash text-flag'
            : 'border-line-strong bg-surface text-ink-soft hover:border-ink hover:text-ink',
        ].join(' ')}
      >
        <span
          className={[
            'size-2 rounded-full',
            recording ? 'animate-pulse bg-flag' : 'bg-line-strong',
          ].join(' ')}
        />
        {recording ? `Recording ${elapsed}s — stop` : 'Answer out loud'}
      </button>

      {recording ? (
        <span className="text-xs text-muted">
          Your microphone is live. Speech is transcribed by your browser; no audio is stored.
        </span>
      ) : null}

      {state === 'denied' ? (
        <span className="text-xs text-flag">
          Microphone access was blocked. Allow it in your browser, or just type.
        </span>
      ) : null}

      {!recording && metrics ? (
        <span className="font-mono text-[0.7rem] text-muted">
          {metrics.wordsPerMinute} wpm · {metrics.fillerCount} fillers · {describeDelivery(metrics)}
        </span>
      ) : null}
    </div>
  );
}
