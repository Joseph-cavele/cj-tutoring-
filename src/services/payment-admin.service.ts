import { connectDB } from '@/lib/mongodb';
import { Booking, Invoice, Payment, Subscription } from '@/models';
import type { PaymentStatus } from '@/models/types';
import {
  lessonsRemaining,
  type PaymentMethod,
  type PaymentPlan,
} from '@/lib/payments/plans';
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
  plan: PaymentPlan;
  method: PaymentMethod;
  /** Empty for cash and EFT, which no gateway processed. */
  provider: string;
  paidAt: string | null;
  createdAt: string;
  payerName: string;
  studentName: string;
  /** What the payment bought, in words. */
  purchase: string;
  invoiceNumber: string | null;
  /** Present only on a monthly payment: how much of the month is left. */
  lessonsUsed: number | null;
  lessonsTotal: number | null;
  lessonsRemaining: number | null;
  /** True when the tutor entered this by hand rather than a gateway. */
  isManual: boolean;
  note: string | null;
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
  cancelled: number;
  /** Lessons holding a slot that were never paid for. */
  unpaidBookings: number;
  unpaidBookingValue: number;
  /** Monthly plans started but never settled. */
  unpaidPlans: number;
  unpaidPlanValue: number;
  /** Everything owed, lessons and plans together. */
  outstandingTotal: number;
  /** Plans running right now, and lessons still on them. */
  activePlans: number;
  lessonsOnActivePlans: number;
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

  const [byStatus, thisMonth, unpaid, unpaidPlans, plans] = await Promise.all([
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
    // A month started and never settled is owed in exactly the same way.
    Payment.aggregate<{ count: number; total: number }>([
      { $match: { plan: 'monthly', status: { $in: ['pending', 'failed'] } } },
      { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
    // Lessons the business has already been paid for and still owes teaching
    // on - the liability side of a monthly plan, which the owner needs when
    // deciding how much of the diary is already spoken for.
    Subscription.aggregate<{ count: number; lessons: number }>([
      { $match: { status: 'active', expiresAt: { $gt: new Date() } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          lessons: { $sum: { $subtract: ['$sessionsTotal', '$sessionsUsed'] } },
        },
      },
    ]),
  ]);

  const totalFor = (status: PaymentStatus) =>
    byStatus.find((row) => row._id === status)?.total ?? 0;

  const unpaidBookingValue = unpaid[0]?.total ?? 0;
  const unpaidPlanValue = unpaidPlans[0]?.total ?? 0;

  return {
    collected: totalFor('successful'),
    pending: totalFor('pending'),
    failed: totalFor('failed'),
    cancelled: totalFor('cancelled'),
    refunded: totalFor('refunded'),
    currency: 'ZAR',
    collectedThisMonth: thisMonth[0]?.total ?? 0,
    unpaidBookings: unpaid[0]?.count ?? 0,
    unpaidBookingValue,
    unpaidPlans: unpaidPlans[0]?.count ?? 0,
    unpaidPlanValue,
    outstandingTotal: unpaidBookingValue + unpaidPlanValue,
    activePlans: plans[0]?.count ?? 0,
    lessonsOnActivePlans: plans[0]?.lessons ?? 0,
  };
}

/** Describes what a payment was for, from whichever reference it carries. */
function describePurchase(payment: {
  booking?: unknown;
  package?: unknown;
  subscription?: unknown;
  plan?: PaymentPlan;
}): string {
  if (payment.booking) return 'Lesson';
  if (payment.plan === 'monthly') return 'Monthly plan';
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
    // The drawdown for a monthly payment, so the table can show how much of
    // the month is left without a query per row.
    .populate<{ subscription: { sessionsTotal: number; sessionsUsed: number } }>(
      'subscription',
      'sessionsTotal sessionsUsed'
    )
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

  return payments.map((payment) => {
    const drawdown = payment.subscription as
      | { sessionsTotal?: number; sessionsUsed?: number }
      | undefined;

    const total = drawdown?.sessionsTotal ?? null;
    const used = drawdown?.sessionsUsed ?? null;

    return {
      paymentId: payment._id.toString(),
      reference: payment.reference,
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      plan: payment.plan ?? 'per_lesson',
      method: payment.method ?? 'paystack',
      provider: payment.provider ?? '',
      paidAt: payment.paidAt?.toISOString() ?? null,
      createdAt: payment.createdAt.toISOString(),
      payerName: payment.paidBy?.name ?? 'Unknown',
      studentName: payment.student?.user?.name ?? 'Unknown',
      purchase: describePurchase(payment),
      invoiceNumber: invoiceByPayment.get(payment._id.toString()) ?? null,
      lessonsTotal: total,
      lessonsUsed: used,
      lessonsRemaining:
        total !== null && used !== null ? lessonsRemaining(total, used) : null,
      isManual: payment.method === 'cash' || payment.method === 'eft',
      note: payment.note ?? null,
    };
  });
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

/**
 * Booked lessons that still need paying for, for the manual-payment form.
 *
 * `covered` is absent by construction - a lesson a monthly plan paid for is
 * not owed, and offering it here would let the tutor take money twice for the
 * same hour.
 */
export async function listUnpaidLessons(): Promise<
  {
    bookingId: string;
    label: string;
    amount: number;
    currency: string;
    isInPerson: boolean;
  }[]
> {
  await connectDB();

  const bookings = await Booking.find({
    paymentStatus: { $in: ['pending', 'failed'] },
    status: { $in: ['pending', 'accepted'] },
  })
    .populate<{ subject: { name: string } }>('subject', 'name')
    .populate<{ student: { user?: { name?: string } } }>({
      path: 'student',
      select: 'user',
      populate: { path: 'user', select: 'name' },
    })
    .sort({ date: 1, startTime: 1 })
    .limit(100)
    .lean();

  return bookings.map((booking) => ({
    bookingId: booking._id.toString(),
    label: `${booking.student?.user?.name ?? 'Student'} · ${
      booking.subject?.name ?? 'Tutoring'
    } · ${booking.date.toISOString().slice(0, 10)} ${booking.startTime}`,
    amount: booking.amount,
    currency: booking.currency,
    isInPerson: booking.teachingMode !== 'online',
  }));
}

/** Students the owner can record a plan payment against. */
export async function listStudentOptions(): Promise<{ id: string; name: string }[]> {
  await connectDB();

  const { Student } = await import('@/models');

  const students = await Student.find()
    .populate<{ user: { name?: string } }>('user', 'name')
    .limit(300)
    .lean();

  return students
    .map((student) => ({
      id: student._id.toString(),
      name: student.user?.name ?? 'Unnamed student',
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
