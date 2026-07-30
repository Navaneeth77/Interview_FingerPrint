import { NextResponse } from 'next/server';

import { enforceRateLimit, readValidatedBody, toErrorResponse } from '@/lib/api';
import { generateJson } from '@/lib/gemma';
import { buildQuestionsPrompt } from '@/lib/prompts';
import {
  gemmaQuestionsSchema,
  generateRequestSchema,
  questionsResponseSchema,
  zodValidator,
} from '@/lib/schemas';
import { RATE_LIMITS } from '@/lib/rate-limit';
import type { Question } from '@/types/interview';

/** Gemma takes ~15s to write five grounded questions; give the function room. */
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export interface GenerateResponseBody {
  questions: Question[];
  model: string;
  latencyMs: number;
}

/** POST /api/interview/generate — resume + JD in, five tailored questions out. */
export async function POST(request: Request) {
  try {
    enforceRateLimit(request, 'generate', RATE_LIMITS.generate);
    const input = await readValidatedBody(request, generateRequestSchema);

    const { data, model, latencyMs } = await generateJson({
      label: 'question generation',
      prompt: buildQuestionsPrompt(input),
      schema: gemmaQuestionsSchema,
      validate: zodValidator(questionsResponseSchema),
      temperature: 0.8,
      maxOutputTokens: 4096,
      timeoutMs: 45_000,
    });

    // Renumber defensively so the UI can rely on ids matching asking order.
    const questions: Question[] = data.questions.map((question, index) => ({
      ...question,
      id: index + 1,
    }));

    return NextResponse.json<GenerateResponseBody>({ questions, model, latencyMs });
  } catch (error) {
    return toErrorResponse(error, 'generate');
  }
}
