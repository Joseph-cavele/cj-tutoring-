import { connectDB } from '@/lib/mongodb';
import { Booking, Invoice, Payment } from '@/models';
import type { SessionUser } from '@/lib/auth/guard';
import { studentProfileFor } from '@/lib/booking/access';
import type { PaymentMethod, PaymentPlan } from '@/lib/payments/plans';
import type { PaymentStatus } from '@/models/types';
import { currentPlanFor, monthlyPackages, type PlanView } from '@/services/plan.service';

/**
 * The student's own money, as their dashboard needs it.
 *
 * Everything is scoped through `studentProfileFor`, so the query is built from
 * the session's user id and never from an id in the request
 * (CLAUDE.md section 25). A student with no profile reads nothing rather than
 * everything.
 */

export type StudentPaymentRow = {
  paymentId: string;
  reference: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  plan: PaymentPlan;
  method: PaymentMethod;
  paidAt: string | null;
  createdAt: string;
  description: string;
  invoiceNumber: string | null;
};

export type StudentPaymentsView = {
  /** The plan they are on now, or null when they pay per lesson. */
  plan: PlanView | null;
  /** What a month costs, per mode, for the switch/renew buttons. */
  offers: Awaited<ReturnType<typeof monthlyPackages>>;
  history: StudentPaymentRow[];
  /** Lessons booked and still waiting on payment. */
  awaitingPayment: {
    bookingId: string;
    subject: string;
    date: string;
    startTime: string;
    amount: number;
    currency: string;
  }[];
  totals: {
    paidAllTime: number;
    paidThisMonth: number;
    outstanding: number;
    currency: string;
  };
  /** ISO date the current plan runs out, when there is one. */
  nextRenewal: string | null;
};

export async function getStudentPayments(
  user: SessionUser
): Promise<StudentPaymentsView | null> {
  await connectDB();

  const student = await studentProfileFor(user.id);

  if (!student) return null;

  const studentId = student._id.toString();

  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);

  const [plan, offers, payments, unpaid, monthTotal] = await Promise.all([
    currentPlanFor(studentId),
    monthlyPackages(),
    Payment.find({ student: student._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    // Lessons holding a slot that still need paying for. `covered` is absent
    // on purpose: a plan already paid for those.
    Booking.find({
      student: student._id,
      paymentStatus: { $in: ['pending', 'failed'] },
      status: { $in: ['pending', 'accepted'] },
    })
      .populate<{ subject: { name: string } }>('subject', 'name')
      .sort({ date: 1, startTime: 1 })
      .limit(20)
      .lean(),
    Payment.aggregate<{ total: number }>([
      {
        $match: {
          student: student._id,
          status: 'successful',
          paidAt: { $gte: startOfMonth },
        },
      },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
  ]);

  const invoices = await Invoice.find({
    payment: { $in: payments.map((payment) => payment._id) },
  })
    .select('payment invoiceNumber')
    .lean();

  const invoiceByPayment = new Map(
    invoices.map((invoice) => [invoice.payment?.toString(), invoice.invoiceNumber])
  );

  const history: StudentPaymentRow[] = payments.map((payment) => ({
    paymentId: payment._id.toString(),
    reference: payment.reference,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    plan: payment.plan ?? 'per_lesson',
    method: payment.method ?? 'paystack',
    paidAt: payment.paidAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
    description:
      payment.plan === 'monthly'
        ? 'Monthly plan'
        : payment.booking
          ? 'Single lesson'
          : 'Tutoring',
    invoiceNumber: invoiceByPayment.get(payment._id.toString()) ?? null,
  }));

  const paidAllTime = payments
    .filter((payment) => payment.status === 'successful')
    .reduce((sum, payment) => sum + payment.amount, 0);

  return {
    plan,
    offers,
    history,
    awaitingPayment: unpaid.map((booking) => ({
      bookingId: booking._id.toString(),
      subject: booking.subject?.name ?? 'Tutoring',
      date: booking.date.toISOString().slice(0, 10),
      startTime: booking.startTime,
      amount: booking.amount,
      currency: booking.currency,
    })),
    totals: {
      paidAllTime,
      paidThisMonth: monthTotal[0]?.total ?? 0,
      outstanding: unpaid.reduce((sum, booking) => sum + booking.amount, 0),
      currency: 'ZAR',
    },
    nextRenewal: plan?.expiresAt ?? null,
  };
}
