import { z } from 'zod';

import type { ResponseSchema } from '@/lib/gemma';
import { DIFFICULTIES, INTERVIEW_TYPES, QUESTION_CATEGORIES } from '@/types/interview';

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
  /** Max bytes accepted on any JSON API route. */
  requestBytes: 512 * 1024,
  /** Max bytes accepted for an uploaded document. */
  uploadBytes: 8 * 1024 * 1024,
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
export const questionCategorySchema = z.enum(QUESTION_CATEGORIES);

// ---------------------------------------------------------------------------
// Request schemas (browser -> our API)
// ---------------------------------------------------------------------------

export const generateRequestSchema = z.object({
  name: cleanText(LIMITS.name).optional().default(''),
  role: cleanText(LIMITS.role).optional().default(''),
  resume: cleanText(LIMITS.resume).pipe(
    z.string().min(60, 'Add a bit more resume detail (60+ characters).'),
  ),
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
  longestPauseSec: z.number().min(0).max(600).optional(),
  restarts: z.number().int().min(0).max(200).optional(),
});

export const visualMetricsSchema = z.object({
  samples: z.number().int().min(0).max(100_000),
  cameraOnPct: z.number().min(0).max(100),
  movementIndex: z.number().min(0).max(100),
  framingCenteredPct: z.number().min(0).max(100),
  level: z.enum(['low', 'moderate', 'high']).optional(),
});

export const evaluateRequestSchema = z.object({
  question: cleanText(LIMITS.question).pipe(z.string().min(5)),
  answer: cleanText(LIMITS.answer),
  context: z.object({
    role: cleanText(LIMITS.role).optional().default(''),
    interviewType: interviewTypeSchema,
    difficulty: difficultySchema,
    focusArea: cleanText(120).optional().default(''),
    category: questionCategorySchema.optional(),
    jobDescription: cleanText(LIMITS.jobDescription).optional().default(''),
    speech: speechMetricsSchema.optional(),
    /** Included so a follow-up answer is scored alongside the original. */
    followUpQuestion: cleanText(LIMITS.question).optional(),
    followUpAnswer: cleanText(LIMITS.answer).optional(),
  }),
});

export type EvaluateRequest = z.infer<typeof evaluateRequestSchema>;

const frameworkAssessmentSchema = z.object({
  framework: z.enum(['KSA', 'STAR', 'none']),
  components: z
    .array(
      z.object({
        name: z.string().max(40),
        present: z.boolean(),
        note: z.string().max(300),
      }),
    )
    .max(4),
  coaching: z.string().max(600),
});

const evaluationPayloadSchema = z.object({
  relevance: z.number().min(0).max(10),
  clarity: z.number().min(0).max(10),
  depth: z.number().min(0).max(10),
  reasoning: z.number().min(0).max(10),
  evidenceUse: z.number().min(0).max(10),
  structure: z.number().min(0).max(10),
  directness: z.number().min(0).max(10),
  conciseness: z.number().min(0).max(10),
  verdict: z.enum(['strong', 'solid', 'developing', 'weak']),
  feedback: z.string().max(1_400),
  strengths: z.array(z.string().max(240)).max(4),
  improvements: z.array(z.string().max(240)).max(4),
  followUp: z.string().max(400),
  followUpWorthAsking: z.boolean(),
  framework: frameworkAssessmentSchema,
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
        category: questionCategorySchema.optional(),
        speech: speechMetricsSchema.optional(),
        visual: visualMetricsSchema.optional(),
        evaluation: evaluationPayloadSchema.partial().optional(),
        followUpQuestion: cleanText(LIMITS.question).optional(),
        followUpAnswer: cleanText(LIMITS.answer).optional(),
      }),
    )
    .min(1, 'At least one answered question is required.')
    .max(12),
});

export type ReportRequest = z.infer<typeof reportRequestSchema>;

// ---------------------------------------------------------------------------
// Gemma response schemas
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
          question: { type: 'string', description: 'The question, in the interviewer voice' },
          reason: { type: 'string', description: 'One sentence: what this question tests' },
          difficulty: { type: 'string', enum: [...DIFFICULTIES] },
          focusArea: { type: 'string', description: 'Two to three word topic label' },
          groundedIn: { type: 'string', enum: ['resume', 'job-description', 'both'] },
          category: { type: 'string', enum: [...QUESTION_CATEGORIES] },
          provenance: {
            type: 'object',
            properties: {
              resumeEvidence: {
                type: 'string',
                description: 'Short quote from the resume that prompted this, or empty string',
              },
              jobDescriptionEvidence: {
                type: 'string',
                description: 'Short quote from the job description, or empty string',
              },
            },
            required: ['resumeEvidence', 'jobDescriptionEvidence'],
            propertyOrdering: ['resumeEvidence', 'jobDescriptionEvidence'],
          },
        },
        required: [
          'id',
          'question',
          'reason',
          'difficulty',
          'focusArea',
          'groundedIn',
          'category',
          'provenance',
        ],
        propertyOrdering: [
          'id',
          'question',
          'reason',
          'difficulty',
          'focusArea',
          'groundedIn',
          'category',
          'provenance',
        ],
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
        category: questionCategorySchema,
        provenance: z.object({
          resumeEvidence: z.string().max(240),
          jobDescriptionEvidence: z.string().max(240),
        }),
      }),
    )
    .min(3)
    .max(8),
});

