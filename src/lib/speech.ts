'use client';

import { useSyncExternalStore } from 'react';

import type { SpeechMetrics } from '@/types/interview';

/**
 * Speech analysis for the optional voice answer mode.
 *
 * Everything here runs in the browser on the transcript and its timing. The app never
 * uploads or stores audio — the recognised text is what gets sent to Gemma, exactly as if
 * the candidate had typed it, plus these delivery numbers as context.
 */

/** Filler phrases counted against delivery. Multi-word entries are matched first. */
const FILLERS = [
  'you know',
  'i mean',
  'sort of',
  'kind of',
  'i guess',
  'um',
  'uh',
  'erm',
  'ah',
  'like',
  'basically',
  'actually',
  'literally',
  'obviously',
  'right',
  'okay',
] as const;

/** A gap longer than this between recognition results counts as a long pause. */
const LONG_PAUSE_MS = 2500;

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

/**
 * Immediate word repetitions ("the the", "I I") are the only self-correction pattern that
 * can be counted without guessing, so that is the only one counted.
 */
function countRestarts(transcript: string): number {
  const words = transcript.toLowerCase().match(/\b[\w']+\b/g) ?? [];
  let restarts = 0;
  for (let i = 1; i < words.length; i += 1) {
    if (words[i] === words[i - 1] && words[i].length > 1) restarts += 1;
  }
  return restarts;
}

export function computeSpeechMetrics(
  transcript: string,
  durationSec: number,
  longPauseCount: number,
  longestPauseSec = 0,
): SpeechMetrics {
  const normalised = transcript.toLowerCase();
  const wordCount = countWords(transcript);

  const counts = FILLERS.map((filler) => {
    const pattern = new RegExp(`\\b${escapeForRegex(filler)}\\b`, 'g');
    return { word: filler, count: (normalised.match(pattern) ?? []).length };
  }).filter((entry) => entry.count > 0);

  counts.sort((a, b) => b.count - a.count);

  const safeDuration = Math.max(1, Math.round(durationSec));

  return {
    durationSec: safeDuration,
    wordCount,
    wordsPerMinute: Math.round((wordCount / safeDuration) * 60),
    fillerCount: counts.reduce((total, entry) => total + entry.count, 0),
    topFillers: counts.slice(0, 3),
    longPauseCount,
    longestPauseSec: Math.round(longestPauseSec * 10) / 10,
    restarts: countRestarts(transcript),
  };
}

/** One line of plain-English coaching on delivery, shown under the recorder. */
export function describeDelivery(metrics: SpeechMetrics): string {
  const notes: string[] = [];

  if (metrics.wordsPerMinute > 175) notes.push('you are speaking fast');
  else if (metrics.wordsPerMinute > 0 && metrics.wordsPerMinute < 105) notes.push('you are speaking slowly');

  if (metrics.fillerCount >= 6) notes.push(`${metrics.fillerCount} filler words`);
  else if (metrics.fillerCount > 0) notes.push(`${metrics.fillerCount} fillers`);

  if (metrics.longPauseCount >= 3) notes.push(`${metrics.longPauseCount} long pauses`);

  if (notes.length === 0) return 'Steady delivery.';
  return `${notes.join(', ')}.`;
}

export const LONG_PAUSE_THRESHOLD_MS = LONG_PAUSE_MS;

// --- Minimal typings for the Web Speech API -------------------------------------------
// Chrome exposes this as webkitSpeechRecognition and TypeScript's DOM lib does not ship
// types for it, so we declare only the surface this app uses.

export interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

export interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

/** Returns the browser's SpeechRecognition constructor, or null where it is unsupported. */
export function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const candidate = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

const subscribeToNothing = () => () => {};
const supportedOnClient = () => getSpeechRecognition() !== null;
const supportedOnServer = () => false;

/**
 * Whether this browser can transcribe speech. Read through `useSyncExternalStore` so the
 * server renders the typed-only view and the client corrects it after hydration.
 */
export function useSupportsSpeech(): boolean {
  return useSyncExternalStore(subscribeToNothing, supportedOnClient, supportedOnServer);
}
