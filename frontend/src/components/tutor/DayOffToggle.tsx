'use client';

import { useState, useTransition } from 'react';
import { CalendarOff, Loader2, RotateCcw } from 'lucide-react';

import { addTimeOffAction, removeTimeOffAction } from '@/actions/calendar.actions';
import { ErrorNote } from '@/components/booking/ui';

/**
 * Blocks or reopens one day.
 *
 * When blocking a day that already has lessons on it, the action reports the
 * clash and this shows it rather than pretending the day is clear. Nothing is
 * cancelled automatically - the tutor has to go and deal with those bookings,
 * which is the honest behaviour when a family is already expecting a lesson.
 */
export default function DayOffToggle({
  isoDate,
  isBlocked,
  label,
}: {
  isoDate: string;
  isBlocked: boolean;
  label: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [clash, setClash] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    setError(null);
    setClash(null);

    startTransition(async () => {
      const result = isBlocked
        ? await removeTimeOffAction({ isoDate })
        : await addTimeOffAction({ isoDate });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      if (!isBlocked && result.data && result.data.clashingBookings > 0) {
        setClash(result.data.clashingBookings);
      }
    });
  };

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-label={isBlocked ? `Reopen ${label}` : `Block ${label}`}
        className={
          isBlocked
            ? 'inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-brand-blue px-4 text-[14px] font-semibold text-brand-blue transition-colors hover:bg-brand-blue-50 disabled:opacity-60'
            : 'inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-brand-blue-100 px-4 text-[14px] font-semibold text-brand-slate transition-colors hover:bg-brand-blue-50 disabled:opacity-60'
        }
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : isBlocked ? (
          <RotateCcw className="size-4" aria-hidden="true" />
        ) : (
          <CalendarOff className="size-4" aria-hidden="true" />
        )}
        {isBlocked ? 'Reopen this day' : 'Block this day'}
      </button>

      {clash !== null ? (
        <p
          className="mt-2 rounded-xl bg-brand-amber/15 p-3 text-[13px] leading-relaxed text-brand-navy"
          role="status"
        >
          This day is now closed to new bookings, but{' '}
          <strong className="font-semibold">
            {clash} lesson{clash === 1 ? '' : 's'}
          </strong>{' '}
          {clash === 1 ? 'is' : 'are'} already booked. Nothing was cancelled - please
          contact {clash === 1 ? 'that family' : 'those families'} yourself.
        </p>
      ) : null}

      {error ? (
        <div className="mt-2">
          <ErrorNote message={error} />
        </div>
      ) : null}
    </div>
  );
}
