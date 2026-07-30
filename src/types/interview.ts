/**
 * Shared domain types for the interview session.
 * These shapes are produced by Gemma 4 (validated server-side) and rendered by the UI,
 * so they are the contract between `src/lib/schemas.ts` and the screens.
 */

export const INTERVIEW_TYPES = [
  'technical',
  'behavioral',
  'system-design',
  'hr-screen',
  'mixed',
] as const;

export type InterviewType = (typeof INTERVIEW_TYPES)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const INTERVIEW_TYPE_LABELS: Record<InterviewType, string> = {
  technical: 'Technical',
  behavioral: 'Behavioral',
  'system-design': 'System design',
  'hr-screen': 'HR screen',
  mixed: 'Mixed',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: 'Warm-up',
  medium: 'Standard',
  hard: 'Senior bar',
};

/** What the candidate tells us before the interview starts. */
export interface CandidateProfile {
  name: string;
  role: string;
  resume: string;
  jobDescription: string;
  interviewType: InterviewType;
  difficulty: Difficulty;
}

/** One Gemma-generated question, with the rationale it was asked for. */
export interface Question {
  id: number;
  question: string;
  /** Why an interviewer would ask this — surfaced in the UI as "why this question". */
  reason: string;
  difficulty: Difficulty;
  /** Short topic label, e.g. "Distributed systems". */
  focusArea: string;
  /** Which input the question was grounded in. */
  groundedIn: 'resume' | 'job-description' | 'both';
}

export type Verdict = 'strong' | 'solid' | 'developing' | 'weak';

/** Gemma's evaluation of a single answer. */
export interface Evaluation {
  /** All three are scored 0–10. */
  relevance: number;
  clarity: number;
  depth: number;
  verdict: Verdict;
  feedback: string;
  strengths: string[];
  improvements: string[];
  /** The follow-up a real interviewer would have asked next. */
  followUp: string;
}

/** Client-side speech signals from the optional voice answer mode. */
export interface SpeechMetrics {
  durationSec: number;
  wordCount: number;
  wordsPerMinute: number;
  fillerCount: number;
  topFillers: { word: string; count: number }[];
  longPauseCount: number;
}

/** Client-side webcam signals from the optional camera mode. */
export interface VisualMetrics {
  samples: number;
  facePresentPct: number;
  centeredPct: number;
  /** 0–100 index of head/torso movement. Higher = more restless. */
  movementIndex: number;
}

export interface AnswerRecord {
  questionId: number;
  question: string;
  answer: string;
  mode: 'typed' | 'voice';
  /** Seconds spent on this question. */
  durationSec: number;
  speech?: SpeechMetrics;
  visual?: VisualMetrics;
  evaluation?: Evaluation;
  /** Set when Gemma failed to score this answer; the report still renders. */
  evaluationError?: string;
}

export interface FingerprintDimension {
  name: string;
  /** 0–100. */
  score: number;
  note: string;
}

export interface ImprovementArea {
  area: string;
  why: string;
  action: string;
}

export interface NextSession {
  focus: string;
  interviewType: InterviewType;
  difficulty: Difficulty;
  drills: string[];
}

/** The final coaching report — the "Interview Fingerprint". */
export interface InterviewReport {
  overallScore: number;
  headline: string;
  fingerprint: {
    /** A short archetype label, e.g. "Hands-on builder, light on trade-offs". */
    label: string;
    summary: string;
    dimensions: FingerprintDimension[];
  };
  strengths: string[];
  weaknesses: string[];
  repeatedPatterns: string[];
  improvementAreas: ImprovementArea[];
  nextSession: NextSession;
}

/** The whole session, kept in the browser (sessionStorage) for V1 — no database. */
export interface InterviewSession {
  version: 1;
  createdAt: number;
  profile: CandidateProfile;
  questions: Question[];
  answers: AnswerRecord[];
  report?: InterviewReport;
  /** Model id that generated this session, shown in the UI for transparency. */
  model?: string;
}
