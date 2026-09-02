import Link from 'next/link';
import { ArrowLeft, Search } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { STAFF_ROLES } from '@/lib/auth/roles';
import {
  getPaymentTotals,
  listInvoices,
  listPayments,
  type PaymentRow,
} from '@/services/payment-admin.service';
import { PAYMENT_STATUS, type PaymentStatus } from '@/models/types';
import { formatPrice } from '@/services/pricing.service';
import { monthlyPackages } from '@/services/plan.service';
import { listUnpaidLessons, listStudentOptions } from '@/services/payment-admin.service';
import ReconcilePayments from '@/components/owner/ReconcilePayments';
import RecordPayment from '@/components/owner/RecordPayment';
import {
  MethodBadge,
  PlanBadge,
  StatusBadge,
} from '@/components/payments/PaymentBadges';
import DashboardSection, { StatTile } from '@/components/dashboard/DashboardSection';
import { FIELD_CLASS, PRIMARY_BUTTON } from '@/components/booking/ui';

export const dynamic = 'force-dynamic';

/**
 * Payments and invoices (CLAUDE.md sections 11 and 20).
 *
 * Read-only. A payment becomes successful in the verified webhook and nowhere
 * else, so there is deliberately no control on this page that could mark one
 * paid - that would reintroduce exactly the trust in the client that the
 * webhook design exists to avoid.
 */
