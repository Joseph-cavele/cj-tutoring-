import crypto from 'node:crypto';

import { connectDB } from '@/lib/mongodb';
import { Invoice, Package, Payment, Student, Subscription, User } from '@/models';
import { initializeTransaction } from '@/lib/payments/paystack';
import { notifyPaymentReceived } from '@/services/notification.service';

export class PaymentError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

/** Readable, unique, and safe to show a customer. */
function makeReference(): string {
  return `CJ-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;
}

/**
 * Starts a checkout for a package.
 *
 * The amount is read from the Package document, never from the request: a
 * caller who posts their own price must not be able to change what they pay
 * (CLAUDE.md section 19).
 */
export async function startPackageCheckout(params: {
  userId: string;
  packageSlug: string;
  origin: string;
}) {
  await connectDB();

  const user = await User.findById(params.userId).select('email name role');

  if (!user) throw new PaymentError('Account not found', 401);

  const student = await Student.findOne({ user: user._id }).select('_id');

  // Only a student profile can hold a subscription; a parent paying for a child
  // needs the child selected first, which the parent flow does not do yet.
  if (!student) {
    throw new PaymentError('Only student accounts can buy a package right now', 403);
  }

  const pkg = await Package.findOne({ slug: params.packageSlug, isActive: true });

  if (!pkg) throw new PaymentError('That package is not available', 404);

  const price = [...(pkg.price ?? [])]
    .filter((entry) => new Date(entry.effectiveFrom).getTime() <= Date.now())
    .sort((a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime())[0];

  if (!price) throw new PaymentError('That package has no price set', 409);

  const reference = makeReference();

  // Recorded as pending first, so a webhook that arrives before the browser
  // returns still has a row to update.
  await Payment.create({
    student: student._id,
    paidBy: user._id,
    package: pkg._id,
    provider: 'paystack',
    reference,
    amount: price.amount,
    currency: price.currency,
    status: 'pending',
  });

  const { authorizationUrl } = await initializeTransaction({
    email: user.email,
    amountInRands: price.amount,
    reference,
    callbackUrl: `${params.origin}/checkout/complete`,
    metadata: { packageSlug: pkg.slug, studentId: student._id.toString() },
  });

  return { authorizationUrl, reference };
}

/**
 * Marks a payment successful and grants what was bought.
 *
 * Called only from the verified webhook, and safe to call twice: Paystack
 * retries, so a repeat delivery must not create a second subscription.
 */
export async function fulfilPayment(params: {
  reference: string;
  amountInRands: number;
  raw?: unknown;
}) {
  await connectDB();

  const payment = await Payment.findOne({ reference: params.reference });

  if (!payment) {
    console.error('[payment] webhook for unknown reference', params.reference);
    return { handled: false };
  }

  // Idempotency: already fulfilled, so there is nothing more to do.
  if (payment.status === 'successful') return { handled: true, duplicate: true };

  // The amount charged must match what we recorded. A mismatch means the
  // reference was reused or tampered with, so it is not fulfilled.
  if (Math.abs(params.amountInRands - payment.amount) > 0.01) {
    payment.status = 'failed';
    await payment.save();
    console.error('[payment] amount mismatch', {
      reference: params.reference,
      expected: payment.amount,
      received: params.amountInRands,
    });
    return { handled: false };
  }

  payment.status = 'successful';
  payment.paidAt = new Date();
  payment.providerResponse = params.raw;
  await payment.save();

  const pkg = payment.package ? await Package.findById(payment.package) : null;

  if (!pkg) {
    await notifyPaymentReceived(payment._id.toString());
    return { handled: true };
  }

  const startsAt = new Date();
  const expiresAt = new Date(startsAt.getTime() + pkg.validityDays * 24 * 60 * 60 * 1000);

  const subscription = await Subscription.create({
    student: payment.student,
    package: pkg._id,
    status: 'active',
    sessionsTotal: pkg.sessionsIncluded ?? 0,
    sessionsUsed: 0,
    startsAt,
    expiresAt,
    payment: payment._id,
  });

  payment.subscription = subscription._id;
  await payment.save();

  // Invoice on success, per CLAUDE.md section 20.
  await Invoice.create({
    invoiceNumber: `INV-${payment.reference}`,
    student: payment.student,
    billedTo: payment.paidBy,
    payment: payment._id,
    items: [
      {
        description: `${pkg.name} package`,
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

  // Payment confirmation (CLAUDE.md section 23). Best effort, and inside the
  // idempotent path, so a retried webhook does not send a second receipt.
  await notifyPaymentReceived(payment._id.toString());

  return { handled: true, subscriptionId: subscription._id.toString() };
}

/** Marks a failed attempt without granting anything. */
export async function failPayment(reference: string, raw?: unknown) {
  await connectDB();

  const payment = await Payment.findOne({ reference });
  if (!payment || payment.status === 'successful') return;

  payment.status = 'failed';
  payment.providerResponse = raw;
  await payment.save();
}

/** Read-only status for the return page. */
export async function getPaymentStatus(reference: string, userId: string) {
  await connectDB();

  // Scoped to the payer, so one customer cannot read another's reference
  // (CLAUDE.md section 25).
  const payment = await Payment.findOne({ reference, paidBy: userId })
    .select('reference status amount currency paidAt')
    .lean();

  return payment;
}
