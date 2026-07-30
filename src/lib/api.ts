import { NextResponse } from 'next/server';
import type { z } from 'zod';

import { GemmaError } from '@/lib/gemma';
import { LIMITS } from '@/lib/schemas';
import { clientKey, rateLimit, type RateLimitRule } from '@/lib/rate-limit';

/**
 * Shared plumbing for the interview Route Handlers: consistent error envelopes,
 * body-size limits, validation, and rate limiting.
 *
 * Every error the browser can receive has the same shape, so the UI can render an
 * honest message and decide whether to offer a retry button:
 *   { error: { code, message, retryable } }
 */

export type ApiErrorCode =
  | 'rate_limited'
  | 'payload_too_large'
  | 'invalid_json'
  | 'invalid_request'
  | 'missing_key'
  | 'timeout'
  | 'upstream_error'
  | 'blocked'
  | 'invalid_response'
  | 'server_error';

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; retryable: boolean };
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  retryable = false,
  headers?: HeadersInit,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: { code, message, retryable } }, { status, headers });
}

/** Thrown internally to unwind a handler with a prepared response. */
export class ApiResponseError extends Error {
  readonly response: NextResponse<ApiErrorBody>;

  constructor(response: NextResponse<ApiErrorBody>) {
    super('api-response');
    this.name = 'ApiResponseError';
    this.response = response;
  }
}

export function enforceRateLimit(request: Request, scope: string, rule: RateLimitRule): void {
  const result = rateLimit(clientKey(request, scope), rule);
  if (result.ok) return;

  throw new ApiResponseError(
    apiError(
      'rate_limited',
      `Too many requests. Try again in ${Math.ceil(result.retryAfter / 60)} minute(s).`,
      429,
      true,
      { 'retry-after': String(result.retryAfter) },
    ),
  );
}

/** Reads the body with a hard size cap, then validates it against a zod schema. */
export async function readValidatedBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > LIMITS.requestBytes) {
    throw new ApiResponseError(
      apiError('payload_too_large', 'That payload is too large for this endpoint.', 413),
    );
  }

  const raw = await request.text();
  if (raw.length > LIMITS.requestBytes) {
    throw new ApiResponseError(
      apiError('payload_too_large', 'That payload is too large for this endpoint.', 413),
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiResponseError(apiError('invalid_json', 'Request body must be valid JSON.', 400));
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first?.path.join('.');
    throw new ApiResponseError(
      apiError(
        'invalid_request',
        first ? `${path ? `${path}: ` : ''}${first.message}` : 'Request failed validation.',
        400,
      ),
    );
  }

  return result.data;
}

/** Maps any thrown error onto the standard envelope, without leaking internals. */
export function toErrorResponse(error: unknown, context: string): NextResponse<ApiErrorBody> {
  if (error instanceof ApiResponseError) return error.response;

  if (error instanceof GemmaError) {
    // The key being missing or wrong is our problem, not something the user can retry into.
    const message =
      error.code === 'missing_key'
        ? 'The server is missing a valid GEMMA_API_KEY. Set it in the environment and redeploy.'
        : error.message;
    return apiError(error.code, message, error.status, error.retryable);
  }

  console.error(`[${context}] unexpected error:`, error);
  return apiError('server_error', 'Something went wrong on our side.', 500, true);
}
