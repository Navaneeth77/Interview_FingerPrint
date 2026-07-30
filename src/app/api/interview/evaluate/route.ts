import { NextResponse } from 'next/server';

import { enforceRateLimit, readValidatedBody, toErrorResponse } from '@/lib/api';
import { generateJson } from '@/lib/gemma';
import { buildEvaluationPrompt } from '@/lib/prompts';
import {
  evaluateRequestSchema,
  evaluationResponseSchema,
  gemmaEvaluationSchema,
  zodValidator,
} from '@/lib/schemas';
import { RATE_LIMITS } from '@/lib/rate-limit';
import type { Evaluation } from '@/types/interview';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export interface EvaluateResponseBody {
  evaluation: Evaluation;
  model: string;
  latencyMs: number;
}

/** POST /api/interview/evaluate — scores one answer on relevance, clarity and depth. */
export async function POST(request: Request) {
  try {
    enforceRateLimit(request, 'evaluate', RATE_LIMITS.evaluate);
    const input = await readValidatedBody(request, evaluateRequestSchema);

    const { data, model, latencyMs } = await generateJson({
      label: 'answer evaluation',
      prompt: buildEvaluationPrompt(input),
      schema: gemmaEvaluationSchema,
      validate: zodValidator(evaluationResponseSchema),
      // Lower temperature than generation: scoring should be repeatable, not creative.
      temperature: 0.3,
      maxOutputTokens: 2048,
      timeoutMs: 40_000,
    });

    return NextResponse.json<EvaluateResponseBody>({ evaluation: data, model, latencyMs });
  } catch (error) {
    return toErrorResponse(error, 'evaluate');
  }
}
