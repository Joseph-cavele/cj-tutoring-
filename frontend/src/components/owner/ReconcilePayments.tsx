'use client';

import { useState, useTransition } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

import { reconcilePaymentsAction } from '@/actions/payment.actions';
import type { ReconcileSummary } from '@/services/payment-admin.service';
import { ErrorNote, SECONDARY_BUTTON } from '@/components/booking/ui';

/**
 * Recovers payments the webhook never settled.
 *
 * Normally there is nothing to do here: the webhook settles a charge within
 * seconds, and the return page catches anything it misses. This matters in the
 * one case neither covers - the customer paid, closed the browser, and the
 * webhook did not arrive - where the money has left their account and the
 * lesson is still showing unpaid.
 *
 * Wired to a button rather than run on a timer because it calls a third party
 * once per pending payment, and because a tutor chasing a specific customer
 * wants it to happen now, not on the next tick.
 */
export default function ReconcilePayments() {
  const [summary, setSummary] = useState<ReconcileSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () => {
    setError(null);
    setSummary(null);

    startTransition(async () => {
      const result = await reconcilePaymentsAction();

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSummary(result.data);
    });
  };

  return (
    <div className="rounded-2xl bg-white p-5 shadow-[var(--shadow-soft)]">
      <h2 className="text-[17px] font-bold text-brand-navy">Check pending payments</h2>
      <p className="mt-1 max-w-2xl text-[14px] leading-relaxed text-brand-slate">
        Asks Paystack what happened to every payment still showing as pending.
        Use this if a student says they paid but their lesson is not confirmed.
      </p>

      <button type="button" onClick={run} disabled={pending} className={`${SECONDARY_BUTTON} mt-3`}>
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw className="size-4" aria-hidden="true" />
        )}
        {pending ? 'Checking with Paystack' : 'Check now'}
      </button>

      {summary ? (
        <div className="mt-3 rounded-xl bg-brand-blue-50 p-4 text-[14px]" role="status">
          {summary.checked === 0 ? (
            <p className="text-brand-navy">
              Nothing to check. No payments are sitting unresolved.
            </p>
          ) : (
            <>
              <p className="font-semibold text-brand-navy">
                Checked {summary.checked} pending payment
                {summary.checked === 1 ? '' : 's'}.
              </p>
              <ul className="mt-1 space-y-0.5 text-brand-slate">
                <li>{summary.settled} now marked paid</li>
                <li>{summary.failed} confirmed failed</li>
                <li>{summary.stillPending} still unresolved at Paystack</li>
              </ul>
            </>
          )}
        </div>
      ) : null}

      {error ? (
        <div className="mt-3">
          <ErrorNote message={error} />
        </div>
      ) : null}
    </div>
  );
}
