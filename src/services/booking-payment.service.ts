import crypto from 'node:crypto';

import { connectDB } from '@/lib/mongodb';
import { Booking, Invoice, Payment, User } from '@/models';
import type { SessionUser } from '@/lib/auth/guard';
import { bookingScopeFor } from '@/lib/booking/access';
import { getGateway } from '@/lib/payments';
import { formatBookingDate } from '@/types/booking';

export class BookingPaymentError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'BookingPaymentError';
  }
}

/** Readable, unique, and safe to show a customer. */
function makeReference(): string {
  return `CJL-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;
}

/**
 * Starts payment for a booking.
 *
 * The amount comes from the Booking document, which the booking service
 * calculated from the tutor's stored rate. Nothing about the price is taken
 * from the request, so a caller cannot decide what their lesson costs
 * (CLAUDE.md section 19).
 */
export async function startBookingCheckout(params: {
  user: SessionUser;
  bookingId: string;
  origin: string;
}) {
  await connectDB();

  // Scoped read: a caller can only pay for a booking they are party to.
  const scope = await bookingScopeFor(params.user);
  const booking = await Booking.findOne({ _id: params.bookingId, ...scope });

  if (!booking) throw new BookingPaymentError('That booking was not found', 404);

  if (booking.paymentStatus === 'paid') {
    throw new BookingPaymentError('That lesson is already paid for', 409);
  }

  if (booking.status === 'cancelled' || booking.status === 'rejected') {
    throw new BookingPaymentError(`That booking was ${booking.status}`, 409);
  }

  const gateway = getGateway();

  if (!gateway) {
    throw new BookingPaymentError('Online payment is not available right now', 503);
  }

  const payer = await User.findById(params.user.id).select('email').lean();

  if (!payer?.email) throw new BookingPaymentError('Your account has no email address', 409);

  const reference = makeReference();

  // Recorded as pending BEFORE the gateway is called, so a webhook that
  // arrives before the browser returns still has a row to settle against.
  await Payment.create({
    student: booking.student,
    paidBy: params.user.id,
    booking: booking._id,
    provider: gateway.name,
    reference,
    amount: booking.amount,
    currency: booking.currency,
    status: 'pending',
  });

  try {
    const session = await gateway.createCheckout({
      email: payer.email,
      amount: booking.amount,
      currency: booking.currency,
      reference,
      callbackUrl: `${params.origin}/checkout/complete?reference=${reference}`,
      metadata: { bookingId: booking._id.toString(), kind: 'booking' },
    });

    return { redirectUrl: session.redirectUrl, reference };
  } catch (error) {
    // The gateway never accepted it, so do not leave a pending row that will
    // never be settled and will confuse reconciliation.
    await Payment.deleteOne({ reference });
    throw error;
  }
}

/**
 * Marks a booking payment successful and releases it to the tutor.
 *
 * Called only after the provider has confirmed the charge - from the verified
 * webhook, or from an explicit server-to-server verify. Safe to call twice,
 * because providers retry.
 */
export async function settleBookingPayment(params: {
  reference: string;
  amount: number;
  raw?: unknown;
}) {
  await connectDB();

  const payment = await Payment.findOne({ reference: params.reference });

  if (!payment) {
    console.error('[booking payment] unknown reference', params.reference);
    return { handled: false };
  }

  // Idempotency: a retried webhook must not invoice twice.
  if (payment.status === 'successful') return { handled: true, duplicate: true };

  // The charge must match what we recorded. A mismatch means the reference was
  // reused or tampered with, so nothing is released.
  if (Math.abs(params.amount - payment.amount) > 0.01) {
    payment.status = 'failed';
    await payment.save();

    console.error('[booking payment] amount mismatch', {
      reference: params.reference,
      expected: payment.amount,
      received: params.amount,
    });

    return { handled: false };
  }

  payment.status = 'successful';
  payment.paidAt = new Date();
  payment.providerResponse = params.raw;
  await payment.save();

  if (!payment.booking) return { handled: true };

  const booking = await Booking.findById(payment.booking);

  if (!booking) return { handled: true };

  // This is the moment the tutor may act on the request (brief section 1).
  booking.paymentStatus = 'paid';
  booking.payment = payment._id;
  await booking.save();

  await issueInvoiceForBooking(payment._id.toString());

  return { handled: true, bookingId: booking._id.toString() };
}

/** Records a failed attempt without releasing anything. */
export async function failBookingPayment(reference: string, raw?: unknown) {
  await connectDB();

  const payment = await Payment.findOne({ reference });

  if (!payment || payment.status === 'successful') return;

  payment.status = 'failed';
  payment.providerResponse = raw;
  await payment.save();

  if (payment.booking) {
    await Booking.updateOne(
      { _id: payment.booking, paymentStatus: { $ne: 'paid' } },
      { $set: { paymentStatus: 'failed' } }
    );
  }
}

/**
 * Invoice for a paid lesson (CLAUDE.md section 20).
 *
 * Keyed on the payment reference so a retried webhook cannot produce a second
 * invoice for the same lesson.
 */
async function issueInvoiceForBooking(paymentId: string) {
  const payment = await Payment.findById(paymentId);

  if (!payment?.booking) return;

  const invoiceNumber = `INV-${payment.reference}`;
  const existing = await Invoice.findOne({ invoiceNumber }).select('_id');

  if (existing) return;

  const booking = await Booking.findById(payment.booking)
    .populate<{ subject: { name: string } }>('subject', 'name')
    .lean();

  if (!booking) return;

  const description = `${booking.subject?.name ?? 'Tutoring'} lesson, ${formatBookingDate(
    booking.date.toISOString().slice(0, 10)
  )} at ${booking.startTime}`;

  await Invoice.create({
    invoiceNumber,
    student: payment.student,
    billedTo: payment.paidBy,
    payment: payment._id,
    items: [
      {
        description,
        quantity: 1,
        unitPrice: payment.amount,
        total: payment.amount,
      },
    ],
    subtotal: payment.amount,
    discount: 0,
    total: payment.amount,
    currency: payment.currency,
    issuedAt: new Date(),
    paidAt: payment.paidAt,
  });
}

/** Status for the return page, scoped to the payer. */
export async function getBookingPaymentStatus(reference: string, userId: string) {
  await connectDB();

  return Payment.findOne({ reference, paidBy: userId })
    .select('reference status amount currency paidAt booking')
    .lean();
}
