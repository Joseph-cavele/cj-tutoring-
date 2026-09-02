import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { getStudentPayments } from '@/services/student-payments.service';
import { formatPrice, formatMode } from '@/services/pricing.service';
import { formatBookingDate } from '@/types/booking';
import DashboardSection, { StatTile } from '@/components/dashboard/DashboardSection';
import {
  LessonMeter,
  MethodBadge,
  PlanBadge,
  StatusBadge,
} from '@/components/payments/PaymentBadges';
import PlanChooser from '@/components/payments/PlanChooser';
import { PRIMARY_BUTTON } from '@/components/booking/ui';
import { BOOKING_ROUTE } from '@/lib/routes';

export const dynamic = 'force-dynamic';

/**
 * Payments & Plans, for the student.
 *
 * Answers, in the order a student asks them: what am I on, how much of it is
 * left, what do I owe, and what have I paid. The plan panel leads because it
 * is the thing that changes what booking a lesson costs.
 *
 * Read through the scoped service, so a student sees their own money and
 * nothing else regardless of what the page asks for.
 */
export default async function StudentPaymentsPage() {
  const user = await requireRole('student', '/student/payments');
  const view = await getStudentPayments(user);

  if (!view) {
    return (
      <section className="bg-brand-cream py-10 lg:py-14">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-white p-6 shadow-[var(--shadow-soft)]">
            <h1 className="text-2xl font-extrabold text-brand-navy">Payments</h1>
            <p className="mt-2 text-[15px] text-brand-slate">
              Your student profile is not set up yet, so there is nothing to show here.
              Please contact the office.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const { plan, offers, history, awaitingPayment, totals } = view;
  const planIsUsable = plan?.isUsable ?? false;

  return (
    <section className="bg-brand-cream py-6 lg:py-10">
      <div className="mx-auto max-w-4xl space-y-5 px-4 sm:px-6 lg:px-8">
        <div>
          <Link
            href="/student/dashboard"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to dashboard
          </Link>

          <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            Payments &amp; plans
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-brand-slate">
            What you are on, what is left of it, and everything you have paid.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            label="Paid this month"
            value={formatPrice(totals.paidThisMonth, totals.currency)}
          />
          <StatTile
            label="Paid in total"
            value={formatPrice(totals.paidAllTime, totals.currency)}
          />
          <StatTile
            label="Still to pay"
            value={formatPrice(totals.outstanding, totals.currency)}
            detail={
              awaitingPayment.length > 0
                ? `${awaitingPayment.length} lesson${awaitingPayment.length === 1 ? '' : 's'} waiting`
                : undefined
            }
            highlight={totals.outstanding > 0}
          />
        </div>

        {/* Current plan. Leads the page because it decides what a lesson costs. */}
        <section className="rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <h2 className="text-[18px] font-extrabold text-brand-navy">Your plan</h2>

          {plan ? (
            <div className="mt-4 rounded-2xl border border-brand-blue-100 bg-brand-blue-50/40 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[16px] font-extrabold text-brand-navy">
                    {plan.packageName}
                  </p>
                  <p className="mt-0.5 text-[13px] text-brand-slate">
                    {formatMode(plan.mode)} · {formatPrice(plan.amountPaid, plan.currency)}{' '}
                    paid
                  </p>
                </div>

                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-bold ${
                    planIsUsable
                      ? 'bg-green-100 text-green-900'
                      : 'bg-brand-blue-100 text-brand-navy'
                  }`}
                >
                  {planIsUsable
                    ? 'Active'
                    : plan.status === 'completed'
                      ? 'Completed'
                      : plan.status === 'expired'
                        ? 'Expired'
                        : plan.status}
                </span>
              </div>

              <LessonMeter
                total={plan.sessionsTotal}
                used={plan.sessionsUsed}
                className="mt-4"
              />

              <p className="mt-3 text-[13px] text-brand-slate">
                {planIsUsable
                  ? `Runs until ${formatBookingDate(plan.expiresAt)}. Lessons you book are taken off this plan automatically.`
                  : plan.status === 'completed'
                    ? 'Every lesson on this plan has been used. Renew below to carry on.'
                    : `This plan ended on ${formatBookingDate(plan.expiresAt)}.`}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-brand-blue-100 bg-brand-blue-50/30 p-5">
              <p className="text-[15px] font-semibold text-brand-navy">
                You are paying per lesson
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed text-brand-slate">
                Each lesson is paid for on its own when you book it. A monthly plan
                works out cheaper if you have four or more lessons a month.
              </p>
            </div>
          )}

          <div className="mt-5 border-t border-brand-blue-100 pt-5">
            <h3 className="text-[15px] font-extrabold text-brand-navy">
              {plan && !planIsUsable ? 'Renew your plan' : 'Switch to a monthly plan'}
            </h3>

            <div className="mt-3">
              <PlanChooser
                offers={offers}
                hasUsablePlan={planIsUsable}
                isRenewal={Boolean(plan && !planIsUsable)}
              />
            </div>
          </div>
        </section>

        {/* Lessons booked and not yet paid for. A pay-per-lesson booking cannot
            be attended until this clears, so it is deliberately prominent. */}
        <DashboardSection
          title="Waiting for payment"
          description="These lessons are held for you but cannot go ahead until they are paid for."
          count={awaitingPayment.length}
          emptyTitle="Nothing outstanding"
          emptyBody="Every lesson you have booked is paid for or covered by your plan."
          action={
            <Link href={BOOKING_ROUTE} className={PRIMARY_BUTTON}>
              Book a lesson
            </Link>
          }
        >
          <ul className="space-y-2">
            {awaitingPayment.map((item) => (
              <li
                key={item.bookingId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4"
              >
                <div>
                  <p className="text-[15px] font-semibold text-brand-navy">
                    {item.subject}
                  </p>
                  <p className="mt-0.5 text-[13px] text-brand-slate">
                    {formatBookingDate(item.date)} at {item.startTime}
                  </p>
                </div>

                <p className="text-[16px] font-extrabold text-brand-navy">
                  {formatPrice(item.amount, item.currency)}
                </p>
              </li>
            ))}
          </ul>
        </DashboardSection>

        <DashboardSection
          title="Payment history"
          count={history.length}
          emptyTitle="No payments yet"
          emptyBody="Once you have paid for a lesson or a plan, it will be listed here."
        >
          {/* Scrolls inside itself rather than stretching the page on a phone. */}
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="border-b border-brand-blue-100 text-[12px] font-bold tracking-wider text-brand-slate uppercase">
                  <th className="py-2 pr-3">Date</th>
                  <th className="py-2 pr-3">For</th>
                  <th className="py-2 pr-3">Method</th>
                  <th className="py-2 pr-3">Reference</th>
                  <th className="py-2 pr-3 text-right">Amount</th>
                  <th className="py-2 text-right">Status</th>
                </tr>
              </thead>

              <tbody>
                {history.map((row) => (
                  <tr
                    key={row.paymentId}
                    className="border-b border-brand-blue-50 last:border-0"
                  >
                    <td className="py-3 pr-3 text-[14px] whitespace-nowrap text-brand-slate">
                      {formatBookingDate((row.paidAt ?? row.createdAt).slice(0, 10))}
                    </td>
                    <td className="py-3 pr-3">
                      <PlanBadge plan={row.plan} />
                    </td>
                    <td className="py-3 pr-3">
                      <MethodBadge method={row.method} />
                    </td>
                    <td className="py-3 pr-3 font-mono text-[12px] text-brand-slate">
                      {row.reference}
                    </td>
                    <td className="py-3 pr-3 text-right text-[14px] font-bold text-brand-navy">
                      {formatPrice(row.amount, row.currency)}
                    </td>
                    <td className="py-3 text-right">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardSection>
      </div>
    </section>
  );
}
