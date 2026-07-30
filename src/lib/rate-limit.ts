/**
 * Fixed-window in-memory rate limiter.
 *
 * V1 has no database, so limits are tracked per serverless instance. That is best-effort
 * rather than globally exact: it reliably stops a single client hammering an endpoint
 * (and burning Gemma quota during the demo), which is what this project needs. Moving to
 * a shared store (Upstash/Redis) is a drop-in change behind this same function.
 */

interface Window {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Window>();

/** Keeps the map from growing without bound on a long-lived instance. */
function sweep(now: number) {
  if (buckets.size < 500) return;
  for (const [key, window] of buckets) {
    if (window.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitRule {
  /** Max requests allowed inside the window. */
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
}

export const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * Per-route budgets. Generation and reporting are the expensive Gemma calls, so they are
 * tighter; evaluation runs once per answer and needs more headroom.
 */
export const RATE_LIMITS = {
  generate: { limit: 10, windowMs: FIFTEEN_MINUTES },
  evaluate: { limit: 60, windowMs: FIFTEEN_MINUTES },
  report: { limit: 10, windowMs: FIFTEEN_MINUTES },
  health: { limit: 20, windowMs: FIFTEEN_MINUTES },
} as const satisfies Record<string, RateLimitRule>;

export function rateLimit(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs });
    return { ok: true, limit: rule.limit, remaining: rule.limit - 1, retryAfter: 0 };
  }

  existing.count += 1;
  const remaining = Math.max(0, rule.limit - existing.count);
  const retryAfter = Math.ceil((existing.resetAt - now) / 1000);

  return { ok: existing.count <= rule.limit, limit: rule.limit, remaining, retryAfter };
}

/**
 * Best-effort client identity. On Vercel `x-forwarded-for` is set by the platform edge;
 * locally it is absent, so all local traffic shares one bucket.
 */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
  return `${scope}:${ip}`;
}
