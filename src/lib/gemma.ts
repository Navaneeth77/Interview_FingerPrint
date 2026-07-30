import 'server-only';

/**
 * Server-only Gemma 4 client.
 *
 * Every call to Gemma happens here, inside Next.js Route Handlers, so the API key
 * never reaches the browser bundle. The `server-only` import makes importing this
 * file from a Client Component a build error rather than a leaked credential.
 *
 * Gemma 4 on the Gemini API notes that shaped this client:
 *  - `thinkingConfig` is rejected ("Thinking budget is not supported for this model"),
 *    so thinking cannot be disabled; responses may contain parts marked `thought: true`
 *    which must be filtered out before parsing.
 *  - `responseMimeType: application/json` + `responseSchema` are supported and are what
 *    make the output reliably parseable, so every call here is a structured-JSON call.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Default model — overridable with GEMMA_MODEL without touching code. */
export const GEMMA_MODEL = process.env.GEMMA_MODEL?.trim() || 'gemma-4-31b-it';

export type GemmaErrorCode =
  | 'missing_key'
  | 'timeout'
  | 'rate_limited'
  | 'upstream_error'
  | 'blocked'
  | 'invalid_response';

/** Error type that carries enough detail for the route to build an honest client message. */
export class GemmaError extends Error {
  readonly code: GemmaErrorCode;
  readonly status: number;
  readonly retryable: boolean;

  constructor(code: GemmaErrorCode, message: string, status = 502, retryable = true) {
    super(message);
    this.name = 'GemmaError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

/** A JSON Schema subset accepted by the Gemini API's `responseSchema`. */
export type ResponseSchema = {
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  description?: string;
  properties?: Record<string, ResponseSchema>;
  items?: ResponseSchema;
  required?: string[];
  enum?: string[];
  propertyOrdering?: string[];
};

interface GemmaPart {
  text?: string;
  thought?: boolean;
}

interface GemmaResponse {
  candidates?: {
    content?: { parts?: GemmaPart[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string; status?: string };
}

export interface GenerateJsonOptions<T> {
  prompt: string;
  schema: ResponseSchema;
  /** Validates and narrows the parsed JSON. Throw or return null to reject a response. */
  validate: (value: unknown) => T | null;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
  /** Label used in error messages and logs, e.g. "question generation". */
  label: string;
}

export interface GemmaResult<T> {
  data: T;
  model: string;
  latencyMs: number;
}

function readApiKey(): string {
  const key = process.env.GEMMA_API_KEY?.trim();
  if (!key) {
    throw new GemmaError(
      'missing_key',
      'GEMMA_API_KEY is not configured on the server.',
      500,
      false,
    );
  }
  return key;
}

/**
 * Pulls the answer text out of a Gemma response, dropping reasoning parts.
 * Gemma 4 always thinks, and thought parts are prose — they would break JSON.parse.
 */
function extractText(payload: GemmaResponse): string {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts
    .filter((part) => !part.thought)
    .map((part) => part.text ?? '')
    .join('')
    .trim();
}

/**
 * Tolerant JSON parse. `responseSchema` makes clean JSON the norm, but a model can still
 * wrap output in a code fence or add a stray prefix, and a demo should survive that.
 */
function parseJsonLoosely(text: string): unknown {
  if (!text) return null;

  const attempts: string[] = [text];

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) attempts.push(fenced[1].trim());

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    attempts.push(text.slice(firstBrace, lastBrace + 1));
  }

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // try the next candidate
    }
  }
  return null;
}

