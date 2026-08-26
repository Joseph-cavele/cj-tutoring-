import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { checkoutSchema } from '@/validations/payment';
import { PaymentError, startPackageCheckout } from '@/services/payment.service';
import { PaystackNotConfiguredError } from '@/lib/payments/paystack';
import { HOUR, MINUTE, checkRateLimit, rateLimitHeaders, tooManyRequests } from '@/lib/rate-limit';

const CHECKOUT_RULES = [
  { name: 'burst', limit: 5, windowMs: MINUTE },
  { name: 'hourly', limit: 20, windowMs: HOUR },
];

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rate = await checkRateLimit(`checkout:${session.user.id}`, CHECKOUT_RULES);
  if (!rate.allowed) return tooManyRequests(rate);

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Choose a package' },
      { status: 400, headers: rateLimitHeaders(rate) }
    );
  }

  try {
    const origin = new URL(request.url).origin;

    const result = await startPackageCheckout({
      userId: session.user.id,
      packageSlug: parsed.data.packageSlug,
      origin,
    });

    return NextResponse.json(result, { headers: rateLimitHeaders(rate) });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof PaystackNotConfiguredError) {
      return NextResponse.json(
        { error: 'Card payments are not switched on yet. Please contact us to pay.' },
        { status: 503 }
      );
    }

    console.error('[api/payments] unexpected error', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
