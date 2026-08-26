import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';

import { auth } from '@/auth';
import { connectDB } from '@/lib/mongodb';
import { Payment } from '@/models';
import { verifyAnyPayment } from '@/services/payment-router.service';
import { formatPrice } from '@/services/pricing.service';
import { homeForRole } from '@/lib/routes';
import type { Role } from '@/models/types';

export const metadata: Metadata = {
  title: 'Payment | CJ Private Tutoring',
};

export const dynamic = 'force-dynamic';

/**
 * Where the gateway returns the customer.
 *
 * This page never decides an outcome from the URL. It re-asks the provider
 * over a server-to-server call and settles through the same path the webhook
 * uses, so editing the query string cannot pay for a lesson
 * (brief section 14).
 */
export default async function CheckoutCompletePage({
  searchParams,
}: {
  searchParams: Promise<{ reference?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) redirect('/login');

  const { reference } = await searchParams;

  await connectDB();

  // Scoped to the payer, so one customer cannot inspect another's reference.
  const payment = reference
    ? await Payment.findOne({ reference, paidBy: session.user.id })
        .select('reference status amount currency booking')
        .lean()
    : null;

  // Only verify a payment that is genuinely this user's and not yet settled.
  const outcome = payment && payment.status !== 'successful'
    ? await verifyAnyPayment(payment.reference)
    : payment?.status === 'successful'
      ? 'successful'
      : 'unknown';

  const isLesson = Boolean(payment?.booking);
  const dashboard = homeForRole(session.user.role as Role | undefined);

  return (
    <section className="bg-brand-cream py-16 lg:py-24">
      <div className="mx-auto max-w-lg px-4 text-center sm:px-6">
        <div className="rounded-3xl bg-white p-8 shadow-[var(--shadow-soft)]">
          <StatusIcon outcome={outcome} />

          <h1 className="mt-4 text-2xl font-extrabold text-brand-navy">
            {titleFor(outcome)}
          </h1>

          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-brand-slate">
            {bodyFor(outcome, isLesson)}
          </p>

          {payment ? (
            <dl className="mt-6 space-y-2 border-t border-brand-blue-100 pt-6 text-left text-[14px]">
              <div className="flex justify-between gap-4">
                <dt className="text-brand-slate">Reference</dt>
                <dd className="font-semibold break-all text-brand-navy">
                  {payment.reference}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-brand-slate">Amount</dt>
                <dd className="font-semibold text-brand-navy">
                  {formatPrice(payment.amount, payment.currency)}
                </dd>
              </div>
            </dl>
          ) : null}

          <Link
            href={dashboard}
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-brand-blue px-7 text-[15px] font-semibold text-white transition-colors hover:bg-brand-blue-dark"
          >
            Go to my dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}

function StatusIcon({ outcome }: { outcome: string }) {
  if (outcome === 'successful') {
    return <CheckCircle2 className="mx-auto size-12 text-brand-blue" aria-hidden="true" />;
  }

  if (outcome === 'failed') {
    return <XCircle className="mx-auto size-12 text-red-600" aria-hidden="true" />;
  }

  return <Clock className="mx-auto size-12 text-brand-amber" aria-hidden="true" />;
}

function titleFor(outcome: string): string {
  if (outcome === 'successful') return 'Payment received';
  if (outcome === 'failed') return 'Payment did not go through';
  if (outcome === 'unknown') return 'We could not find that payment';
  return 'Confirming your payment';
}

function bodyFor(outcome: string, isLesson: boolean): string {
  if (outcome === 'successful') {
    return isLesson
      ? 'Your lesson request has been sent to the tutor. You will see it change to confirmed on your dashboard once they accept.'
      : 'Your package is active and your lessons can be scheduled.';
  }

  if (outcome === 'failed') {
    return isLesson
      ? 'Nothing was charged. Your booking is still held on your dashboard, where you can try paying again.'
      : 'Nothing was charged. You can try again from the pricing page.';
  }

  if (outcome === 'unknown') {
    return 'That reference does not belong to your account. If you have just paid, check your dashboard in a moment.';
  }

  return 'This can take a few moments. Refresh shortly, or check your dashboard.';
}