const scored = (description: string): ResponseSchema => ({ type: 'integer', description });

export const gemmaEvaluationSchema: ResponseSchema = {
  type: 'object',
  properties: {
    relevance: scored('0-10: did the answer address the question actually asked'),
    clarity: scored('0-10: is it easy to follow'),
    depth: scored('0-10: technical or situational substance'),
    reasoning: scored('0-10: quality of justification, alternatives and trade-off thinking'),
    evidenceUse: scored('0-10: concrete examples, numbers and outcomes'),
    structure: scored('0-10: is the answer organised, with a clear shape'),
    directness: scored('0-10: does it get to the point rather than circling'),
    conciseness: scored('0-10: appropriate length for the question'),
    verdict: { type: 'string', enum: ['strong', 'solid', 'developing', 'weak'] },
    feedback: { type: 'string', description: '2-3 sentences of direct, specific coaching' },
    strengths: { type: 'array', items: { type: 'string' } },
    improvements: { type: 'array', items: { type: 'string' } },
    followUp: { type: 'string', description: 'The follow-up a real interviewer would ask next' },
    followUpWorthAsking: {
      type: 'boolean',
      description: 'True only if the answer left a specific gap one probe would resolve',
    },
    framework: {
      type: 'object',
      properties: {
        framework: {
          type: 'string',
          enum: ['KSA', 'STAR', 'none'],
          description: 'KSA for technical questions, STAR for behavioural, none if neither fits',
        },
        components: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Knowledge/Skills/Abilities or S/T/A/R' },
              present: { type: 'boolean' },
              note: { type: 'string' },
            },
            required: ['name', 'present', 'note'],
            propertyOrdering: ['name', 'present', 'note'],
          },
        },
        coaching: { type: 'string', description: 'One or two sentences on the missing component' },
      },
      required: ['framework', 'components', 'coaching'],
      propertyOrdering: ['framework', 'components', 'coaching'],
    },
  },
  required: [
    'relevance',
    'clarity',
    'depth',
    'reasoning',
    'evidenceUse',
    'structure',
    'directness',
    'conciseness',
    'verdict',
    'feedback',
    'strengths',
    'improvements',
    'followUp',
    'followUpWorthAsking',
    'framework',
  ],
};

export const evaluationResponseSchema = evaluationPayloadSchema;

const dimensionSchema: ResponseSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    score: { type: 'integer', description: '0-100' },
    note: { type: 'string', description: 'One sentence of evidence from the transcript' },
  },
  required: ['name', 'score', 'note'],
  propertyOrdering: ['name', 'score', 'note'],
};

export const gemmaAssessmentSchema: ResponseSchema = {
  type: 'object',
  properties: {
    overallScore: { type: 'integer', description: '0-100 overall interview performance' },
    headline: { type: 'string', description: 'One sentence the candidate will remember' },
    sessionSummary: { type: 'string', description: '2-4 sentences summarising the session' },
    fingerprint: {
      type: 'object',
      properties: {
        label: { type: 'string', description: 'Short archetype, 3-7 words' },
        summary: { type: 'string', description: '2-3 sentences on how this person interviews' },
        dimensions: { type: 'array', items: dimensionSchema },
      },
      required: ['label', 'summary', 'dimensions'],
      propertyOrdering: ['label', 'summary', 'dimensions'],
    },
    assessment: {
      type: 'array',
      description: 'Exactly three groups: Content, Communication, Delivery',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', enum: ['Content', 'Communication', 'Delivery'] },
          score: { type: 'integer', description: '0-100' },
          summary: { type: 'string' },
          dimensions: { type: 'array', items: dimensionSchema },
        },
        required: ['name', 'score', 'summary', 'dimensions'],
        propertyOrdering: ['name', 'score', 'summary', 'dimensions'],
      },
    },
    strengths: { type: 'array', items: { type: 'string' } },
    weaknesses: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'overallScore',
    'headline',
    'sessionSummary',
    'fingerprint',
    'assessment',
    'strengths',
    'weaknesses',
  ],
};

