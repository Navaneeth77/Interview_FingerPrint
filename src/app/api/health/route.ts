import { NextResponse } from 'next/server';

import { enforceRateLimit, toErrorResponse } from '@/lib/api';
import { GEMMA_MODEL, pingGemma } from '@/lib/gemma';
import { RATE_LIMITS } from '@/lib/rate-limit';

export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export interface HealthResponseBody {
  status: 'ok';
  model: string;
  latencyMs: number;
}

/**
 * GET /api/health — round-trips a tiny prompt to Gemma.
 * The landing page uses this to show a live "Gemma 4 connected" badge, which also makes
 * misconfigured environment variables obvious the moment the app is deployed.
 */
export async function GET(request: Request) {
  try {
    enforceRateLimit(request, 'health', RATE_LIMITS.health);
    const { latencyMs } = await pingGemma();
    return NextResponse.json<HealthResponseBody>({
      status: 'ok',
      model: GEMMA_MODEL,
      latencyMs,
    });
  } catch (error) {
    return toErrorResponse(error, 'health');
  }
}
