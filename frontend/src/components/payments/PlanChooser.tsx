'use client';

import { useState, useTransition } from 'react';
import { AlertCircle, Check, Loader2 } from 'lucide-react';

import { startPlanCheckoutAction } from '@/actions/payment.actions';
import { formatMode, formatPrice } from '@/lib/payments/format';
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from '@/components/booking/ui';

type Offer = {
  slug: string;
  name: string;
  description: string;
  mode: string;
  sessionsIncluded: number;
  amount: number;
  currency: string;
};

/**
 * Switching between paying per lesson and paying monthly.
 *
 * Pay-per-lesson is not a purchase - it is what happens when no plan is
 * running - so it is shown as the state it is rather than as a button that
 * buys something. There is deliberately no "cancel my plan" control: a month
 * already paid for keeps its lessons until they are used or the window closes,
 * and a button implying otherwise would be selling a refund the tutor has not
 * agreed to.
 */
export default function PlanChooser({
  offers,
  hasUsablePlan,
  isRenewal,
}: {
  offers: Offer[];
  hasUsablePlan: boolean;
  isRenewal: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  function buy(slug: string) {
    setError(null);
    setBusySlug(slug);

    startTransition(async () => {
      const result = await startPlanCheckoutAction({ packageSlug: slug });

      if (!result.ok) {
        setError(result.error);
        setBusySlug(null);
        return;
      }

      // Full navigation, not a router push: the gateway is another origin.
      window.location.href = result.data.redirectUrl;
    });
  }

  if (offers.length === 0) {
    return (
      <p className="text-[14px] text-brand-slate">
        Monthly plans are not set up yet. Please contact the office.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-[14px] text-red-900"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {offers.map((offer) => (
          <div
            key={offer.slug}
            className="rounded-2xl border border-brand-blue-100 bg-white p-4"
          >
            <p className="text-[15px] font-extrabold text-brand-navy">{offer.name}</p>
            <p className="mt-0.5 text-[13px] text-brand-slate">
              {formatMode(offer.mode)}
            </p>

            <p className="mt-3 text-[24px] leading-none font-extrabold text-brand-navy">
              {formatPrice(offer.amount, offer.currency)}
              <span className="ml-1 text-[13px] font-semibold text-brand-slate">
                / month
              </span>
            </p>

            <p className="mt-2 flex items-center gap-1.5 text-[14px] text-brand-slate">
              <Check className="size-4 text-brand-blue" aria-hidden="true" />
              {offer.sessionsIncluded} × 1-hour lessons
            </p>

            <button
              type="button"
              onClick={() => buy(offer.slug)}
              disabled={pending || hasUsablePlan}
              className={`${hasUsablePlan ? SECONDARY_BUTTON : PRIMARY_BUTTON} mt-4 w-full`}
            >
              {pending && busySlug === offer.slug ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Taking you to payment
                </>
              ) : hasUsablePlan ? (
                'Plan already running'
              ) : isRenewal ? (
                'Renew this plan'
              ) : (
                'Choose this plan'
              )}
            </button>
          </div>
        ))}
      </div>

      {hasUsablePlan ? (
        <p className="text-[13px] leading-relaxed text-brand-slate">
          You already have a plan running. You can buy the next one once it is used
          up or the month ends - that way no lessons are lost.
        </p>
      ) : (
        <p className="text-[13px] leading-relaxed text-brand-slate">
          Prefer to pay as you go? Do nothing. With no plan running, each lesson is
          paid for on its own when you book it.
        </p>
      )}
    </div>
  );
}
