import { connectDB } from '@/lib/mongodb';
import { Payment } from '@/models';
import { getGateway } from '@/lib/payments';
import { failPayment, fulfilPayment } from '@/services/payment.service';
import {
  failBookingPayment,
  settleBookingPayment,
} from '@/services/booking-payment.service';
import { activatePlan, failPlanPayment } from '@/services/plan-checkout.service';

/**
 * Sends a confirmed charge to whichever fulfilment it belongs to.
 *
 * The platform sells two things through the same gateway - a single lesson and
 * a package - and the webhook cannot tell them apart from the event alone. The
 * Payment row can, because it records which one it was created for, so the
 * decision is made from our own data rather than from the provider's payload.
 */

async function kindOf(
  reference: string
): Promise<'booking' | 'monthly' | 'package' | 'unknown'> {
  await connectDB();

  const payment = await Payment.findOne({ reference })
    .select('booking package plan')
    .lean();

  if (!payment) return 'unknown';

  if (payment.booking) return 'booking';

  // A monthly plan grants a drawdown rather than a plain package, so it is
  // fulfilled by the plan service. Read from our own row, never from the
  // provider's payload.
  if (payment.plan === 'monthly') return 'monthly';

  return 'package';
}

export async function settleAnyPayment(params: {
  reference: string;
  amount: number;
  raw?: unknown;
}) {
  const kind = await kindOf(params.reference);

  if (kind === 'booking') {
    return settleBookingPayment(params);
  }

  if (kind === 'monthly') {
    return activatePlan(params);
  }

  if (kind === 'package') {
    return fulfilPayment({
      reference: params.reference,
      amountInRands: params.amount,
      raw: params.raw,
    });
  }

  console.error('[payment] settled event for unknown reference', params.reference);
  return { handled: false };
}

export async function failAnyPayment(reference: string, raw?: unknown) {
  const kind = await kindOf(reference);

  if (kind === 'booking') return failBookingPayment(reference, raw);
  if (kind === 'monthly') return failPlanPayment(reference, raw);
  if (kind === 'package') return failPayment(reference, raw);
}

export type VerifyOutcome = 'successful' | 'failed' | 'pending' | 'unknown';

/**
 * Asks the provider directly what happened to a charge.
 *
 * This is not the browser being believed: the answer comes from a
 * server-to-server call authenticated with our secret key, and the result is
 * settled through exactly the same code the webhook uses. It exists because a
 * webhook can be delayed, or cannot reach a machine that is not publicly
 * addressable, and the customer is standing in front of the return page now.
 */
export async function verifyAnyPayment(reference: string): Promise<VerifyOutcome> {
  await connectDB();

  const payment = await Payment.findOne({ reference }).select('provider status').lean();

  if (!payment) return 'unknown';
  if (payment.status === 'successful') return 'successful';

  const gateway = getGateway(payment.provider);

  if (!gateway) return 'pending';

  let verified;

  try {
    verified = await gateway.verify(reference);
  } catch (error) {
    // A gateway outage is not a failed payment - say "pending" rather than
    // telling a customer who paid that they did not.
    console.error('[payment] verify failed', error);
    return 'pending';
  }

  if (verified.status === 'successful') {
    await settleAnyPayment({
      reference,
      amount: verified.amount,
      raw: verified.raw,
    });

    return 'successful';
  }

  if (verified.status === 'failed') {
    await failAnyPayment(reference, verified.raw);
    return 'failed';
  }

  return 'pending';
}
