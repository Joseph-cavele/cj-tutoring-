import crypto from 'node:crypto';

import { connectDB } from '@/lib/mongodb';
import { Booking, Invoice, Package, Payment, Student, Subscription } from '@/models';
import type { SessionUser } from '@/lib/auth/guard';
import { isStaff } from '@/lib/auth/roles';
import { isManualMethod, type PaymentMethod } from '@/lib/payments/plans';
import { notifyPaymentReceived } from '@/services/notification.service';
import { formatBookingDate } from '@/types/booking';

/**
 * Cash and EFT, recorded by the tutor.
 *
 * This is the one path where a human, not a gateway, says money arrived - so
 * it is deliberately narrow. It is staff-only, it refuses to touch anything a
 * gateway is responsible for, and it can only record `cash` or `eft`: a
 * function that could mark a Paystack charge paid would reintroduce exactly
 * the trust in the client that the webhook design exists to avoid
 * (CLAUDE.md section 19).
 *
 * The amount is still not taken on trust from the form. It is read from the
 * booking or the package being settled, so a mistyped figure cannot quietly
 * become the price of a lesson.
 */

export class ManualPaymentError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ManualPaymentError';
  }
}

/** Marked so a manual payment is obvious in the reference itself. */
function makeReference(method: PaymentMethod): string {
  const tag = method === 'cash' ? 'CASH' : 'EFT';

  return `CJ${tag}-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(2)
    .toString('hex')
    .toUpperCase()}`;
}

function assertStaff(user: SessionUser) {
  if (!isStaff(user.role)) {
    throw new ManualPaymentError('Only the tutor can record a payment', 403);
  }
}

function assertManual(method: PaymentMethod) {
  if (!isManualMethod(method)) {
    throw new ManualPaymentError(
      'Only cash and EFT can be recorded by hand. A card payment is settled by the provider.',
      400
    );
  }
}

/**
 * Records cash or an EFT against a single lesson.
 *
 * Cash is refused for an online lesson: there is nobody in the room to hand it
 * to, and allowing it would make "paid in cash" the easiest way to mark an
 * unpaid online lesson settled.
 */
export async function recordLessonPayment(params: {
  user: SessionUser;
  bookingId: string;
  method: PaymentMethod;
  note?: string;
}) {
  assertStaff(params.user);
  assertManual(params.method);

  await connectDB();

  const booking = await Booking.findById(params.bookingId);

  if (!booking) throw new ManualPaymentError('That booking was not found', 404);

  if (booking.paymentStatus === 'paid') {
    throw new ManualPaymentError('That lesson is already paid for', 409);
  }

  if (booking.paymentStatus === 'covered') {
    throw new ManualPaymentError(
      'That lesson is already covered by a monthly plan',
      409
    );
  }

  if (booking.status === 'cancelled' || booking.status === 'rejected') {
    throw new ManualPaymentError(`That booking was ${booking.status}`, 409);
  }

  if (params.method === 'cash' && booking.teachingMode === 'online') {
    throw new ManualPaymentError('Cash can only be taken for an in-person lesson', 400);
  }

  const reference = makeReference(params.method);

  // The amount comes from the booking, never from the form.
  const payment = await Payment.create({
    student: booking.student,
    // A manually recorded payment is attributed to the student's own account:
    // there is no signed-in payer, and attributing it to the tutor would make
    // the tutor look like the customer on every cash lesson.
    paidBy: await payerFor(booking.student),
    booking: booking._id,
    plan: 'per_lesson',
    method: params.method,
    recordedBy: params.user.id,
    note: params.note,
    reference,
    amount: booking.amount,
    currency: booking.currency,
    status: 'successful',
    paidAt: new Date(),
  });

  booking.paymentStatus = 'paid';
  booking.payment = payment._id;
  await booking.save();

  await issueManualInvoice(payment._id.toString(), await describeBooking(booking._id.toString()));
  await notifyPaymentReceived(payment._id.toString());

  return {
    paymentId: payment._id.toString(),
    reference,
    amount: payment.amount,
    currency: payment.currency,
  };
}

/**
 * Records cash or an EFT for a monthly plan, and starts the month.
 *
 * Same shape as the online activation, and deliberately not shared with it:
 * that path must only ever be reachable from a verified provider callback, and
 * a manual entry calling into it would blur the one boundary worth keeping
 * sharp.
 */
