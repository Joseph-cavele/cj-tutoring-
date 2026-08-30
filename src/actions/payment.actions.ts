'use server';
import { revalidatePath } from 'next/cache';

import { headers } from 'next/headers';

import { getCapableUser } from '@/lib/auth/guard';
import {
  BookingPaymentError,
  startBookingCheckout,
} from '@/services/booking-payment.service';
import { objectId } from '@/validations/lesson-booking';
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
