import { connectDB } from '@/lib/mongodb';
import { Booking, Invoice, Payment } from '@/models';
import type { PaymentStatus } from '@/models/types';
import { verifyAnyPayment } from '@/services/payment-router.service';

/**
 * Money, as the owner needs to see it (CLAUDE.md section 11).
 *
 * Reading is the bulk of it, and nothing here DECIDES an outcome. The one
 * write - `reconcilePendingPayments` - does not judge a payment itself: it
 * asks the provider over a server-to-server call and settles through exactly
 * the same code the webhook uses, so there is still one place, and only one,
 * where a payment becomes successful (CLAUDE.md section 19).
 *
 * A screen that could simply mark a charge paid would defeat the whole point
 * of not trusting the client, and there is deliberately no such function.
 */

export type PaymentRow = {
  paymentId: string;
  reference: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  provider: string;
  paidAt: string | null;
  createdAt: string;
  payerName: string;
  studentName: string;
  /** What the payment bought, in words. */
  purchase: string;
  invoiceNumber: string | null;
};

export type PaymentTotals = {
  /** Rand actually received. */
  collected: number;
  /** Rand started but never settled - abandoned checkouts, mostly. */
  pending: number;
  failed: number;
  refunded: number;
  currency: string;
  collectedThisMonth: number;
  /** Lessons holding a slot that were never paid for. */
  unpaidBookings: number;
  unpaidBookingValue: number;
};

/**
 * Headline figures.
 *
 * Computed with aggregation rather than by loading every payment, so this
 * stays cheap as the table grows.
 */
