import { NextResponse } from 'next/server';

import { contactSchema } from '@/validations/contact';
import { ContactError, submitEnquiry } from '@/services/contact.service';
import {
  HOUR,
  MINUTE,
  callerIp,
  checkRateLimit,
  rateLimitHeaders,
  tooManyRequests,
} from '@/lib/rate-limit';

/** Public endpoint, so it is keyed by IP and kept deliberately tight. */
const CONTACT_RULES = [
  { name: 'burst', limit: 3, windowMs: MINUTE },
  { name: 'hourly', limit: 10, windowMs: HOUR },
];

export async function POST(request: Request) {
  const rate = await checkRateLimit(`contact:${callerIp(request)}`, CONTACT_RULES);

  if (!rate.allowed) {
    return tooManyRequests(rate);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);

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

  // Honeypot filled means a bot. Answer 200 so it learns nothing, and send nothing.
  if (parsed.data.company) {
    return NextResponse.json({ delivered: true }, { headers: rateLimitHeaders(rate) });
  }

  try {
    const result = await submitEnquiry(parsed.data);
    return NextResponse.json(result, { headers: rateLimitHeaders(rate) });
  } catch (error) {
    if (error instanceof ContactError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: rateLimitHeaders(rate) }
      );
    }

    console.error('[api/contact] unexpected error', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please email or call us instead.' },
      { status: 500 }
    );
  }
}
