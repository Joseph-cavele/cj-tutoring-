'use client';

import { useState, useTransition } from 'react';
import { Check, Loader2, Pencil } from 'lucide-react';

import { adjustMarkAction } from '@/actions/test.actions';
import { ErrorNote, FIELD_CLASS, PRIMARY_BUTTON } from '@/components/booking/ui';

/**
 * Overriding one AI or automatic mark (brief section 12).
 *
 * A reason is required, because the change is written to an append-only audit
 * record along with the original mark, the new mark, who changed it and when.
 * The server refuses a mark above the question's allocation, so a tutor cannot
 * award eleven out of five either.
 */
export default function MarkAdjuster({
  attemptId,
  questionId,
  currentMarks,
  maxMarks,
}: {
  attemptId: string;
  questionId: string;
  currentMarks: number;
  maxMarks: number;
}) {
  const [open, setOpen] = useState(false);
  const [marks, setMarks] = useState(currentMarks);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const apply = () => {
    setError(null);

    startTransition(async () => {
      const result = await adjustMarkAction({
        attemptId,
        questionId,
        newMarks: marks,
        reason,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setDone(true);
      setOpen(false);
    });
  };

  if (done) {
    return (
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-green-700">
        <Check className="size-4" aria-hidden="true" />
        Mark updated to {marks}/{maxMarks}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1.5 text-[13px] font-semibold text-brand-blue hover:underline"
      >
        <Pencil className="size-3.5" aria-hidden="true" />
        Adjust this mark
      </button>
    );
  }

  return (
    <div className="rounded-xl bg-brand-blue-50/60 p-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="block text-[13px] font-semibold text-brand-navy">
            Marks (max {maxMarks})
          </span>
          <input
            type="number"
            min={0}
            max={maxMarks}
            step={0.5}
            value={marks}
            onChange={(event) => setMarks(Number(event.target.value))}
            className="mt-1 min-h-11 w-24 rounded-xl border border-brand-blue-100 bg-white px-3 text-center text-[15px] text-brand-navy"
          />
        </label>

        <label className="block flex-1">
          <span className="block text-[13px] font-semibold text-brand-navy">
            Reason (recorded)
          </span>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Correct method, arithmetic slip only"
            maxLength={500}
            className={`${FIELD_CLASS} mt-1`}
          />
        </label>
      </div>

      {error ? (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={apply}
          disabled={pending || reason.trim().length < 3}
          className={PRIMARY_BUTTON}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Saving&hellip;
            </>
          ) : (
            'Save mark'
          )}
        </button>

        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="inline-flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-brand-blue-100 bg-white px-5 text-[15px] font-semibold text-brand-navy hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
