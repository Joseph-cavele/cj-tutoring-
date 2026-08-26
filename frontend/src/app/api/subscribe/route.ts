import crypto from 'node:crypto';
import { NextResponse } from 'next/server';

import { connectDB } from '@/lib/mongodb';
import { Subscriber } from '@/models/Subscriber';
import { subscribeSchema } from '@/validations/subscribe';
import {
  HOUR,
  MINUTE,
  callerIp,
  checkRateLimit,
  rateLimitHeaders,
  tooManyRequests,
} from '@/lib/rate-limit';

const SUBSCRIBE_RULES = [
  { name: 'burst', limit: 3, windowMs: MINUTE },
  { name: 'hourly', limit: 15, windowMs: HOUR },
];

export async function POST(request: Request) {
  const rate = await checkRateLimit(`subscribe:${callerIp(request)}`, SUBSCRIBE_RULES);

  if (!rate.allowed) {
    return tooManyRequests(rate);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Please check the address' },
      { status: 400, headers: rateLimitHeaders(rate) }
    );
  }

  // Bot: answer as though it worked, store nothing.
  if (parsed.data.company) {
    return NextResponse.json({ subscribed: true }, { headers: rateLimitHeaders(rate) });
  }

  try {
    await connectDB();

    // Upsert so a repeat signup is not an error, and a previous unsubscribe is
    // reactivated rather than duplicated.
    await Subscriber.findOneAndUpdate(
      { email: parsed.data.email },
      {
        $set: { isActive: true, unsubscribedAt: undefined },
        $setOnInsert: {
          source: 'footer',
          unsubscribeToken: crypto.randomBytes(24).toString('hex'),
        },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );

    return NextResponse.json({ subscribed: true }, { headers: rateLimitHeaders(rate) });
  } catch (error) {
    console.error('[api/subscribe] unexpected error', error);
    return NextResponse.json(
      { error: 'Could not sign you up right now. Please try again later.' },
      { status: 500 }
    );
  }
}
