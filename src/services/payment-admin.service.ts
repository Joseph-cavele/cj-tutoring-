import { connectDB } from '@/lib/mongodb';
import { Booking, Invoice, Payment } from '@/models';
import type { PaymentStatus } from '@/models/types';

/**
 * Money, as an administrator needs to see it (CLAUDE.md section 11).
 *
 * Read-only by design. Nothing here can mark a payment successful - that
 * happens only in the verified webhook or a server-to-server verify
 * (CLAUDE.md section 19), and an admin screen that could override it would
 * defeat the whole point of not trusting the client.
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