export async function getPaymentTotals(): Promise<PaymentTotals> {
  await connectDB();

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [byStatus, thisMonth, unpaid] = await Promise.all([
    Payment.aggregate<{ _id: PaymentStatus; total: number }>([
      { $group: { _id: '$status', total: { $sum: '$amount' } } },
    ]),
    Payment.aggregate<{ total: number }>([
      { $match: { status: 'successful', paidAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    // A booking that holds a slot but was never paid for is money the
    // business expected and did not get, so it belongs on this page.
    Booking.aggregate<{ count: number; total: number }>([
      {
        $match: {
          paymentStatus: { $in: ['pending', 'failed'] },
          status: { $in: ['pending', 'accepted'] },
        },
      },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
  ]);

  const totalFor = (status: PaymentStatus) =>
    byStatus.find((row) => row._id === status)?.total ?? 0;

  return {
    collected: totalFor('successful'),
    pending: totalFor('pending'),
    failed: totalFor('failed'),
    refunded: totalFor('refunded'),
    currency: 'ZAR',
    collectedThisMonth: thisMonth[0]?.total ?? 0,
    unpaidBookings: unpaid[0]?.count ?? 0,
    unpaidBookingValue: unpaid[0]?.total ?? 0,
  };
}

/** Describes what a payment was for, from whichever reference it carries. */
function describePurchase(payment: {
  booking?: unknown;
  package?: unknown;
  subscription?: unknown;
}): string {
  if (payment.booking) return 'Lesson';
  if (payment.package || payment.subscription) return 'Package';
  return 'Other';
}

export async function listPayments(filter: {
  status?: PaymentStatus;
  query?: string;
}): Promise<PaymentRow[]> {
  await connectDB();

  const where: Record<string, unknown> = {};

  if (filter.status) where.status = filter.status;

  if (filter.query) {
    // Reference only: it is the one field a customer quotes when they phone up.
    where.reference = new RegExp(
      filter.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i'
    );
  }

  const payments = await Payment.find(where)
    .populate<{ paidBy: { name: string } }>('paidBy', 'name')
    .populate<{ student: { user?: { name?: string } } }>({
      path: 'student',
      select: 'user',
      populate: { path: 'user', select: 'name' },
    })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  // Invoice numbers in one query rather than one per row.
  const invoices = await Invoice.find({
    payment: { $in: payments.map((payment) => payment._id) },
  })
    .select('payment invoiceNumber')
    .lean();

  const invoiceByPayment = new Map(
    invoices.map((invoice) => [invoice.payment?.toString(), invoice.invoiceNumber])
  );

  return payments.map((payment) => ({
    paymentId: payment._id.toString(),
    reference: payment.reference,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    provider: payment.provider,
    paidAt: payment.paidAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    payerName: payment.paidBy?.name ?? 'Unknown',
    studentName: payment.student?.user?.name ?? 'Unknown',
    purchase: describePurchase(payment),
    invoiceNumber: invoiceByPayment.get(payment._id.toString()) ?? null,
  }));
}

export type InvoiceRow = {
  invoiceId: string;
  invoiceNumber: string;
  studentName: string;
  billedToName: string;
  total: number;
  currency: string;
  issuedAt: string;
  paidAt: string | null;
  description: string;
};

/** Invoices, newest first (CLAUDE.md section 20). */
export async function listInvoices(): Promise<InvoiceRow[]> {
  await connectDB();

  const invoices = await Invoice.find()
    .populate<{ student: { user?: { name?: string } } }>({
      path: 'student',
      select: 'user',
      populate: { path: 'user', select: 'name' },
    })
    .populate<{ billedTo: { name: string } }>('billedTo', 'name')
    .sort({ issuedAt: -1 })
    .limit(100)
    .lean();

  return invoices.map((invoice) => ({
    invoiceId: invoice._id.toString(),
    invoiceNumber: invoice.invoiceNumber,
    studentName: invoice.student?.user?.name ?? 'Unknown',
    billedToName: invoice.billedTo?.name ?? 'Unknown',
    total: invoice.total,
    currency: invoice.currency,
    issuedAt: invoice.issuedAt.toISOString(),
    paidAt: invoice.paidAt?.toISOString() ?? null,
    description: invoice.items[0]?.description ?? 'Tutoring',
  }));
}

/**
 * How long a checkout is given before it counts as stranded.
 *
 * A customer on the Paystack page has a live, genuinely pending payment, and
 * asking the provider about it every few seconds would be both wasteful and
 * confusing. Three minutes is longer than a card form takes and far shorter
 * than a customer will wait for their lesson to be confirmed.
 */
const STRANDED_AFTER_MINUTES = 3;

/** References older than this are not worth chasing. */
const STRANDED_BEFORE_DAYS = 14;

/** Bounds the outbound calls, so one click cannot fire hundreds of requests. */
const RECONCILE_LIMIT = 50;

export type ReconcileSummary = {
  checked: number;
  settled: number;
  failed: number;
  stillPending: number;
};

/**
 * Asks the provider what happened to every payment still sitting at pending.
 *
 * The webhook is the normal path and the return page is the usual backstop,
 * but both can miss: a customer who pays and then closes the browser never
 * reaches the return page, and if the webhook URL is misconfigured - a real
 * hazard, since the route is /api/webhooks/paystack and it is easy to write
 * the segments the other way round - nothing else ever settles that charge.
 * The money has left the customer's account and the lesson stays unconfirmed.
 *
 * This is the manual sweep that recovers those. It decides nothing itself: it
 * calls the same server-to-server verification the return page uses, which
 * settles through the same code the webhook uses, so there is still exactly
 * one place a payment can become successful.
 */
export async function reconcilePendingPayments(): Promise<ReconcileSummary> {
  await connectDB();

  const now = Date.now();

  const stranded = await Payment.find({
    status: 'pending',
    createdAt: {
      $lte: new Date(now - STRANDED_AFTER_MINUTES * 60 * 1000),
      $gte: new Date(now - STRANDED_BEFORE_DAYS * 24 * 60 * 60 * 1000),
    },
  })
    .select('reference')
    .sort({ createdAt: 1 })
    .limit(RECONCILE_LIMIT)
    .lean();

  const summary: ReconcileSummary = {
    checked: stranded.length,
    settled: 0,
    failed: 0,
    stillPending: 0,
  };

  // Sequential rather than Promise.all: this talks to a third party, and a
  // burst of fifty parallel requests is how you get rate limited.
  for (const payment of stranded) {
    const outcome = await verifyAnyPayment(payment.reference);

    if (outcome === 'successful') summary.settled += 1;
    else if (outcome === 'failed') summary.failed += 1;
    else summary.stillPending += 1;
  }

  return summary;
}
