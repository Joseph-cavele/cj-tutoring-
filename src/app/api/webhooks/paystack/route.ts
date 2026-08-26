import { NextResponse } from 'next/server';

import { getGateway } from '@/lib/payments';
import { failAnyPayment, settleAnyPayment } from '@/services/payment-router.service';

/**
 * Paystack webhook.
 *
 * This is the ONLY place a payment becomes successful. CLAUDE.md section 19
 * and brief section 14: never mark a payment successful from frontend input,
 * because the browser can be told to say anything.
 *
 * Provider-specific details - the signature header, the event names, the
 * subunit conversion - are handled by the gateway adapter, so this handler is
 * the same shape whichever provider is added next.
 */
export async function POST(request: Request) {
  const gateway = getGateway('paystack');

  if (!gateway || !gateway.isConfigured()) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  // The signature covers the raw bytes, so read text before parsing JSON.
  const rawBody = await request.text();

  if (!gateway.verifyWebhook(rawBody, request.headers)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const event = gateway.parseWebhookEvent(rawBody);

  if (!event.reference || event.status === 'ignored' || event.status === 'pending') {
    // Acknowledge: an event we cannot act on should not be retried forever.
    return NextResponse.json({ received: true });
  }

  try {
    if (event.status === 'successful') {
      await settleAnyPayment({
        reference: event.reference,
        amount: event.amount,
        raw: event.raw,
      });
    } else {
      await failAnyPayment(event.reference, event.raw);
    }
  } catch (error) {
    console.error('[webhook/paystack] handling failed', error);
    // 500 so the provider retries a transient failure.
    return NextResponse.json({ error: 'Handling failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
