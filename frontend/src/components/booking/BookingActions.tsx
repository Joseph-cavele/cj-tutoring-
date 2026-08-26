'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2, X } from 'lucide-react';

import { cancelBookingAction, decideBookingAction } from '@/actions/booking.actions';
import { ErrorNote } from '@/components/booking/ui';

/**
 * Buttons that change a booking's status.
 *
 * They only ask - the server decides. Rendering an Accept button does not make
 * the caller the assigned tutor; the action re-checks the session, the role
 * and the ownership of the booking before anything is written
 * (brief section 15).
 */

const SMALL_BUTTON =
  'inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-4 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2';

/** Tutor's Accept / Reject pair (brief section 9). */
export function TutorDecision({ bookingId }: { bookingId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [pending, startTransition] = useTransition();

  const decide = (decision: 'accepted' | 'rejected') => {
    setError(null);

    startTransition(async () => {
      const result = await decideBookingAction({
        bookingId,
        decision,
        note: decision === 'rejected' ? note.trim() || undefined : undefined,
      });

      if (!result.ok) setError(result.error);
      // On success the action revalidates the dashboard, so this card is
      // replaced by the server-rendered one in its new state.
    });
  };

  return (
    <div>
      {rejecting ? (
        <div className="space-y-2">
          <label
            htmlFor={`reject-note-${bookingId}`}
            className="block text-[13px] font-semibold text-brand-navy"
          >
            Why are you declining? (optional, the student will see this)
          </label>
          <textarea
            id={`reject-note-${bookingId}`}
            rows={2}
            maxLength={500}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="I have a clash at that time — try 15:00?"
            className="min-h-12 w-full rounded-xl border border-brand-blue-100 bg-brand-blue-50/40 px-3 py-2 text-[14px] text-brand-navy focus:border-brand-blue focus:bg-white focus:outline-2 focus:outline-offset-1 focus:outline-brand-blue"
          />
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide('accepted')}
          className={`${SMALL_BUTTON} bg-brand-blue text-white hover:bg-brand-blue-dark focus-visible:outline-brand-blue`}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="size-4" aria-hidden="true" />
          )}
          Accept booking
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => (rejecting ? decide('rejected') : setRejecting(true))}
          className={`${SMALL_BUTTON} border-[1.5px] border-red-200 text-red-700 hover:bg-red-50 focus-visible:outline-red-500`}
        >
          <X className="size-4" aria-hidden="true" />
          {rejecting ? 'Confirm decline' : 'Reject booking'}
        </button>
      </div>

      {rejecting ? (
        <button
          type="button"
          onClick={() => {
            setRejecting(false);
            setNote('');
          }}
          className="mt-2 text-[13px] font-semibold text-brand-slate underline underline-offset-2"
        >
          Never mind
        </button>
      ) : null}

      {error ? (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * Cancel, for whoever owns the booking.
 *
 * Two-step so a lesson is not dropped by a mis-tap on a phone.
 */
export function CancelBooking({
  bookingId,
  label = 'Cancel booking',
}: {
  bookingId: string;
  label?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const cancel = () => {
    setError(null);

    startTransition(async () => {
      const result = await cancelBookingAction({ bookingId });

      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
      }
    });
  };

  if (!confirming) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-[14px] font-semibold text-brand-slate underline underline-offset-2 hover:text-red-700"
        >
          {label}
        </button>
        {error ? (
          <div className="mt-3">
            <ErrorNote message={error} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-red-50 p-3">
      <p className="text-[14px] font-medium text-red-800">
        Cancel this lesson? The time will be released for someone else.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={cancel}
          className={`${SMALL_BUTTON} bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-500`}
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Yes, cancel
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className={`${SMALL_BUTTON} border-[1.5px] border-brand-blue-100 text-brand-navy hover:bg-white focus-visible:outline-brand-blue`}
        >
          Keep it
        </button>
      </div>
    </div>
  );
}
