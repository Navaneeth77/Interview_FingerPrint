import { NextResponse } from 'next/server';

import { enforceRateLimit, readValidatedBody, toErrorResponse } from '@/lib/api';
import { generateJson } from '@/lib/gemma';
import { buildAssessmentPrompt, buildCoachingPrompt } from '@/lib/prompts';
import {
  assessmentResponseSchema,
  coachingResponseSchema,
  gemmaAssessmentSchema,
  gemmaCoachingSchema,
  reportRequestSchema,
  zodValidator,
} from '@/lib/schemas';
import { RATE_LIMITS } from '@/lib/rate-limit';
import type { InterviewReport } from '@/types/interview';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export interface ReportResponseBody {
  report: InterviewReport;
  model: string;
  latencyMs: number;
}

/**
 * POST /api/interview/report — whole session in, Interview Fingerprint out.
 *
 * The report is two Gemma calls issued in parallel: one scores the session, the other
 * finds the cross-question patterns and writes the coaching plan. A single combined call
 * had to emit both, which pushed generation past the serverless ceiling whenever the model
 * was under load. Splitting halves the output per call while keeping the wall-clock wait
 * roughly the same.
 */
export async function POST(request: Request) {
  try {
    enforceRateLimit(request, 'report', RATE_LIMITS.report);
    const input = await readValidatedBody(request, reportRequestSchema);

    const started = Date.now();

    const [assessment, coaching] = await Promise.all([
      generateJson({
        label: 'interview assessment',
        prompt: buildAssessmentPrompt(input),
        schema: gemmaAssessmentSchema,
        validate: zodValidator(assessmentResponseSchema),
        temperature: 0.4,
        maxOutputTokens: 6144,
        timeoutMs: 52_000,
      }),
      generateJson({
        label: 'interview coaching',
        prompt: buildCoachingPrompt(input),
        schema: gemmaCoachingSchema,
        validate: zodValidator(coachingResponseSchema),
        temperature: 0.55,
        maxOutputTokens: 6144,
        timeoutMs: 52_000,
      }),
    ]);

    // Gemma occasionally repeats a dimension. Keep the first of each name, capped at five,
    // so the fingerprint chart always renders one bar per dimension.
    const seen = new Set<string>();
    const dimensions = assessment.data.fingerprint.dimensions
      .filter((dimension) => {
        const key = dimension.name.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5)
      .map((dimension) => ({ ...dimension, score: Math.round(dimension.score) }));

    const answeredIds = new Set(input.answers.map((answer) => answer.questionId));

    const report: InterviewReport = {
      overallScore: Math.round(assessment.data.overallScore),
      headline: assessment.data.headline,
      sessionSummary: assessment.data.sessionSummary,
      fingerprint: { ...assessment.data.fingerprint, dimensions },
      assessment: assessment.data.assessment.map((group) => ({
        ...group,
        score: Math.round(group.score),
        dimensions: group.dimensions.map((d) => ({ ...d, score: Math.round(d.score) })),
      })),
      strengths: assessment.data.strengths,
      weaknesses: assessment.data.weaknesses,
      practicePriority: coaching.data.practicePriority,
      // Drop citations to questions that were never asked, so every pattern stays traceable.
      patterns: coaching.data.patterns
        .map((pattern) => ({
          ...pattern,
          evidenceQuestionIds: pattern.evidenceQuestionIds.filter((id) => answeredIds.has(id)),
        }))
        .filter((pattern) => pattern.evidenceQuestionIds.length > 0),
      timeline: coaching.data.timeline.filter((entry) => answeredIds.has(entry.questionId)),
      etiquette: coaching.data.etiquette,
      practicePlan: coaching.data.practicePlan,
      trainingDrill: coaching.data.trainingDrill,
      nextSession: coaching.data.nextSession,
    };

    return NextResponse.json<ReportResponseBody>({
      report,
      model: assessment.model,
      latencyMs: Date.now() - started,
    });
  } catch (error) {
    return toErrorResponse(error, 'report');
  }
}
