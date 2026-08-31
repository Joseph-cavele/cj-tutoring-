import { NextResponse } from 'next/server';

import { connectDB } from '@/lib/mongodb';
import { RateLimit } from '@/models/RateLimit';

export type RateLimitRule = {
  /** Max requests allowed inside the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Distinguishes rules that share a key, e.g. "burst" and "hourly". */
  name: string;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** When the current window rolls over. */
  resetAt: Date;
  /** Seconds until reset, for the Retry-After header. */
  retryAfterSeconds: number;
};

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

/** Sensible defaults for an authenticated, cost-bearing endpoint. */
export const AI_CHAT_RULES: RateLimitRule[] = [
  { name: 'burst', limit: 5, windowMs: MINUTE },
  { name: 'hourly', limit: 40, windowMs: HOUR },
];

/**
 * Limits for a signed-out visitor asking the assistant.
 *
 * Lower than the signed-in allowance and keyed by IP rather than account: an
 * anonymous caller has nothing at stake, and every turn costs real tokens.
 */
export const AI_CHAT_ANON_RULES: RateLimitRule[] = [
  { name: 'burst', limit: 3, windowMs: MINUTE },
  { name: 'hourly', limit: 12, windowMs: HOUR },
];

/**
 * Redeeming a parent invitation code.
 *
 * The code is 50 bits, so this is not what stops guessing - it stops a script
 * hammering the endpoint, and it is the belt to the entropy braces that lets
 * `redeemParentInvite` return a specific, useful error to an honest parent.
 */
export const PARENT_INVITE_RULES: RateLimitRule[] = [
  { name: 'burst', limit: 5, windowMs: MINUTE },
  { name: 'hourly', limit: 20, windowMs: HOUR },
];

/**
 * Signing in.
 *
 * Keyed by email rather than by IP, because the attack worth stopping is
 * guessing one account's password, and an attacker can change address far more
 * easily than they can change which account they want. Generous enough that
 * someone genuinely mistyping their own password is not locked out: five tries
 * a minute, thirty an hour.
 */
export const LOGIN_RULES: RateLimitRule[] = [
  { name: 'burst', limit: 5, windowMs: MINUTE },
  { name: 'hourly', limit: 30, windowMs: HOUR },
];

/** Defaults for ordinary read/write API routes. */
export const DEFAULT_API_RULES: RateLimitRule[] = [
  { name: 'burst', limit: 30, windowMs: MINUTE },
  { name: 'hourly', limit: 600, windowMs: HOUR },
];

/**
 * Fixed-window counter. Simpler than a sliding window and accurate enough:
 * worst case a caller sends 2x the limit across a window boundary, which is
 * fine for abuse and cost control.
 */
async function hitRule(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / rule.windowMs) * rule.windowMs);
  const resetAt = new Date(windowStart.getTime() + rule.windowMs);
  const compositeKey = `${rule.name}:${key}`;

  // $inc on an upsert is atomic, so concurrent requests cannot both read a
  // stale count and each decide they are under the limit.
  const counter = await RateLimit.findOneAndUpdate(
    { key: compositeKey, windowStart },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: resetAt } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  const count = counter?.count ?? 1;

  return {
    allowed: count <= rule.limit,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - count),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000)),
  };
}

/**
 * Applies every rule and returns the most restrictive outcome.
 *
 * `key` should identify the caller: a user id for authenticated routes, an IP
 * for public ones. Never let the client supply it.
 */
export async function checkRateLimit(
  key: string,
  rules: RateLimitRule[] = DEFAULT_API_RULES
): Promise<RateLimitResult> {
  await connectDB();

  const results = await Promise.all(rules.map((rule) => hitRule(key, rule)));

  const blocked = results.find((result) => !result.allowed);
  if (blocked) return blocked;

  // Report the rule closest to its ceiling so headers stay meaningful.
  return results.reduce((tightest, result) =>
    result.remaining < tightest.remaining ? result : tightest
  );
}

/** Standard draft-spec headers, so clients can back off without guessing. */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(result.retryAfterSeconds),
  };
}

export function tooManyRequests(result: RateLimitResult) {
  return NextResponse.json(
    { error: 'Too many requests. Please slow down.' },
    {
      status: 429,
      headers: {
        ...rateLimitHeaders(result),
        'Retry-After': String(result.retryAfterSeconds),
      },
    }
  );
}

/**
 * Best-effort caller IP for unauthenticated routes. Trust this only behind a
 * proxy that sets the header, which Vercel and most hosts do.
 */
export function callerIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}
