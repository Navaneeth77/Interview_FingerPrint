import { z } from 'zod';

import type { ResponseSchema } from '@/lib/gemma';
import { DIFFICULTIES, INTERVIEW_TYPES } from '@/types/interview';

/**
 * Two layers of validation:
 *  1. `*RequestSchema` — validates and clamps what the browser sends us (defence against
 *     oversized or malformed payloads).
 *  2. `*ResponseSchema` (+ the matching `gemma*Schema` JSON Schema) — validates what Gemma
 *     sends back, so a malformed model response becomes a clean error instead of a crash.
 */

/** Hard caps on user input. Generous enough for real resumes, small enough to stay cheap. */
export const LIMITS = {
  name: 80,
  role: 120,
  resume: 20_000,
  jobDescription: 12_000,
  question: 2_000,
  answer: 10_000,
  /** Max bytes accepted on any API route. */
  requestBytes: 256 * 1024,
} as const;

/**
 * Strips control characters that could corrupt prompts or logs (tabs and newlines are
 * kept, since pasted resumes are full of them) and trims surrounding whitespace.
 */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const cleanText = (max: number) =>
  z
    .string()
    .transform((value) => value.replace(CONTROL_CHARS, '').replace(/\n{4,}/g, '\n\n\n').trim())
    .pipe(z.string().max(max));

export const interviewTypeSchema = z.enum(INTERVIEW_TYPES);
export const difficultySchema = z.enum(DIFFICULTIES);

// ---------------------------------------------------------------------------
// Request schemas (browser -> our API)
// ---------------------------------------------------------------------------

export const generateRequestSchema = z.object({
  name: cleanText(LIMITS.name).optional().default(''),
  role: cleanText(LIMITS.role).optional().default(''),
  resume: cleanText(LIMITS.resume).pipe(z.string().min(60, 'Add a bit more resume detail (60+ characters).')),
  jobDescription: cleanText(LIMITS.jobDescription).pipe(
    z.string().min(40, 'Add a bit more job description detail (40+ characters).'),
  ),
  interviewType: interviewTypeSchema,
  difficulty: difficultySchema,
});

export type GenerateRequest = z.infer<typeof generateRequestSchema>;

export const speechMetricsSchema = z.object({
  durationSec: z.number().min(0).max(3600),
  wordCount: z.number().int().min(0).max(10_000),
  wordsPerMinute: z.number().min(0).max(500),
  fillerCount: z.number().int().min(0).max(1_000),
  topFillers: z
    .array(z.object({ word: z.string().max(24), count: z.number().int().min(0).max(500) }))
    .max(6),
  longPauseCount: z.number().int().min(0).max(500),
});

export const visualMetricsSchema = z.object({
  samples: z.number().int().min(0).max(10_000),
  cameraOnPct: z.number().min(0).max(100),
  movementIndex: z.number().min(0).max(100),
  framingCenteredPct: z.number().min(0).max(100),
});

export const evaluateRequestSchema = z.object({
  question: cleanText(LIMITS.question).pipe(z.string().min(5)),
  answer: cleanText(LIMITS.answer),
  context: z.object({
    role: cleanText(LIMITS.role).optional().default(''),
    interviewType: interviewTypeSchema,
    difficulty: difficultySchema,
    focusArea: cleanText(120).optional().default(''),
    jobDescription: cleanText(LIMITS.jobDescription).optional().default(''),
    speech: speechMetricsSchema.optional(),
  }),
});

export type EvaluateRequest = z.infer<typeof evaluateRequestSchema>;

const evaluationPayloadSchema = z.object({
  relevance: z.number().min(0).max(10),
  clarity: z.number().min(0).max(10),
  depth: z.number().min(0).max(10),
  verdict: z.enum(['strong', 'solid', 'developing', 'weak']),
  feedback: z.string().max(1_200),
  strengths: z.array(z.string().max(240)).max(4),
  improvements: z.array(z.string().max(240)).max(4),
  followUp: z.string().max(400),
});

export const reportRequestSchema = z.object({
  profile: z.object({
    name: cleanText(LIMITS.name).optional().default(''),
    role: cleanText(LIMITS.role).optional().default(''),
    resume: cleanText(LIMITS.resume),
    jobDescription: cleanText(LIMITS.jobDescription),
    interviewType: interviewTypeSchema,
    difficulty: difficultySchema,
  }),
  answers: z
    .array(
      z.object({
        questionId: z.number().int().min(0).max(100),
        question: cleanText(LIMITS.question),
        answer: cleanText(LIMITS.answer),
        mode: z.enum(['typed', 'voice']).default('typed'),
        durationSec: z.number().min(0).max(3600).default(0),
        speech: speechMetricsSchema.optional(),
        visual: visualMetricsSchema.optional(),
        evaluation: evaluationPayloadSchema.optional(),
      }),
    )
    .min(1, 'At least one answered question is required.')
    .max(12),
});

export type ReportRequest = z.infer<typeof reportRequestSchema>;

// ---------------------------------------------------------------------------
// Gemma response schemas (Gemini `responseSchema` + zod validation of the result)
// ---------------------------------------------------------------------------

