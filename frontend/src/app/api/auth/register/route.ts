import { NextResponse } from 'next/server';

import { registerSchema } from '@/validations/auth';
import { RegistrationError, registerUser } from '@/services/auth.service';
import {
  HOUR,
  MINUTE,
  callerIp,
  checkRateLimit,
  rateLimitHeaders,
  tooManyRequests,
} from '@/lib/rate-limit';

/** Public and account-creating, so kept tight. */
const REGISTER_RULES = [
  { name: 'burst', limit: 3, windowMs: MINUTE },
  { name: 'hourly', limit: 10, windowMs: HOUR },
];

export async function POST(request: Request) {
  const rate = await checkRateLimit(`register:${callerIp(request)}`, REGISTER_RULES);

  if (!rate.allowed) {
    return tooManyRequests(rate);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Please check the form and try again',
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400, headers: rateLimitHeaders(rate) }
    );
  }

  // Bot: looks successful, creates nothing.
  if (parsed.data.company) {
    return NextResponse.json(
      { id: 'ok', role: parsed.data.role, requiresApproval: false },
      { headers: rateLimitHeaders(rate) }
    );
  }

  try {
    const result = await registerUser(parsed.data);
    return NextResponse.json(result, { status: 201, headers: rateLimitHeaders(rate) });
  } catch (error) {
    if (error instanceof RegistrationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: rateLimitHeaders(rate) }
      );
    }

    console.error('[api/auth/register] unexpected error', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
