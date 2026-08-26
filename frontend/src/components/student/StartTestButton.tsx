'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, PlayCircle } from 'lucide-react';

import { startAttemptAction } from '@/actions/test.actions';
import { ErrorNote, PRIMARY_BUTTON } from '@/components/booking/ui';

/**
 * Opens a test.
 *
 * Starting is a server action rather than a link, because it creates the
 * attempt and stamps the deadline - the timer has to begin on the server, at a
 * moment the student cannot choose.
 */
export default function StartTestButton({
  testId,
  durationMinutes,
}: {
  testId: string;
  durationMinutes: number;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const start = () => {
    setError(null);

    startTransition(async () => {
      const result = await startAttemptAction(testId);

      if (!result.ok) {
        setError(result.error);
        setConfirming(false);
        return;
      }

      router.push(`/student/tests/${result.data.attemptId}`);
    });
  };

  if (!confirming) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className={PRIMARY_BUTTON}
        >
          <PlayCircle className="size-4" aria-hidden="true" />
          Start test
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
    <div className="rounded-xl bg-brand-amber/15 p-4">
      <h3 className="text-[15px] font-bold text-brand-navy">Before you start</h3>
      <ul className="mt-2 space-y-1 text-[14px] leading-relaxed text-brand-navy">
        <li>You have {durationMinutes} minutes once you begin.</li>
        <li>The timer keeps running if you close the page.</li>
        <li>Your answers are saved as you work.</li>
        <li>The test submits itself when the time runs out.</li>
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={start}
          disabled={pending}
          className={PRIMARY_BUTTON}
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Opening&hellip;
            </>
          ) : (
            'Begin now'
          )}
        </button>

        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={pending}
          className="inline-flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-brand-blue-100 bg-white px-6 text-[15px] font-semibold text-brand-navy hover:bg-brand-blue-50"
        >
          Not yet
        </button>
      </div>

      {error ? (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      ) : null}
    </div>
  );
}
