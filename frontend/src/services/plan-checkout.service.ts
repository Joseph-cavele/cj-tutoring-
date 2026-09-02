import crypto from 'node:crypto';

import { connectDB } from '@/lib/mongodb';
import { Invoice, Package, Payment, Student, Subscription, User } from '@/models';
import type { SessionUser } from '@/lib/auth/guard';
import { getGateway } from '@/lib/payments';
import { notifyPaymentReceived } from '@/services/notification.service';

/**
 * Buying a month.
 *
 * Deliberately separate from `payment.service.ts`, which sells the older
 * generic packages: a monthly plan grants a drawdown a student books against,
 * so its fulfilment has to create a Subscription with the right mode and
 * lesson count, and reactivating a renewal is not the same as granting a first
 * plan. Sharing one function would have meant a flag threaded through both.
 *
 * The price is read from the Package document and never from the request
 * (CLAUDE.md section 19), and the plan only becomes active once the provider
 * has confirmed the charge server-side.
 */

export class PlanCheckoutError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'PlanCheckoutError';
  }
}

/** Readable, unique, and safe to show a customer. */
function makeReference(): string {
  return `CJM-${Date.now().toString(36).toUpperCase()}-${crypto
    .randomBytes(3)
    .toString('hex')
    .toUpperCase()}`;
}

