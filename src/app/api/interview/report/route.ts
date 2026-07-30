import { NextResponse } from 'next/server';

import { enforceRateLimit, readValidatedBody, toErrorResponse } from '@/lib/api';
import { generateJson } from '@/lib/gemma';
import { buildReportPrompt } from '@/lib/prompts';
import {
  gemmaReportSchema,
  reportRequestSchema,
  reportResponseSchema,
  zodValidator,
} from '@/lib/schemas';
import { RATE_LIMITS } from '@/lib/rate-limit';
import type { InterviewReport } from '@/types/interview';

/** The report reasons over the whole transcript, so it is the slowest call in the app. */
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export interface ReportResponseBody {
  report: InterviewReport;
  model: string;
  latencyMs: number;
}

/** POST /api/interview/report — whole session in, Interview Fingerprint out. */
export async function POST(request: Request) {
  try {
    enforceRateLimit(request, 'report', RATE_LIMITS.report);
    const input = await readValidatedBody(request, reportRequestSchema);

    const { data, model, latencyMs } = await generateJson({
      label: 'interview report',
      prompt: buildReportPrompt(input),
      schema: gemmaReportSchema,
      validate: zodValidator(reportResponseSchema),
      temperature: 0.5,
      maxOutputTokens: 6144,
      timeoutMs: 55_000,
    });

    // Gemma occasionally repeats a dimension. Keep the first of each name, capped at five,
    // so the fingerprint chart always renders one bar per dimension.
    const seen = new Set<string>();
    const dimensions = data.fingerprint.dimensions
      .filter((dimension) => {
        const key = dimension.name.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 5)
      .map((dimension) => ({ ...dimension, score: Math.round(dimension.score) }));

    const report: InterviewReport = {
      ...data,
      overallScore: Math.round(data.overallScore),
      fingerprint: { ...data.fingerprint, dimensions },
    };

    return NextResponse.json<ReportResponseBody>({ report, model, latencyMs });
  } catch (error) {
    return toErrorResponse(error, 'report');
  }
}
