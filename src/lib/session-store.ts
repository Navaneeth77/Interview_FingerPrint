'use client';

import { useCallback, useSyncExternalStore } from 'react';

import type { InterviewSession } from '@/types/interview';

/**
 * V1 keeps the whole interview in the browser. No database, no server-side session state
 * — which suits serverless and means resume text is never persisted anywhere we control.
 *
 * sessionStorage (not localStorage) is deliberate: the interview survives a refresh or an
 * accidental back-navigation, and disappears when the tab closes.
 *
 * It is exposed through `useSyncExternalStore` so React treats sessionStorage as what it
 * is — an external store — instead of copying it into state inside an effect.
 */

const STORAGE_KEY = 'interview-fingerprint:session:v1';

const listeners = new Set<() => void>();

/**
 * `useSyncExternalStore` requires a stable snapshot reference between reads, so the parsed
 * session is memoised against the raw string it came from.
 */
let cachedRaw: string | null = null;
let cachedSession: InterviewSession | null = null;

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Keep other tabs and the back/forward cache honest.
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function parse(raw: string | null): InterviewSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as InterviewSession;
    if (parsed?.version !== 1 || !Array.isArray(parsed.questions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadSession(): InterviewSession | null {
  if (typeof window === 'undefined') return null;

  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSession = parse(raw);
  }
  return cachedSession;
}

export function saveSession(session: InterviewSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Quota errors are not worth breaking the interview over.
  }
  emit();
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(STORAGE_KEY);
  emit();
}

/** Server render (and the hydration pass) always sees "no session yet". */
function serverSnapshot(): InterviewSession | null {
  return null;
}

/** True only after hydration, so we never redirect on the server's empty snapshot. */
const subscribeToNothing = () => () => {};
const hydratedOnClient = () => true;
const hydratedOnServer = () => false;

type Status = 'loading' | 'ready' | 'empty';

export function useInterviewSession() {
  const session = useSyncExternalStore(subscribe, loadSession, serverSnapshot);
  const hydrated = useSyncExternalStore(subscribeToNothing, hydratedOnClient, hydratedOnServer);

  const status: Status = !hydrated ? 'loading' : session ? 'ready' : 'empty';

  /** Applies an update to whatever is currently in storage, never a stale render closure. */
  const updateSession = useCallback(
    (updater: (current: InterviewSession) => InterviewSession) => {
      const current = loadSession();
      if (!current) return;
      saveSession(updater(current));
    },
    [],
  );

  const reset = useCallback(() => clearSession(), []);

  return { session, status, updateSession, reset };
}

/**
 * Carried from a finished report into the next setup screen, so "run this interview next"
 * pre-fills the same resume and job description at the difficulty Gemma recommended.
 */
export interface SessionPreset {
  role: string;
  resume: string;
  jobDescription: string;
  interviewType: InterviewSession['profile']['interviewType'];
  difficulty: InterviewSession['profile']['difficulty'];
}

const PRESET_KEY = 'interview-fingerprint:preset:v1';

export function savePreset(preset: SessionPreset): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PRESET_KEY, JSON.stringify(preset));
  } catch {
    // Non-fatal: the setup screen simply starts empty.
  }
}

/** Reads the preset and immediately clears it, so it only ever applies once. */
export function takePreset(): SessionPreset | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PRESET_KEY);
    window.sessionStorage.removeItem(PRESET_KEY);
    return raw ? (JSON.parse(raw) as SessionPreset) : null;
  } catch {
    return null;
  }
}
