/**
 * In-memory sliding window rate limiter.
 * Sufficient for single-instance Next.js deployment on Vercel.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export function rateLimit(
  key: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.max - 1, resetMs: config.windowMs };
  }

  entry.count++;

  if (entry.count > config.max) {
    return {
      allowed: false,
      remaining: 0,
      resetMs: entry.resetAt - now,
    };
  }

  return {
    allowed: true,
    remaining: config.max - entry.count,
    resetMs: entry.resetAt - now,
  };
}

export const RATE_LIMITS = {
  login: { windowMs: 15 * 60 * 1000, max: 5 },
  placeOrder: { windowMs: 10 * 60 * 1000, max: 10 },
  api: { windowMs: 60 * 1000, max: 60 },
} as const;