async function callGemma(
  prompt: string,
  schema: ResponseSchema,
  temperature: number,
  maxOutputTokens: number,
  timeoutMs: number,
): Promise<GemmaResponse> {
  const apiKey = readApiKey();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE}/models/${GEMMA_MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens,
          responseMimeType: 'application/json',
          responseSchema: schema,
        },
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => null)) as GemmaResponse | null;

    if (!response.ok) {
      const detail = payload?.error?.message ?? `HTTP ${response.status}`;
      if (response.status === 429) {
        throw new GemmaError('rate_limited', `Gemma is rate limiting requests: ${detail}`, 429);
      }
      if (response.status === 401 || response.status === 403) {
        throw new GemmaError('missing_key', `Gemma rejected the API key: ${detail}`, 500, false);
      }
      throw new GemmaError(
        'upstream_error',
        `Gemma returned ${response.status}: ${detail}`,
        502,
        response.status >= 500,
      );
    }

    if (!payload) {
      throw new GemmaError('invalid_response', 'Gemma returned a non-JSON response body.');
    }

    return payload;
  } catch (error) {
    if (error instanceof GemmaError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new GemmaError('timeout', `Gemma did not respond within ${timeoutMs / 1000}s.`, 504);
    }
    throw new GemmaError(
      'upstream_error',
      `Could not reach Gemma: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Asks Gemma for a JSON object matching `schema`, validates it, and retries once on
 * transient failures (timeout, 5xx, malformed output). Anything still broken after the
 * retry surfaces as a `GemmaError` — we never silently swap in another model or fake data.
 */
/** Bounded exponential backoff with jitter. Attempt 0 is immediate. */
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 600;

function backoffDelay(attempt: number): number {
  const exponential = BASE_BACKOFF_MS * 2 ** attempt;
  return exponential + Math.random() * 250;
}

export async function generateJson<T>(options: GenerateJsonOptions<T>): Promise<GemmaResult<T>> {
  const {
    prompt,
    schema,
    validate,
    label,
    temperature = 0.7,
    maxOutputTokens = 4096,
    timeoutMs = 45_000,
  } = options;

  const started = Date.now();
  let lastError: GemmaError | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      const payload = await callGemma(prompt, schema, temperature, maxOutputTokens, timeoutMs);

      const blockReason = payload.promptFeedback?.blockReason;
      if (blockReason) {
        // Safety blocks are not fixed by retrying the same prompt.
        throw new GemmaError(
          'blocked',
          `Gemma declined this ${label} request (${blockReason}). Try rephrasing your resume or job description.`,
          422,
          false,
        );
      }

      const finishReason = payload.candidates?.[0]?.finishReason;
      const text = extractText(payload);

      if (finishReason === 'MAX_TOKENS' && !text) {
        throw new GemmaError(
          'invalid_response',
          `Gemma ran out of output tokens during ${label}.`,
        );
      }

      const parsed = parseJsonLoosely(text);
      if (parsed === null) {
        throw new GemmaError(
          'invalid_response',
          `Gemma's ${label} response was not valid JSON.`,
        );
      }

      const validated = validate(parsed);
      if (validated === null) {
        throw new GemmaError(
          'invalid_response',
          `Gemma's ${label} response did not match the expected structure.`,
        );
      }

      const latencyMs = Date.now() - started;
      console.log(
        `[gemma] ${label} ok model=${GEMMA_MODEL} attempt=${attempt + 1} latency=${latencyMs}ms ` +
          `promptTokens=${payload.usageMetadata?.promptTokenCount ?? '?'} ` +
          `outputTokens=${payload.usageMetadata?.candidatesTokenCount ?? '?'}`,
      );

      return { data: validated, model: GEMMA_MODEL, latencyMs };
    } catch (error) {
      const gemmaError =
        error instanceof GemmaError
          ? error
          : new GemmaError(
              'upstream_error',
              error instanceof Error ? error.message : 'Unknown Gemma failure',
            );

      lastError = gemmaError;

      // Logs carry the failure class and never the key or the candidate's text.
      console.warn(
        `[gemma] ${label} attempt=${attempt + 1}/${MAX_ATTEMPTS} code=${gemmaError.code} ` +
          `retryable=${gemmaError.retryable} model=${GEMMA_MODEL}: ${gemmaError.message}`,
      );

      // Permanent failures (bad key, bad model id, safety block) never get a second try.
      if (!gemmaError.retryable || attempt === MAX_ATTEMPTS - 1) break;
      await new Promise((resolve) => setTimeout(resolve, backoffDelay(attempt)));
    }
  }

  console.error(
    `[gemma] ${label} failed after ${MAX_ATTEMPTS} attempts code=${lastError?.code ?? 'unknown'}`,
  );
  throw lastError ?? new GemmaError('upstream_error', `Gemma failed during ${label}.`);
}

/** Lightweight connectivity probe used by /api/health so the demo can prove the model is live. */
export async function pingGemma(timeoutMs = 15_000): Promise<{ ok: true; model: string; latencyMs: number }> {
  const started = Date.now();
  await generateJson<{ status: string }>({
    label: 'health check',
    prompt: 'Reply with {"status":"ok"} and nothing else.',
    temperature: 0,
    maxOutputTokens: 256,
    timeoutMs,
    schema: {
      type: 'object',
      properties: { status: { type: 'string' } },
      required: ['status'],
    },
    validate: (value) =>
      typeof value === 'object' && value !== null && 'status' in value
        ? (value as { status: string })
        : null,
  });
  return { ok: true, model: GEMMA_MODEL, latencyMs: Date.now() - started };
}