export default async function AdminPaymentsPage(props: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requireRole(STAFF_ROLES, '/tutor/payments');

  // searchParams is a Promise in Next 16.
  const params = await props.searchParams;

  const status = (PAYMENT_STATUS as readonly string[]).includes(params.status ?? '')
    ? (params.status as PaymentStatus)
    : undefined;

  const query = params.q?.trim() || undefined;

  const [totals, payments, invoices, unpaidLessons, students, offers] =
    await Promise.all([
      getPaymentTotals(),
      listPayments({ status, query }),
      listInvoices(),
      listUnpaidLessons(),
      listStudentOptions(),
      monthlyPackages(),
    ]);

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div>
          <Link
            href="/tutor/dashboard"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to dashboard
          </Link>

          <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            Payments
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-brand-slate">
            What has been collected, what is outstanding, and every invoice
            issued. Payment status is set by the payment provider, not here.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Collected"
            value={formatPrice(totals.collected, totals.currency)}
            detail="all time"
          />
          <StatTile
            label="This month"
            value={formatPrice(totals.collectedThisMonth, totals.currency)}
            detail="received"
          />
          <StatTile
            label="Outstanding"
            value={formatPrice(totals.outstandingTotal, totals.currency)}
            detail={`${totals.unpaidBookings} lesson${
              totals.unpaidBookings === 1 ? '' : 's'
            }, ${totals.unpaidPlans} plan${totals.unpaidPlans === 1 ? '' : 's'}`}
            highlight={totals.outstandingTotal > 0}
          />
          <StatTile
            label="Plans running"
            value={totals.activePlans}
            detail={`${totals.lessonsOnActivePlans} lesson${
              totals.lessonsOnActivePlans === 1 ? '' : 's'
            } still owed`}
          />
        </div>

        {totals.unpaidBookings > 0 ? (
          <div className="rounded-2xl bg-brand-amber/15 p-5">
            <h2 className="text-[16px] font-bold text-brand-amber-text">
              {totals.unpaidBookings} booking
              {totals.unpaidBookings === 1 ? '' : 's'} holding a slot without payment
            </h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-brand-navy">
              These reserve a tutor&rsquo;s time but never reached the tutor for
              approval. Cancel them from the bookings page to free the slots.
            </p>
            <Link
              href="/tutor/bookings?status=pending"
              className="mt-3 inline-flex min-h-11 items-center rounded-full border-[1.5px] border-brand-blue bg-white px-4 text-[14px] font-semibold text-brand-blue hover:bg-brand-blue-50"
            >
              Review pending bookings
            </Link>
          </div>
        ) : null}

        <ReconcilePayments />

        {/* Cash and EFT. The one place a human, rather than a gateway, says
            money arrived - so it is kept visibly apart from the read-only
            figures above. */}
        <section className="rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <h2 className="text-[18px] font-extrabold text-brand-navy">
            Record a cash or EFT payment
          </h2>
          <p className="mt-1 text-[14px] leading-relaxed text-brand-slate">
            For money that did not come through the card gateway. The amount is
            taken from the lesson or plan being settled, so there is nothing to
            mistype.
          </p>

          <div className="mt-4">
            <RecordPayment
              unpaidLessons={unpaidLessons}
              students={students}
              offers={offers}
            />
          </div>
        </section>

        <form
          action="/tutor/payments"
          className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-[var(--shadow-soft)] sm:flex-row"
        >
          <label className="flex-1">
            <span className="sr-only">Search by reference</span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-brand-slate"
                aria-hidden="true"
              />
              <input
                name="q"
                defaultValue={query ?? ''}
                placeholder="Search by reference, e.g. CJL-..."
                className={`${FIELD_CLASS} pl-11`}
              />
            </div>
          </label>

          <label>
            <span className="sr-only">Filter by status</span>
            <select
              name="status"
              defaultValue={status ?? ''}
              className={`${FIELD_CLASS} capitalize sm:w-44`}
            >
              <option value="">All statuses</option>
              {PAYMENT_STATUS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>

          <button type="submit" className={PRIMARY_BUTTON}>
            Search
          </button>
        </form>

        <DashboardSection
          title={status ? `${status} payments` : 'Payments'}
          count={payments.length}
          emptyTitle="No payments found"
          emptyBody={
            status || query
              ? 'Nothing matches that search.'
              : 'Payments appear here as lessons and packages are bought.'
          }
        >
          <ul className="space-y-2">
            {payments.map((payment) => (
              <li key={payment.paymentId}>
                <PaymentCard payment={payment} />
              </li>
            ))}
          </ul>
        </DashboardSection>

        <DashboardSection
          title="Invoices"
          description="Issued automatically after each successful payment."
          count={invoices.length}
          emptyTitle="No invoices yet"
          emptyBody="An invoice is generated for every payment that settles."
        >
          <ul className="divide-y divide-brand-blue-100 rounded-2xl border border-brand-blue-100 bg-white">
            {invoices.map((invoice) => (
              <li
                key={invoice.invoiceId}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-brand-navy">
                    {invoice.invoiceNumber}
                  </p>
                  <p className="mt-0.5 text-[13px] text-brand-slate">
                    {invoice.description} · {invoice.studentName} · billed to{' '}
                    {invoice.billedToName}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[15px] font-bold text-brand-navy">
                    {formatPrice(invoice.total, invoice.currency)}
                  </p>
                  <p className="text-[13px] text-brand-slate">
                    {invoice.paidAt
                      ? `Paid ${formatDate(invoice.paidAt)}`
                      : `Issued ${formatDate(invoice.issuedAt)}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </DashboardSection>
      </div>
    </section>
  );
}

function PaymentCard({ payment }: { payment: PaymentRow }) {
  return (
    <article className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-blue-100 bg-white p-4">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[14px] font-semibold break-all text-brand-navy">
            {payment.reference}
          </span>
          <StatusBadge status={payment.status} />
          <PlanBadge plan={payment.plan} />
          <MethodBadge method={payment.method} />
        </p>

        <p className="mt-1 text-[13px] text-brand-slate">
          {payment.purchase} · {payment.studentName} · paid by {payment.payerName}
          {payment.isManual ? ' · recorded by hand' : ` · ${payment.provider}`}
        </p>

        {/* Only a monthly payment has a drawdown to report. */}
        {payment.lessonsTotal !== null && payment.lessonsRemaining !== null ? (
          <p className="mt-0.5 text-[13px] font-semibold text-brand-navy">
            {payment.lessonsRemaining === 0
              ? `Plan completed · ${payment.lessonsTotal} of ${payment.lessonsTotal} used`
              : `${payment.lessonsUsed} of ${payment.lessonsTotal} lessons used · ${payment.lessonsRemaining} remaining`}
          </p>
        ) : null}

        {payment.note ? (
          <p className="mt-0.5 text-[13px] break-words text-brand-slate">
            {payment.note}
          </p>
        ) : null}

        {payment.invoiceNumber ? (
          <p className="mt-0.5 text-[13px] text-brand-slate">
            Invoice {payment.invoiceNumber}
          </p>
        ) : null}
      </div>

      <div className="text-right">
        <p className="text-[16px] font-extrabold text-brand-navy">
          {formatPrice(payment.amount, payment.currency)}
        </p>
        <p className="text-[13px] text-brand-slate">
          {payment.paidAt
            ? formatDate(payment.paidAt)
            : `Started ${formatDate(payment.createdAt)}`}
        </p>
      </div>
    </article>
  );
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}
