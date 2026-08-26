import { auth } from '@/auth';
import {
  DEFAULT_API_RULES,
  callerIp,
  checkRateLimit,
  rateLimitHeaders,
  tooManyRequests,
  type RateLimitRule,
} from '@/lib/rate-limit';

type Handler = (request: Request, context: { userId?: string }) => Promise<Response>;

type Options = {
  rules?: RateLimitRule[];
  /** Prefix so each route gets its own budget instead of one shared pool. */
  bucket: string;
  /** Reject anonymous callers before spending a rate-limit slot. */
  requireAuth?: boolean;
};

/**
 * Wraps a route handler with rate limiting so new API routes get it by default
 * rather than each one reimplementing the check.
 *
 * Keys by user id when signed in and falls back to IP, because an unauthenticated
 * caller has no other stable identity.
 *
 * Usage:
 *   export const POST = withRateLimit({ bucket: 'students' }, async (request, { userId }) => { ... });
 */
export function withRateLimit(options: Options, handler: Handler) {
  return async function rateLimited(request: Request): Promise<Response> {
    const session = await auth();
    const userId = session?.user?.id;

    if (options.requireAuth && !userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const identity = userId ? `user:${userId}` : `ip:${callerIp(request)}`;
    const rate = await checkRateLimit(`${options.bucket}:${identity}`, options.rules ?? DEFAULT_API_RULES);

    if (!rate.allowed) {
      return tooManyRequests(rate);
    }

    const response = await handler(request, { userId });

    // Surface the budget on successful responses too, so a well-behaved client
    // can slow down before it gets a 429.
    for (const [header, value] of Object.entries(rateLimitHeaders(rate))) {
      response.headers.set(header, value);
    }

    return response;
  };
}
