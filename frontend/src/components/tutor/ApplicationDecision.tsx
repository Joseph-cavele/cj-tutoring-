'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2, X } from 'lucide-react';

import { decideApplicationAction } from '@/actions/application.actions';
import { ErrorNote, FIELD_CLASS, PRIMARY_BUTTON } from '@/components/booking/ui';

/**
 * Accept or decline one application.
 *
 * Declining asks for a note first. Accepting does not: a decline is the one
 * that lands badly and is worth a sentence, and making the tutor type
 * something to say yes would only slow down the common case.
 */
export default function ApplicationDecision({
  userId,
  name,
}: {
  userId: string;
  name: string;
}) {
  const [note, setNote] = useState('');
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const decide = (decision: 'approved' | 'rejected') => {
    setError(null);

    startTransition(async () => {
      const result = await decideApplicationAction({
        userId,
        decision,
        note: note.trim() || undefined,
      });

      // On success the row disappears when the page revalidates, so there is
      // nothing to reset here.
      if (!result.ok) setError(result.error);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => decide('approved')}
          className={PRIMARY_BUTTON}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Check className="size-4" aria-hidden="true" />
          )}
          Accept
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirmingDecline((current) => !current)}
          aria-expanded={confirmingDecline}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border-[1.5px] border-red-200 px-6 text-[15px] font-semibold text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
        >
          <X className="size-4" aria-hidden="true" />
          Decline
        </button>
      </div>

      {confirmingDecline ? (
        <div className="rounded-xl bg-red-50 p-4">
          <label className="block">
            <span className="block text-[13px] font-semibold text-brand-navy">
              Reason (optional) &mdash; {name} will see this in their email
            </span>
            <input
              type="text"
              maxLength={300}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="We are fully booked for Grade 12 this term"
              className={`${FIELD_CLASS} mt-1`}
            />
          </label>

          <button
            type="button"
            disabled={pending}
            onClick={() => decide('rejected')}
            className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-red-600 px-6 text-[15px] font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Declining&hellip;
              </>
            ) : (
              `Decline ${name.split(' ')[0]}`
            )}
          </button>
        </div>
      ) : null}

      {error ? <ErrorNote message={error} /> : null}
    </div>
  );
}
