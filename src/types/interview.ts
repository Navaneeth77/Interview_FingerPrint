/**
 * Shared domain types for the interview session.
 *
 * V2 treats the interview as a dataset: every answer contributes content, speech and
 * visual evidence, and Gemma reasons across that evidence to produce the fingerprint.
 * Every V2 field is optional on the client types so a stored V1 session still renders.
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

/**
 * Question category is what makes the cross-question pattern engine possible: without it
 * the report can only average scores, instead of noticing that both weak answers happened
 * to be decision-justification questions.
 */
export const QUESTION_CATEGORIES = [
  'technical-implementation',
  'technical-decision',
  'system-design',
  'behavioral',
  'role-fit',
  'motivation',
] as const;

export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export const QUESTION_CATEGORY_LABELS: Record<QuestionCategory, string> = {
  'technical-implementation': 'Implementation',
  'technical-decision': 'Decision & trade-offs',
  'system-design': 'System design',
  behavioral: 'Behavioural',
  'role-fit': 'Role fit',
  motivation: 'Motivation',
};

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

export interface CandidateProfile {
  name: string;
  role: string;
  resume: string;
  jobDescription: string;
  interviewType: InterviewType;
  difficulty: Difficulty;
}

/** Traceability: which line of the resume and of the JD produced this question. */
export interface QuestionProvenance {
  resumeEvidence: string;
  jobDescriptionEvidence: string;
}

export interface Question {
  id: number;
  question: string;
  reason: string;
  difficulty: Difficulty;
  focusArea: string;
  groundedIn: 'resume' | 'job-description' | 'both';
  category?: QuestionCategory;
  provenance?: QuestionProvenance;
}

export type Verdict = 'strong' | 'solid' | 'developing' | 'weak';

/** KSA for technical questions, STAR for behavioural — Gemma picks, or neither. */
export interface FrameworkComponent {
  name: string;
  present: boolean;
  note: string;
}

export interface FrameworkAssessment {
  framework: 'KSA' | 'STAR' | 'none';
  components: FrameworkComponent[];
  coaching: string;
}

export interface Evaluation {
  relevance: number;
  clarity: number;
  depth: number;
  verdict: Verdict;
  feedback: string;
  strengths: string[];
  improvements: string[];
  followUp: string;
  /** V2: whether a single probing follow-up is actually worth asking. */
  followUpWorthAsking?: boolean;
  framework?: FrameworkAssessment;
  /** V2 sub-scores, 0-10, feeding the hierarchical assessment. */
  reasoning?: number;
  evidenceUse?: number;
  structure?: number;
  directness?: number;
  conciseness?: number;
}

export interface SpeechMetrics {
  durationSec: number;
  wordCount: number;
  wordsPerMinute: number;
  fillerCount: number;
  topFillers: { word: string; count: number }[];
  longPauseCount: number;
  longestPauseSec?: number;
  /** Self-corrections/restarts, only counted where the pattern is unambiguous. */
  restarts?: number;
}

export type MovementLevel = 'low' | 'moderate' | 'high';

export interface VisualMetrics {
  samples: number;
  cameraOnPct: number;
  /** 0–100 index of frame-to-frame movement. Higher = more restless. */
  movementIndex: number;
  framingCenteredPct: number;
  level?: MovementLevel;
}

export interface AnswerRecord {
  questionId: number;
  question: string;
  answer: string;
  mode: 'typed' | 'voice';
  durationSec: number;
  speech?: SpeechMetrics;
  visual?: VisualMetrics;
  evaluation?: Evaluation;
  evaluationError?: string;
  category?: QuestionCategory;
  /** V2 adaptive probe: the one follow-up asked, and what the candidate said back. */
  followUpQuestion?: string;
  followUpAnswer?: string;
}

export interface FingerprintDimension {
  name: string;
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

// --- V2 report structures --------------------------------------------------------

/** One measured sub-dimension inside Content / Communication / Delivery. */
export interface AssessmentDimension {
  name: string;
  score: number;
  note: string;
}

export interface AssessmentGroup {
  name: string;
  score: number;
  summary: string;
  dimensions: AssessmentDimension[];
}

/** A relationship that repeats across questions — the core V2 differentiator. */
export interface ObservedPattern {
  title: string;
  observation: string;
  /** Question ids the conclusion is drawn from, so every claim stays traceable. */
  evidenceQuestionIds: number[];
  type: 'strength' | 'development';
}

export interface TimelineEntry {
  questionId: number;
  verdict: Verdict;
  contentNote: string;
  deliveryNote?: string;
  movementLevel?: MovementLevel;
}

export interface PracticePriority {
  what: string;
  evidence: string;
  whyItMatters: string;
  howToPractice: string;
}

export interface PracticePlanItem {
  problem: string;
  evidence: string;
  drill: string;
}

export interface EtiquettePoint {
  rule: string;
  why: string;
}

/** A concrete exercise generated from this candidate's actual weakness. */
export interface TrainingDrill {
  weakness: string;
  framework: string;
  practiceQuestion: string;
  answerOutline: string[];
}

export interface InterviewReport {
  overallScore: number;
  headline: string;
  fingerprint: {
    label: string;
    summary: string;
    dimensions: FingerprintDimension[];
  };
  strengths: string[];
  weaknesses: string[];
  nextSession: NextSession;
  /** V1 fields kept so older stored sessions still render. */
  repeatedPatterns?: string[];
  improvementAreas?: ImprovementArea[];
  /** V2 additions. */
  sessionSummary?: string;
  practicePriority?: PracticePriority;
  assessment?: AssessmentGroup[];
  patterns?: ObservedPattern[];
  timeline?: TimelineEntry[];
  etiquette?: EtiquettePoint[];
  practicePlan?: PracticePlanItem[];
  trainingDrill?: TrainingDrill;
}

export interface InterviewSession {
  version: 1;
  createdAt: number;
  profile: CandidateProfile;
  questions: Question[];
  answers: AnswerRecord[];
  report?: InterviewReport;
  model?: string;
}

/** Shared thresholds so the UI and the prompts describe movement identically. */
export function movementLevel(index: number): MovementLevel {
  if (index >= 55) return 'high';
  if (index >= 25) return 'moderate';
  return 'low';
}
