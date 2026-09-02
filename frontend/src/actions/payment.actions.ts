'use server';
import { revalidatePath } from 'next/cache';

import { headers } from 'next/headers';

import { getCapableUser } from '@/lib/auth/guard';
import {
  BookingPaymentError,
  startBookingCheckout,
} from '@/services/booking-payment.service';
import { objectId } from '@/validations/lesson-booking';
import {
  ManualPaymentError,
  recordLessonPayment,
  recordPlanPayment,
  setPaymentStatus,
} from '@/services/manual-payment.service';
import {
  PlanCheckoutError,
  startPlanCheckout,
} from '@/services/plan-checkout.service';
import {
  recordLessonPaymentSchema,
  recordPlanPaymentSchema,
  setPaymentStatusSchema,
  startPlanCheckoutSchema,
} from '@/validations/plan';
import type { ActionResult } from '@/actions/booking.actions';
import {
  reconcilePendingPayments,
  type ReconcileSummary,
} from '@/services/payment-admin.service';

/**
 * Starts payment for a booking.
 *
 * Returns the gateway's redirect URL rather than redirecting here, so the
 * wizard can show its own "taking you to payment" state instead of the page
 * disappearing mid-transition.
 */
export async function startBookingCheckoutAction(
  bookingId: unknown
): Promise<ActionResult<{ redirectUrl: string; reference: string }>> {
  const user = await getCapableUser('payments:checkout');

  if (!user) return { ok: false, error: 'Please sign in to pay for this lesson' };

  const parsed = objectId.safeParse(bookingId);

  if (!parsed.success) return { ok: false, error: 'That booking reference is not valid' };

  // The callback URL has to be absolute and must match the deployment the user
  // is actually on, so it is read from the request rather than hard-coded.
  const requestHeaders = await headers();
  const host = requestHeaders.get('host');
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const origin = process.env.NEXTAUTH_URL ?? (host ? `${protocol}://${host}` : '');

  if (!origin) {
    return { ok: false, error: 'Payment is not configured correctly. Please contact us.' };
  }

  try {
    const session = await startBookingCheckout({
      user,
      bookingId: parsed.data,
      origin,
    });

    return { ok: true, data: session };
  } catch (error) {
    if (error instanceof BookingPaymentError) {
      return { ok: false, error: error.message };
    }

    console.error('[payment action] checkout failed', error);
    return { ok: false, error: 'Could not start payment. Please try again.' };
  }
}

/**
 * Sweeps payments that are still pending and asks the provider about each.
 *
 * Recovers charges the webhook never settled - a customer who paid and closed
 * the browser, or a webhook URL configured wrongly in the provider dashboard.
 * Owner only, and it still cannot mark anything paid by itself: the sweep
 * delegates to the same verification the return page uses.
 */
export async function reconcilePaymentsAction(): Promise<
  ActionResult<ReconcileSummary>
> {
  const user = await getCapableUser('payments:manage');

  if (!user) return { ok: false, error: 'Please sign in again.' };

  try {
    const summary = await reconcilePendingPayments();

    revalidatePath('/tutor/payments');
    revalidatePath('/tutor/dashboard');

    return { ok: true, data: summary };
  } catch (error) {
    console.error('[payment action] reconcile failed', error);
    return { ok: false, error: 'Could not reach the payment provider. Please try again.' };
  }
}

/**
 * The absolute origin this request arrived on.
 *
 * The gateway's return URL has to match the deployment the payer is actually
 * using - localhost, a phone on the LAN, or production - so it is read from
 * the request rather than written into the environment.
 */
async function requestOrigin(): Promise<string | null> {
  const requestHeaders = await headers();
  const host = requestHeaders.get('host');
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';

  return process.env.NEXTAUTH_URL ?? (host ? `${protocol}://${host}` : null);
}