export const gemmaQuestionsSchema: ResponseSchema = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'Sequential, starting at 1' },
          question: { type: 'string', description: 'The question, asked in the interviewer voice' },
          reason: { type: 'string', description: 'One sentence: what this question tests' },
          difficulty: { type: 'string', enum: [...DIFFICULTIES] },
          focusArea: { type: 'string', description: 'Two to three word topic label' },
          groundedIn: { type: 'string', enum: ['resume', 'job-description', 'both'] },
        },
        required: ['id', 'question', 'reason', 'difficulty', 'focusArea', 'groundedIn'],
        propertyOrdering: ['id', 'question', 'reason', 'difficulty', 'focusArea', 'groundedIn'],
      },
    },
  },
  required: ['questions'],
};

export const questionsResponseSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.number().int(),
        question: z.string().min(5).max(600),
        reason: z.string().max(300),
        difficulty: difficultySchema,
        focusArea: z.string().max(60),
        groundedIn: z.enum(['resume', 'job-description', 'both']),
      }),
    )
    .min(3)
    .max(8),
});

export const gemmaEvaluationSchema: ResponseSchema = {
  type: 'object',
  properties: {
    relevance: { type: 'integer', description: '0-10: did the answer address the question asked' },
    clarity: { type: 'integer', description: '0-10: structure and communication' },
    depth: { type: 'integer', description: '0-10: technical or situational substance' },
    verdict: { type: 'string', enum: ['strong', 'solid', 'developing', 'weak'] },
    feedback: { type: 'string', description: '2-3 sentences of direct, specific coaching' },
    strengths: { type: 'array', items: { type: 'string' } },
    improvements: { type: 'array', items: { type: 'string' } },
    followUp: { type: 'string', description: 'The follow-up a real interviewer would ask next' },
  },
  required: [
    'relevance',
    'clarity',
    'depth',
    'verdict',
    'feedback',
    'strengths',
    'improvements',
    'followUp',
  ],
  propertyOrdering: [
    'relevance',
    'clarity',
    'depth',
    'verdict',
    'feedback',
    'strengths',
    'improvements',
    'followUp',
  ],
};

export const evaluationResponseSchema = evaluationPayloadSchema;

export const gemmaReportSchema: ResponseSchema = {
  type: 'object',
  properties: {
    overallScore: { type: 'integer', description: '0-100 overall interview performance' },
    headline: { type: 'string', description: 'One sentence verdict the candidate will remember' },
    fingerprint: {
      type: 'object',
      properties: {
        label: { type: 'string', description: 'Short archetype, e.g. "Hands-on builder, light on trade-offs"' },
        summary: { type: 'string', description: '2-3 sentences describing how this candidate interviews' },
        dimensions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              score: { type: 'integer', description: '0-100' },
              note: { type: 'string', description: 'One short sentence of evidence' },
            },
            required: ['name', 'score', 'note'],
            propertyOrdering: ['name', 'score', 'note'],
          },
        },
      },
      required: ['label', 'summary', 'dimensions'],
      propertyOrdering: ['label', 'summary', 'dimensions'],
    },
    strengths: { type: 'array', items: { type: 'string' } },
    weaknesses: { type: 'array', items: { type: 'string' } },
    repeatedPatterns: {
      type: 'array',
      items: { type: 'string' },
      description: 'Habits that showed up across multiple answers',
    },
    improvementAreas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          area: { type: 'string' },
          why: { type: 'string', description: 'Evidence from this interview' },
          action: { type: 'string', description: 'A concrete thing to practise' },
        },
        required: ['area', 'why', 'action'],
        propertyOrdering: ['area', 'why', 'action'],
      },
    },
    nextSession: {
      type: 'object',
      properties: {
        focus: { type: 'string' },
        interviewType: { type: 'string', enum: [...INTERVIEW_TYPES] },
        difficulty: { type: 'string', enum: [...DIFFICULTIES] },
        drills: { type: 'array', items: { type: 'string' } },
      },
      required: ['focus', 'interviewType', 'difficulty', 'drills'],
      propertyOrdering: ['focus', 'interviewType', 'difficulty', 'drills'],
    },
  },
  required: [
    'overallScore',
    'headline',
    'fingerprint',
    'strengths',
    'weaknesses',
    'repeatedPatterns',
    'improvementAreas',
    'nextSession',
  ],
  propertyOrdering: [
    'overallScore',
    'headline',
    'fingerprint',
    'strengths',
    'weaknesses',
    'repeatedPatterns',
    'improvementAreas',
    'nextSession',
  ],
};

export const reportResponseSchema = z.object({
  overallScore: z.number().min(0).max(100),
  headline: z.string().max(400),
  fingerprint: z.object({
    label: z.string().max(120),
    summary: z.string().max(800),
    dimensions: z
      .array(
        z.object({
          name: z.string().max(60),
          score: z.number().min(0).max(100),
          note: z.string().max(300),
        }),
      )
      .min(3)
      .max(6),
  }),
  strengths: z.array(z.string().max(300)).max(6),
  weaknesses: z.array(z.string().max(300)).max(6),
  repeatedPatterns: z.array(z.string().max(300)).max(6),
  improvementAreas: z
    .array(
      z.object({
        area: z.string().max(120),
        why: z.string().max(400),
        action: z.string().max(400),
      }),
    )
    .max(5),
  nextSession: z.object({
    focus: z.string().max(300),
    interviewType: interviewTypeSchema,
    difficulty: difficultySchema,
    drills: z.array(z.string().max(240)).max(6),
  }),
});

/** Turns a zod result into the `validate` callback shape `generateJson` expects. */
export function zodValidator<T>(schema: z.ZodType<T>) {
  return (value: unknown): T | null => {
    const result = schema.safeParse(value);
    return result.success ? result.data : null;
  };
}
