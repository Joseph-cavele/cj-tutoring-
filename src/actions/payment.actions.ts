'use server';

import { headers } from 'next/headers';

import { getCapableUser } from '@/lib/auth/guard';
import {
  BookingPaymentError,
  startBookingCheckout,
} from '@/services/booking-payment.service';
import { objectId } from '@/validations/lesson-booking';
import type { ActionResult } from '@/actions/booking.actions';

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