/** Starts payment for a monthly plan. */
export async function startPlanCheckoutAction(
  input: unknown
): Promise<ActionResult<{ redirectUrl: string; reference: string }>> {
  const user = await getCapableUser('payments:checkout');

  if (!user) return { ok: false, error: 'Please sign in to buy a plan' };

  const parsed = startPlanCheckoutSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Choose a plan' };
  }

  const origin = await requestOrigin();

  if (!origin) {
    return { ok: false, error: 'Payment is not configured correctly. Please contact us.' };
  }

  try {
    const session = await startPlanCheckout({
      user,
      packageSlug: parsed.data.packageSlug,
      studentId: parsed.data.studentId,
      origin,
    });

    return { ok: true, data: session };
  } catch (error) {
    if (error instanceof PlanCheckoutError) return { ok: false, error: error.message };

    console.error('[payment action] plan checkout failed', error);
    return { ok: false, error: 'Could not start payment. Please try again.' };
  }
}

/**
 * Records a cash or EFT payment for one lesson.
 *
 * Owner only, and it can only ever write `cash` or `eft` - the schema has no
 * other option, so no path through here can mark a card payment settled.
 */
export async function recordLessonPaymentAction(
  input: unknown
): Promise<ActionResult<{ reference: string; amount: number }>> {
  const user = await getCapableUser('payments:manage');

  if (!user) return { ok: false, error: 'Please sign in again.' };

  const parsed = recordLessonPaymentSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the details' };
  }

  try {
    const result = await recordLessonPayment({
      user,
      bookingId: parsed.data.bookingId,
      method: parsed.data.method as 'cash' | 'eft',
      note: parsed.data.note,
    });

    revalidatePath('/tutor/payments');
    revalidatePath('/tutor/bookings');
    revalidatePath('/tutor/dashboard');

    return { ok: true, data: { reference: result.reference, amount: result.amount } };
  } catch (error) {
    if (error instanceof ManualPaymentError) return { ok: false, error: error.message };

    console.error('[payment action] record lesson payment failed', error);
    return { ok: false, error: 'Could not record that payment. Please try again.' };
  }
}

/** Records a cash or EFT payment for a monthly plan, and starts the month. */
export async function recordPlanPaymentAction(
  input: unknown
): Promise<ActionResult<{ reference: string; amount: number }>> {
  const user = await getCapableUser('payments:manage');

  if (!user) return { ok: false, error: 'Please sign in again.' };

  const parsed = recordPlanPaymentSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the details' };
  }

  try {
    const result = await recordPlanPayment({
      user,
      studentId: parsed.data.studentId,
      packageSlug: parsed.data.packageSlug,
      method: parsed.data.method as 'cash' | 'eft',
      note: parsed.data.note,
    });

    revalidatePath('/tutor/payments');
    revalidatePath('/tutor/dashboard');

    return { ok: true, data: { reference: result.reference, amount: result.amount } };
  } catch (error) {
    if (error instanceof ManualPaymentError) return { ok: false, error: error.message };

    console.error('[payment action] record plan payment failed', error);
    return { ok: false, error: 'Could not record that payment. Please try again.' };
  }
}

/**
 * Records that a payment was refunded or cancelled.
 *
 * Moves no money: the refund itself happens in the provider's dashboard or the
 * tutor's banking app, and this is the record of it.
 */
export async function setPaymentStatusAction(
  input: unknown
): Promise<ActionResult<{ status: string }>> {
  const user = await getCapableUser('payments:manage');

  if (!user) return { ok: false, error: 'Please sign in again.' };

  const parsed = setPaymentStatusSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Check the details' };
  }

  try {
    const result = await setPaymentStatus({
      user,
      paymentId: parsed.data.paymentId,
      status: parsed.data.status,
      note: parsed.data.note,
    });

    revalidatePath('/tutor/payments');

    return { ok: true, data: { status: result.status } };
  } catch (error) {
    if (error instanceof ManualPaymentError) return { ok: false, error: error.message };

    console.error('[payment action] set status failed', error);
    return { ok: false, error: 'Could not update that payment. Please try again.' };
  }
}