/** The price in force today, from the package's own history. */
function currentPrice(price: { amount: number; currency: string; effectiveFrom: Date }[]) {
  const now = Date.now();

  return [...price]
    .filter((entry) => new Date(entry.effectiveFrom).getTime() <= now)
    .sort(
      (a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
    )[0];
}

/**
 * The student a plan is being bought for.
 *
 * A student buys for themselves; a parent must name a child already linked to
 * them. The requested id is only ever checked against what the payer is
 * entitled to, never used as a lookup key on its own (CLAUDE.md section 25).
 */
async function resolvePlanStudent(
  user: SessionUser,
  requestedStudentId?: string
): Promise<string> {
  await connectDB();

  if (user.role === 'student') {
    const student = await Student.findOne({ user: user.id }).select('_id').lean();

    if (!student) throw new PlanCheckoutError('Your student profile is not set up yet', 409);

    return student._id.toString();
  }

  if (user.role === 'parent') {
    const { Parent } = await import('@/models');
    const parent = await Parent.findOne({ user: user.id }).select('students').lean();

    if (!parent) throw new PlanCheckoutError('Your parent profile is not set up yet', 409);

    if (!requestedStudentId) {
      throw new PlanCheckoutError('Choose which child this plan is for', 400);
    }

    const isLinked = parent.students.some(
      (studentId) => studentId.toString() === requestedStudentId
    );

    // Not "not found": a parent must not be able to probe which ids exist.
    if (!isLinked) {
      throw new PlanCheckoutError('That student is not linked to your account', 403);
    }

    return requestedStudentId;
  }

  // Staff buying on a student's behalf, for a plan agreed over the phone.
  if (!requestedStudentId) {
    throw new PlanCheckoutError('Choose which student this plan is for', 400);
  }

  const student = await Student.findById(requestedStudentId).select('_id').lean();

  if (!student) throw new PlanCheckoutError('That student does not exist', 404);

  return student._id.toString();
}

/**
 * Starts payment for a monthly plan.
 *
 * A student already holding a usable plan is refused rather than sold a second
 * one: two live plans would make "lessons remaining" ambiguous, and the
 * drawdown would silently pick whichever expires first. A completed or expired
 * plan is no obstacle - that is exactly the renewal case.
 */
export async function startPlanCheckout(params: {
  user: SessionUser;
  packageSlug: string;
  studentId?: string;
  origin: string;
}) {
  await connectDB();

  const studentId = await resolvePlanStudent(params.user, params.studentId);

  const existing = await Subscription.findOne({
    student: studentId,
    status: 'active',
    expiresAt: { $gt: new Date() },
    $expr: { $lt: ['$sessionsUsed', '$sessionsTotal'] },
  })
    .select('_id')
    .lean();

  if (existing) {
    throw new PlanCheckoutError(
      'That student already has a monthly plan running. Use it up or let it expire before buying another.',
      409
    );
  }

  const pkg = await Package.findOne({
    slug: params.packageSlug,
    category: 'monthly',
    isActive: true,
  });

  if (!pkg) throw new PlanCheckoutError('That plan is not available', 404);

  // Guarded here as well as in the picker: a slug can be posted directly, and
  // a plan with no lessons on it is not something to take money for.
  if (!pkg.sessionsIncluded || pkg.sessionsIncluded <= 0) {
    throw new PlanCheckoutError('That plan has no lessons set on it', 409);
  }

  const price = currentPrice(pkg.price ?? []);

  if (!price) throw new PlanCheckoutError('That plan has no price set', 409);

  const gateway = getGateway();

  if (!gateway) {
    throw new PlanCheckoutError('Online payment is not available right now', 503);
  }

  const payer = await User.findById(params.user.id).select('email').lean();

  if (!payer?.email) throw new PlanCheckoutError('Your account has no email address', 409);

  const reference = makeReference();

  // Recorded as pending BEFORE the gateway is called, so a webhook that
  // arrives before the browser returns still has a row to settle against.
  await Payment.create({
    student: studentId,
    paidBy: params.user.id,
    package: pkg._id,
    plan: 'monthly',
    method: 'paystack',
    provider: gateway.name,
    reference,
    amount: price.amount,
    currency: price.currency,
    status: 'pending',
  });

  try {
    const session = await gateway.createCheckout({
      email: payer.email,
      amount: price.amount,
      currency: price.currency,
      reference,
      callbackUrl: `${params.origin}/checkout/complete?reference=${reference}`,
      metadata: { packageSlug: pkg.slug, studentId, kind: 'monthly_plan' },
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
 * Activates a month once the provider has confirmed the charge.
 *
 * Called only from the verified webhook or an explicit server-to-server
 * verify, and safe to call twice because providers retry.
 */
export async function activatePlan(params: {
  reference: string;
  amount: number;
  raw?: unknown;
}) {
  await connectDB();

  const payment = await Payment.findOne({ reference: params.reference });

  if (!payment) {
    console.error('[plan] unknown reference', params.reference);
    return { handled: false };
  }

  // Idempotency: a retried webhook must not grant a second month.
  if (payment.status === 'successful') return { handled: true, duplicate: true };

  // The charge must match what we recorded. A mismatch means the reference was
  // reused or tampered with, so nothing is granted.
  if (Math.abs(params.amount - payment.amount) > 0.01) {
    payment.status = 'failed';
    await payment.save();

    console.error('[plan] amount mismatch', {
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
    // Copied, not referenced: a later edit to the package must not change what
    // an already-sold month covers.
    mode: pkg.mode,
    sessionsTotal: pkg.sessionsIncluded ?? 0,
    sessionsUsed: 0,
    startsAt,
    expiresAt,
    payment: payment._id,
  });

  payment.subscription = subscription._id;
  await payment.save();

  await issuePlanInvoice(payment._id.toString(), pkg.name);
  await notifyPaymentReceived(payment._id.toString());

  return { handled: true, subscriptionId: subscription._id.toString() };
}

/** Records a failed attempt without granting a month. */
export async function failPlanPayment(reference: string, raw?: unknown) {
  await connectDB();

  const payment = await Payment.findOne({ reference });

  if (!payment || payment.status === 'successful') return;

  payment.status = 'failed';
  payment.providerResponse = raw;
  await payment.save();
}

/**
 * Invoice for a paid month (CLAUDE.md section 20).
 *
 * Keyed on the payment reference so a retried webhook cannot produce a second
 * invoice for the same plan.
 */
async function issuePlanInvoice(paymentId: string, packageName: string) {
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
      {
        description: `${packageName} - monthly plan`,
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
