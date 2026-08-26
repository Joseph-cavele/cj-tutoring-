'use client';

import { useState, useTransition } from 'react';
import { CreditCard, Loader2 } from 'lucide-react';

import { startBookingCheckoutAction } from '@/actions/payment.actions';
import { ErrorNote, PRIMARY_BUTTON } from '@/components/booking/ui';

/**
 * Resumes payment for a booking that is holding a slot but is not paid yet.
 *
 * The amount is not passed in from here - the server reads it off the booking -
 * so this button cannot influence what is charged.
 */
export default function PayNowButton({
  bookingId,
  amount,
  currency,
}: {
  bookingId: string;
  amount: number;
  currency: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const pay = () => {
    setError(null);

    startTransition(async () => {
      const result = await startBookingCheckoutAction(bookingId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      window.location.href = result.data.redirectUrl;
    });
  };

  const price = new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace(/^(\D+)\s/, '$1');

  return (
    <div>
      <button type="button" onClick={pay} disabled={pending} className={PRIMARY_BUTTON}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <CreditCard className="size-4" aria-hidden="true" />
        )}
        Pay {price}
      </button>

      {error ? (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      ) : null}
    </div>
  );
}