export async function recordPlanPayment(params: {
  user: SessionUser;
  studentId: string;
  packageSlug: string;
  method: PaymentMethod;
  note?: string;
}) {
  assertStaff(params.user);
  assertManual(params.method);

  await connectDB();

  const student = await Student.findById(params.studentId).select('_id').lean();

  if (!student) throw new ManualPaymentError('That student does not exist', 404);

  const existing = await Subscription.findOne({
    student: student._id,
    status: 'active',
    expiresAt: { $gt: new Date() },
    $expr: { $lt: ['$sessionsUsed', '$sessionsTotal'] },
  })
    .select('_id')
    .lean();

  if (existing) {
    throw new ManualPaymentError(
      'That student already has a monthly plan running',
      409
    );
  }

  const pkg = await Package.findOne({
    slug: params.packageSlug,
    category: 'monthly',
    isActive: true,
  });

  if (!pkg) throw new ManualPaymentError('That plan is not available', 404);

  if (!pkg.sessionsIncluded || pkg.sessionsIncluded <= 0) {
    throw new ManualPaymentError('That plan has no lessons set on it', 409);
  }

  const now = Date.now();
  const price = [...(pkg.price ?? [])]
    .filter((entry) => new Date(entry.effectiveFrom).getTime() <= now)
    .sort(
      (a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
    )[0];

  if (!price) throw new ManualPaymentError('That plan has no price set', 409);

  if (params.method === 'cash' && pkg.mode === 'online') {
    throw new ManualPaymentError(
      'Cash can only be taken for an in-person plan',
      400
    );
  }

  const reference = makeReference(params.method);

  const payment = await Payment.create({
    student: student._id,
    paidBy: await payerFor(student._id),
    package: pkg._id,
    plan: 'monthly',
    method: params.method,
    recordedBy: params.user.id,
    note: params.note,
    reference,
    amount: price.amount,
    currency: price.currency,
    status: 'successful',
    paidAt: new Date(),
  });

  const startsAt = new Date();
  const expiresAt = new Date(startsAt.getTime() + pkg.validityDays * 24 * 60 * 60 * 1000);

  const subscription = await Subscription.create({
    student: student._id,
    package: pkg._id,
    status: 'active',
    mode: pkg.mode,
    sessionsTotal: pkg.sessionsIncluded ?? 0,
    sessionsUsed: 0,
    startsAt,
    expiresAt,
    payment: payment._id,
  });

  payment.subscription = subscription._id;
  await payment.save();

  await issueManualInvoice(payment._id.toString(), `${pkg.name} - monthly plan`);
  await notifyPaymentReceived(payment._id.toString());

  return {
    paymentId: payment._id.toString(),
    subscriptionId: subscription._id.toString(),
    reference,
    amount: payment.amount,
    currency: payment.currency,
  };
}

/**
 * Marks a payment refunded or cancelled.
 *
 * Deliberately does NOT move money: a refund is issued in the provider's
 * dashboard or the tutor's banking app, and this records that it happened.
 * Pretending otherwise would be worse than not offering it at all.
 */
export async function setPaymentStatus(params: {
  user: SessionUser;
  paymentId: string;
  status: 'refunded' | 'cancelled';
  note?: string;
}) {
  assertStaff(params.user);

  await connectDB();

  const payment = await Payment.findById(params.paymentId);

  if (!payment) throw new ManualPaymentError('That payment was not found', 404);

  if (params.status === 'refunded' && payment.status !== 'successful') {
    throw new ManualPaymentError('Only a successful payment can be refunded', 409);
  }

  if (params.status === 'cancelled' && payment.status === 'successful') {
    throw new ManualPaymentError(
      'A successful payment cannot be cancelled. Record a refund instead.',
      409
    );
  }

  payment.status = params.status;
  if (params.note) payment.note = params.note;
  await payment.save();

  // A refunded lesson is no longer paid for, so it must stop letting the
  // student attend. The booking follows the money, not the other way round.
  if (payment.booking && params.status === 'refunded') {
    await Booking.updateOne(
      { _id: payment.booking },
      { $set: { paymentStatus: 'refunded' } }
    );
  }

  // A refunded month ends there, with whatever lessons were left on it.
  if (payment.subscription && params.status === 'refunded') {
    await Subscription.updateOne(
      { _id: payment.subscription },
      { $set: { status: 'cancelled' } }
    );
  }

  return { paymentId: payment._id.toString(), status: payment.status };
}

/** The User a student's payments are billed to - the student's own account. */
async function payerFor(studentId: unknown) {
  const student = await Student.findById(studentId).select('user').lean();

  if (!student?.user) {
    throw new ManualPaymentError('That student has no account to bill', 409);
  }

  return student.user;
}

async function describeBooking(bookingId: string): Promise<string> {
  const booking = await Booking.findById(bookingId)
    .populate<{ subject: { name: string } }>('subject', 'name')
    .lean();

  if (!booking) return 'Tutoring lesson';

  return `${booking.subject?.name ?? 'Tutoring'} lesson, ${formatBookingDate(
    booking.date.toISOString().slice(0, 10)
  )} at ${booking.startTime}`;
}

/** Invoice for money taken by hand, on the same terms as an online one. */
async function issueManualInvoice(paymentId: string, description: string) {
  const payment = await Payment.findById(paymentId);

  if (!payment) return;

  const invoiceNumber = `INV-${payment.reference}`;
  const existing = await Invoice.findOne({ invoiceNumber }).select('_id');

  if (existing) return;

  await Invoice.create({
    invoiceNumber,
    student: payment.student,
    billedTo: payment.paidBy,
    payment: payment._id,
    items: [
      { description, quantity: 1, unitPrice: payment.amount, total: payment.amount },
    ],
    subtotal: payment.amount,
    discount: 0,
    total: payment.amount,
    currency: payment.currency,
    issuedAt: new Date(),
    paidAt: payment.paidAt,
  });
}
