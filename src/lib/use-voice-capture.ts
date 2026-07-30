'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  computeSpeechMetrics,
  getSpeechRecognition,
  LONG_PAUSE_THRESHOLD_MS,
  type SpeechRecognitionLike,
} from '@/lib/speech';
import type { SpeechMetrics } from '@/types/interview';

export type VoiceState = 'idle' | 'recording' | 'denied' | 'error';

export interface VoiceCapture {
  state: VoiceState;
  /** Seconds elapsed in the current recording. */
  elapsed: number;
  /** Final + interim transcript so far. */
  transcript: string;
  metrics?: SpeechMetrics;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

/**
 * Speaking is the primary way to answer, so the recorder is a hook the Interview Room
 * drives directly rather than a self-contained widget.
 *
 * The browser performs recognition and this hook only ever handles text — no audio is
 * recorded, uploaded or stored. If recognition is unavailable or refused, the room falls
 * back to typing with no loss of function.
 */
export function useVoiceCapture(onTranscript: (text: string) => void): VoiceCapture {
  const [state, setState] = useState<VoiceState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [metrics, setMetrics] = useState<SpeechMetrics | undefined>(undefined);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTextRef = useRef('');
  const startedAtRef = useRef(0);
  const lastResultAtRef = useRef(0);
  const longPausesRef = useRef(0);
  const longestPauseRef = useRef(0);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    if (state !== 'recording') return;
    const timer = setInterval(
      () => setElapsed(Math.round((Date.now() - startedAtRef.current) / 1000)),
      500,
    );
    return () => clearInterval(timer);
  }, [state]);

  // Never leave the microphone open when the room unmounts.
  useEffect(() => () => recognitionRef.current?.abort(), []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    finalTextRef.current = '';
    longPausesRef.current = 0;
    longestPauseRef.current = 0;
    setTranscript('');
    setMetrics(undefined);
    setElapsed(0);
  }, []);

  const start = useCallback(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setState('error');
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    finalTextRef.current = '';
    longPausesRef.current = 0;
    longestPauseRef.current = 0;
    startedAtRef.current = Date.now();
    lastResultAtRef.current = Date.now();
    setElapsed(0);
    setTranscript('');
    setMetrics(undefined);

    recognition.onresult = (event) => {
      const now = Date.now();
      const gap = now - lastResultAtRef.current;
      if (gap > LONG_PAUSE_THRESHOLD_MS) {
        longPausesRef.current += 1;
        longestPauseRef.current = Math.max(longestPauseRef.current, gap / 1000);
      }
      lastResultAtRef.current = now;

      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) finalTextRef.current += `${text.trim()} `;
        else interim += text;
      }

      const combined = (finalTextRef.current + interim).replace(/\s+/g, ' ').trim();
      setTranscript(combined);
      onTranscriptRef.current(combined);
    };

    recognition.onerror = (event) => {
      setState(
        event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'denied' : 'idle',
      );
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      const finalText = finalTextRef.current.replace(/\s+/g, ' ').trim();
      const duration = (Date.now() - startedAtRef.current) / 1000;

      if (finalText) {
        setTranscript(finalText);
        onTranscriptRef.current(finalText);
        setMetrics(
          computeSpeechMetrics(finalText, duration, longPausesRef.current, longestPauseRef.current),
        );
      }

      recognitionRef.current = null;
      setState((current) => (current === 'recording' ? 'idle' : current));
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setState('recording');
    } catch {
      setState('error');
    }
  }, []);

  return { state, elapsed, transcript, metrics, start, stop, reset };
}
