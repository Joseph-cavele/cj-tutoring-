'use client';

import { useState, useTransition } from 'react';
import { CalendarOff, Loader2 } from 'lucide-react';

import { addTimeOffAction } from '@/actions/calendar.actions';
import { ErrorNote, FIELD_CLASS, PRIMARY_BUTTON } from '@/components/booking/ui';

/**
 * Blocks an arbitrary future date.
 *
 * A button on every cell of the month grid would be thirty buttons on a phone,
 * so blocking a day you can see is done from the agenda below and blocking any
 * other day is done here. A native date input is used deliberately: on a
 * handset it opens the platform picker, which beats anything hand-rolled.
 */
export default function BlockDayForm({ minIsoDate }: { minIsoDate: string }) {
  const [isoDate, setIsoDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNote(null);

    startTransition(async () => {
      const result = await addTimeOffAction({ isoDate, reason });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setNote(
        result.data.clashingBookings > 0
          ? `Blocked. ${result.data.clashingBookings} lesson${
              result.data.clashingBookings === 1 ? ' is' : 's are'
            } already booked that day and ${
              result.data.clashingBookings === 1 ? 'was' : 'were'
            } not cancelled.`
          : 'Blocked. Students can no longer book that day.'
      );
      setIsoDate('');
      setReason('');
    });
  };

  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-[17px] font-bold text-brand-navy">Block a day</h2>
      <p className="mt-1 text-[14px] text-brand-slate">
        A public holiday, or a day you are away. Students cannot book it, and your
        weekly hours stay exactly as they are.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end">
        <div>
          <label htmlFor="off-date" className="block text-[14px] font-semibold text-brand-navy">
            Date
          </label>
          <input
            id="off-date"
            type="date"
            required
            min={minIsoDate}
            value={isoDate}
            onChange={(event) => setIsoDate(event.target.value)}
            disabled={pending}
            className={`${FIELD_CLASS} mt-1`}
          />
        </div>

        <div>
          <label htmlFor="off-reason" className="block text-[14px] font-semibold text-brand-navy">
            Reason <span className="font-normal text-brand-slate">(optional)</span>
          </label>
          <input
            id="off-reason"
            type="text"
            maxLength={120}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={pending}
            placeholder="Public holiday"
            className={`${FIELD_CLASS} mt-1`}
          />
        </div>

        <button type="submit" disabled={pending || !isoDate} className={PRIMARY_BUTTON}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <CalendarOff className="size-4" aria-hidden="true" />
          )}
          Block
        </button>
      </div>

      {note ? (
        <p className="mt-3 rounded-xl bg-brand-blue-50 p-3 text-[14px] text-brand-navy" role="status">
          {note}
        </p>
      ) : null}

      {error ? (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      ) : null}
    </form>
  );
}
