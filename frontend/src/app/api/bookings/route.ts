import { NextResponse } from 'next/server';

import { bookingSchema } from '@/validations/booking';
import { submitBooking } from '@/services/booking.service';
import {
  HOUR,
  MINUTE,
  callerIp,
  checkRateLimit,
  rateLimitHeaders,
  tooManyRequests,
} from '@/lib/rate-limit';

const BOOKING_RULES = [
  { name: 'burst', limit: 3, windowMs: MINUTE },
  { name: 'hourly', limit: 10, windowMs: HOUR },
];

export async function POST(request: Request) {
  const rate = await checkRateLimit(`booking:${callerIp(request)}`, BOOKING_RULES);

  if (!rate.allowed) return tooManyRequests(rate);

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = bookingSchema.safeParse(body);

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

  // Bot: looks accepted, stores nothing.
  if (parsed.data.company) {
    return NextResponse.json({ received: true }, { headers: rateLimitHeaders(rate) });
  }

  try {
    const result = await submitBooking(parsed.data);
    return NextResponse.json(result, { status: 201, headers: rateLimitHeaders(rate) });
  } catch (error) {
    console.error('[api/bookings] unexpected error', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please phone or email us instead.' },
      { status: 500 }
    );
  }
}