/** Second half: the coaching narrative, requested in parallel with the assessment. */
export const gemmaCoachingSchema: ResponseSchema = {
  type: 'object',
  properties: {
    practicePriority: {
      type: 'object',
      properties: {
        what: { type: 'string', description: 'The single highest-impact improvement' },
        evidence: { type: 'string', description: 'Which questions show it' },
        whyItMatters: { type: 'string', description: 'Why it matters for this specific role' },
        howToPractice: { type: 'string', description: 'A concrete way to practise it' },
      },
      required: ['what', 'evidence', 'whyItMatters', 'howToPractice'],
      propertyOrdering: ['what', 'evidence', 'whyItMatters', 'howToPractice'],
    },
    patterns: {
      type: 'array',
      description: 'Only relationships visible in more than one answer',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short name for the pattern' },
          observation: { type: 'string', description: 'Evidence-bound, no psychology' },
          evidenceQuestionIds: { type: 'array', items: { type: 'integer' } },
          type: { type: 'string', enum: ['strength', 'development'] },
        },
        required: ['title', 'observation', 'evidenceQuestionIds', 'type'],
        propertyOrdering: ['title', 'observation', 'evidenceQuestionIds', 'type'],
      },
    },
    timeline: {
      type: 'array',
      description: 'One entry per question, in order',
      items: {
        type: 'object',
        properties: {
          questionId: { type: 'integer' },
          verdict: { type: 'string', enum: ['strong', 'solid', 'developing', 'weak'] },
          contentNote: { type: 'string', description: 'A few words on the content' },
          deliveryNote: { type: 'string', description: 'A few words on delivery, or empty' },
        },
        required: ['questionId', 'verdict', 'contentNote', 'deliveryNote'],
        propertyOrdering: ['questionId', 'verdict', 'contentNote', 'deliveryNote'],
      },
    },
    etiquette: {
      type: 'array',
      description: 'Only etiquette points this session actually calls for',
      items: {
        type: 'object',
        properties: {
          rule: { type: 'string' },
          why: { type: 'string', description: 'Tied to something that happened here' },
        },
        required: ['rule', 'why'],
        propertyOrdering: ['rule', 'why'],
      },
    },
    practicePlan: {
      type: 'array',
      description: 'At most three, ordered by impact',
      items: {
        type: 'object',
        properties: {
          problem: { type: 'string' },
          evidence: { type: 'string' },
          drill: { type: 'string' },
        },
        required: ['problem', 'evidence', 'drill'],
        propertyOrdering: ['problem', 'evidence', 'drill'],
      },
    },
    trainingDrill: {
      type: 'object',
      properties: {
        weakness: { type: 'string' },
        framework: { type: 'string', description: 'e.g. Problem -> Alternatives -> Choice -> Trade-off' },
        practiceQuestion: {
          type: 'string',
          description: "A question built from this candidate's own material",
        },
        answerOutline: {
          type: 'array',
          items: { type: 'string' },
          description: 'The beats a good answer would hit',
        },
      },
      required: ['weakness', 'framework', 'practiceQuestion', 'answerOutline'],
      propertyOrdering: ['weakness', 'framework', 'practiceQuestion', 'answerOutline'],
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
    'practicePriority',
    'patterns',
    'timeline',
    'etiquette',
    'practicePlan',
    'trainingDrill',
    'nextSession',
  ],
};

const zDimension = z.object({
  name: z.string().max(60),
  score: z.number().min(0).max(100),
  note: z.string().max(320),
});

export const assessmentResponseSchema = z.object({
  overallScore: z.number().min(0).max(100),
  headline: z.string().max(400),
  sessionSummary: z.string().max(900),
  fingerprint: z.object({
    label: z.string().max(120),
    summary: z.string().max(800),
    dimensions: z.array(zDimension).min(3).max(6),
  }),
  assessment: z
    .array(
      z.object({
        name: z.string().max(30),
        score: z.number().min(0).max(100),
        summary: z.string().max(600),
        dimensions: z.array(zDimension).max(6),
      }),
    )
    .min(1)
    .max(3),
  strengths: z.array(z.string().max(300)).max(6),
  weaknesses: z.array(z.string().max(300)).max(6),
});

export const coachingResponseSchema = z.object({
  practicePriority: z.object({
    what: z.string().max(300),
    evidence: z.string().max(500),
    whyItMatters: z.string().max(500),
    howToPractice: z.string().max(600),
  }),
  patterns: z
    .array(
      z.object({
        title: z.string().max(120),
        observation: z.string().max(600),
        evidenceQuestionIds: z.array(z.number().int().min(0).max(100)).max(12),
        type: z.enum(['strength', 'development']),
      }),
    )
    .max(6),
  timeline: z
    .array(
      z.object({
        questionId: z.number().int().min(0).max(100),
        verdict: z.enum(['strong', 'solid', 'developing', 'weak']),
        contentNote: z.string().max(240),
        deliveryNote: z.string().max(240).optional().default(''),
      }),
    )
    .max(12),
  etiquette: z.array(z.object({ rule: z.string().max(140), why: z.string().max(400) })).max(5),
  practicePlan: z
    .array(
      z.object({
        problem: z.string().max(200),
        evidence: z.string().max(400),
        drill: z.string().max(400),
      }),
    )
    .max(3),
  trainingDrill: z.object({
    weakness: z.string().max(200),
    framework: z.string().max(200),
    practiceQuestion: z.string().max(600),
    answerOutline: z.array(z.string().max(240)).max(6),
  }),
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
    if (!result.success) {
      console.warn('[schema] model response rejected:', result.error.issues.slice(0, 3));
      return null;
    }
    return result.data;
  };
}
