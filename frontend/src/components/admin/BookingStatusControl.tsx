'use client';

import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';

import { adminSetBookingStatusAction } from '@/actions/booking.actions';
import { BOOKING_STATUSES, type BookingStatus } from '@/lib/booking/constants';
import { ErrorNote, FIELD_CLASS } from '@/components/booking/ui';

/**
 * Admin override for a booking's status (brief section 12).
 *
 * The dropdown is a convenience; the action still checks that the caller is
 * an admin before it writes, so this control being on the page is not what
 * grants the power.
 */
export default function BookingStatusControl({
  bookingId,
  status,
}: {
  bookingId: string;
  status: BookingStatus;
}) {
  const [next, setNext] = useState<BookingStatus>(status);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const apply = (value: BookingStatus) => {
    setNext(value);
    setError(null);

    startTransition(async () => {
      const result = await adminSetBookingStatusAction({ bookingId, status: value });

      if (!result.ok) {
        setError(result.error);
        // Put the control back where it was, so it never shows a state the
        // database does not actually hold.
        setNext(status);
      }
    });
  };

  return (
    <div>
      <label
        htmlFor={`status-${bookingId}`}
        className="block text-[13px] font-semibold text-brand-navy"
      >
        Change status
      </label>

      <div className="mt-1 flex items-center gap-2">
        <select
          id={`status-${bookingId}`}
          value={next}
          disabled={pending}
          onChange={(event) => apply(event.target.value as BookingStatus)}
          className={`${FIELD_CLASS} max-w-56`}
        >
          {BOOKING_STATUSES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        {pending ? (
          <Loader2 className="size-4 animate-spin text-brand-blue" aria-hidden="true" />
        ) : null}
      </div>

      {error ? (
        <div className="mt-2">
          <ErrorNote message={error} />
        </div>
      ) : null}
    </div>
  );
}
