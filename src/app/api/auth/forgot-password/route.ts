import { NextResponse } from 'next/server';

import { forgotPasswordSchema } from '@/validations/password';
import { requestPasswordReset } from '@/services/password.service';
import {
  HOUR,
  MINUTE,
  callerIp,
  checkRateLimit,
  rateLimitHeaders,
  tooManyRequests,
} from '@/lib/rate-limit';

/**
 * Requests a password reset link.
 *
 * Answers identically whether or not the address belongs to an account, so it
 * cannot be used to find out who has registered. Rate limited tightly because
 * it sends email on behalf of an unauthenticated caller.
 */
const RESET_RULES = [
  { name: 'burst', limit: 3, windowMs: MINUTE },
  { name: 'hourly', limit: 8, windowMs: HOUR },
];

export async function POST(request: Request) {
  const rate = await checkRateLimit(`forgot:${callerIp(request)}`, RESET_RULES);

  if (!rate.allowed) return tooManyRequests(rate);

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = forgotPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Please enter a valid email address' },
      { status: 400, headers: rateLimitHeaders(rate) }
    );
  }

  // Bot: looks accepted, sends nothing.
  if (parsed.data.company) {
    return NextResponse.json({ sent: true }, { headers: rateLimitHeaders(rate) });
  }

  try {
    await requestPasswordReset({
      email: parsed.data.email,
      origin: new URL(request.url).origin,
    });
  } catch (error) {
    // Logged, not surfaced: an error that appears only for real addresses
    // would leak exactly what the uniform response is protecting.
    console.error('[api/auth/forgot-password] failed', error);
  }

  return NextResponse.json({ sent: true }, { headers: rateLimitHeaders(rate) });
}
