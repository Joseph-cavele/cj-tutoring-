import { NextResponse } from 'next/server';

import { resetPasswordSchema } from '@/validations/password';
import { PasswordError, setPasswordWithToken } from '@/services/password.service';
import {
  HOUR,
  MINUTE,
  callerIp,
  checkRateLimit,
  rateLimitHeaders,
  tooManyRequests,
} from '@/lib/rate-limit';

/**
 * Sets a password from a one-time token.
 *
 * The token is the only thing that identifies the account - no email or user
 * id is read from the body - so a link for one account cannot be pointed at
 * another. Rate limited so the token space cannot be searched by brute force.
 */
const SET_RULES = [
  { name: 'burst', limit: 5, windowMs: MINUTE },
  { name: 'hourly', limit: 20, windowMs: HOUR },
];

export async function POST(request: Request) {
  const rate = await checkRateLimit(`reset:${callerIp(request)}`, SET_RULES);

  if (!rate.allowed) return tooManyRequests(rate);

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Please check the form and try again',
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      },
      { status: 400, headers: rateLimitHeaders(rate) }
    );
  }

  try {
    const result = await setPasswordWithToken({
      token: parsed.data.token,
      password: parsed.data.password,
    });

    return NextResponse.json(
      { ok: true, purpose: result.purpose },
      { headers: rateLimitHeaders(rate) }
    );
  } catch (error) {
    if (error instanceof PasswordError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: rateLimitHeaders(rate) }
      );
    }

    console.error('[api/auth/reset-password] failed', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
