import { connectDB } from '@/lib/mongodb';
import { Booking, Package, Payment, Subscription } from '@/models';
import type { DeliveryMode } from '@/models/types';
import { lessonsRemaining } from '@/lib/payments/plans';

/**
 * Monthly plans: what a student has bought and what is left of it.
 *
 * A monthly plan is a Subscription against a `monthly` Package. The package
 * carries the price and the lesson count, so both stay database driven
 * (CLAUDE.md section 5); the subscription carries the drawdown, because that
 * is per student and changes every time a lesson is taken.
 *
 * Every write here is guarded by a conditional update rather than a read
 * followed by a save. Two lessons booked in the same second must not both see
 * "1 remaining" and both succeed, and a filter that includes the count is what
 * makes the second one lose (the same reasoning as the slot indexes in
 * booking rule 1).
 */

export class PlanError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'PlanError';
  }
}

/** A plan as every dashboard needs it: flat, and safe to send to a client. */
export type PlanView = {
  id: string;
  packageName: string;
  packageSlug: string;
  mode: DeliveryMode;
  status: 'active' | 'completed' | 'expired' | 'cancelled' | 'pending';
  sessionsTotal: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  /** "YYYY-MM-DD" */
  startsAt: string;
  expiresAt: string;
  amountPaid: number;
  currency: string;
  /** True while the plan can still cover a lesson today. */
  isUsable: boolean;
};

type PopulatedPlan = {
  _id: { toString(): string };
  package?: { name?: string; slug?: string } | null;
  mode: DeliveryMode;
  status: PlanView['status'];
  sessionsTotal: number;
  sessionsUsed: number;
  startsAt: Date;
  expiresAt: Date;
  payment?: { amount?: number; currency?: string } | null;
};

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function toView(plan: PopulatedPlan, now = new Date()): PlanView {
  const remaining = lessonsRemaining(plan.sessionsTotal, plan.sessionsUsed);

  return {
    id: plan._id.toString(),
    packageName: plan.package?.name ?? 'Monthly plan',
    packageSlug: plan.package?.slug ?? '',
    mode: plan.mode,
    status: plan.status,
    sessionsTotal: plan.sessionsTotal,
    sessionsUsed: plan.sessionsUsed,
    sessionsRemaining: remaining,
    startsAt: toIso(plan.startsAt),
    expiresAt: toIso(plan.expiresAt),
    amountPaid: plan.payment?.amount ?? 0,
    currency: plan.payment?.currency ?? 'ZAR',
    isUsable:
      plan.status === 'active' && remaining > 0 && plan.expiresAt.getTime() > now.getTime(),
  };
}

const PLAN_RELATIONS = [
  { path: 'package', select: 'name slug' },
  { path: 'payment', select: 'amount currency' },
];

/**
 * The plan a lesson in this mode would be drawn from, if any.
 *
 * Mode matters: an online month is cheaper than an in-person one, so an online
 * plan must not quietly pay for in-person teaching. A plan bought for
 * `in_person` covers online lessons too, because the student has already paid
 * the dearer rate and refusing would be charging them twice for less.
 */
export async function usablePlanFor(
  studentId: string,
  mode: DeliveryMode,
  now = new Date()
) {
  await connectDB();

  const covers: DeliveryMode[] = mode === 'online' ? ['online', 'in_person'] : ['in_person'];

  return Subscription.findOne({
    student: studentId,
    status: 'active',
    mode: { $in: covers },
    expiresAt: { $gt: now },
    $expr: { $lt: ['$sessionsUsed', '$sessionsTotal'] },
  })
    .sort({ expiresAt: 1 })
    .lean();
}

/**
 * Takes one lesson off a plan, atomically.
 *
 * The filter repeats every condition `usablePlanFor` checked, so the decision
 * and the write happen in one operation. A plan that ran out between the two
 * simply matches nothing and the caller falls back to charging for the lesson,
 * rather than pushing `sessionsUsed` past `sessionsTotal`.
 *
 * Returns the plan as it is AFTER the drawdown, or null when it could not be
 * used.
 */
export async function consumeLesson(params: {
  studentId: string;
  mode: DeliveryMode;
  now?: Date;
}) {
  await connectDB();

  const now = params.now ?? new Date();
  const covers: DeliveryMode[] =
    params.mode === 'online' ? ['online', 'in_person'] : ['in_person'];

  const plan = await Subscription.findOneAndUpdate(
    {
      student: params.studentId,
      status: 'active',
      mode: { $in: covers },
      expiresAt: { $gt: now },
      $expr: { $lt: ['$sessionsUsed', '$sessionsTotal'] },
    },
    { $inc: { sessionsUsed: 1 } },
    { new: true, sort: { expiresAt: 1 } }
  );

  if (!plan) return null;

  // The month is spent. Marked here rather than inferred on read, so the
  // student's screen and the owner's table agree without either recomputing.
  if (plan.sessionsUsed >= plan.sessionsTotal && plan.status === 'active') {
    plan.status = 'completed';
    await plan.save();
  }

  return plan;
}

/**
 * Hands a lesson's credit back, for a booking that was cancelled or rejected.
 *
 * Guarded so it can never push the count below zero, and it reopens a plan
 * that had been marked completed - a cancelled lesson genuinely does give the
 * month back, and leaving it `completed` would sell the student a renewal they
 * do not need. An expired window is left alone: the time has passed, and
 * restoring a lesson nobody can book is not a kindness.
 */
export async function refundLesson(subscriptionId: string, now = new Date()) {
  await connectDB();

  const plan = await Subscription.findOneAndUpdate(
    { _id: subscriptionId, sessionsUsed: { $gt: 0 } },
    { $inc: { sessionsUsed: -1 } },
    { new: true }
  );

  if (!plan) return null;

  if (
    plan.status === 'completed' &&
    plan.sessionsUsed < plan.sessionsTotal &&
    plan.expiresAt.getTime() > now.getTime()
  ) {
    plan.status = 'active';
    await plan.save();
  }

  return plan;
}

/**
 * Closes plans whose window has passed with lessons still on them.
 *
 * Read paths already treat an out-of-date plan as unusable, so this is
 * housekeeping rather than enforcement: it keeps the owner's list honest and
 * stops a long-gone plan appearing as the student's current one.
 */
export async function expireLapsedPlans(now = new Date()) {
  await connectDB();

  const result = await Subscription.updateMany(
    { status: 'active', expiresAt: { $lte: now } },
    { $set: { status: 'expired' } }
  );

  return { expired: result.modifiedCount };
}

/** Every plan a student has held, newest first. */
export async function listPlansForStudent(studentId: string): Promise<PlanView[]> {
  await connectDB();
  await expireLapsedPlans();

  const plans = await Subscription.find({ student: studentId })
    .populate(PLAN_RELATIONS)
    .sort({ createdAt: -1 })
    .limit(24)
    .lean();

  return (plans as unknown as PopulatedPlan[]).map((plan) => toView(plan));
}

/** The plan a student is on now, or null when they are paying per lesson. */
export async function currentPlanFor(studentId: string): Promise<PlanView | null> {
  await connectDB();
  await expireLapsedPlans();

  const plan = await Subscription.findOne({
    student: studentId,
    status: { $in: ['active', 'completed'] },
  })
    .populate(PLAN_RELATIONS)
    .sort({ status: 1, expiresAt: -1 })
    .lean();

  return plan ? toView(plan as unknown as PopulatedPlan) : null;
}

/**
 * The monthly packages on offer, one per mode.
 *
 * Read from the database so the price on the button is the price that will be
 * charged - the checkout reads the same document, so the two cannot disagree.
 *
 * `sessionsIncluded` must be set and positive. The catalogue still holds older
 * `monthly` packages from the original price list that never carried a lesson
 * count, and selling one would create a plan with nothing on it: paid for,
 * instantly unusable, and indistinguishable on screen from a plan the student
 * had already used up. A plan with no lessons is not a plan.
 */
export async function monthlyPackages() {
  await connectDB();

  const packages = await Package.find({
    category: 'monthly',
    isActive: true,
    sessionsIncluded: { $gt: 0 },
  })
    .sort({ mode: 1 })
    .lean();

  const now = Date.now();

  return packages
    .map((pkg) => {
      const price = [...(pkg.price ?? [])]
        .filter((entry) => new Date(entry.effectiveFrom).getTime() <= now)
        .sort(
          (a, b) =>
            new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
        )[0];

      return price
        ? {
            slug: pkg.slug,
            name: pkg.name,
            description: pkg.description ?? '',
            mode: pkg.mode,
            sessionsIncluded: pkg.sessionsIncluded ?? 0,
            sessionDurationMinutes: pkg.sessionDurationMinutes,
            validityDays: pkg.validityDays,
            amount: price.amount,
            currency: price.currency,
          }
        : null;
    })
    .filter((pkg): pkg is NonNullable<typeof pkg> => pkg !== null);
}

/**
 * How much of a student's monthly commitment is still owed.
 *
 * Used by the owner's outstanding column: a plan whose payment never settled
 * is money expected and not received, exactly like an unpaid lesson.
 */
export async function outstandingPlanValue(): Promise<{ count: number; total: number }> {
  await connectDB();

  const rows = await Payment.aggregate<{ count: number; total: number }>([
    { $match: { plan: 'monthly', status: { $in: ['pending', 'failed'] } } },
    { $group: { _id: null, count: { $sum: 1 }, total: { $sum: '$amount' } } },
  ]);

  return { count: rows[0]?.count ?? 0, total: rows[0]?.total ?? 0 };
}

/**
 * Whether this student may sit this lesson.
 *
 * The single answer to "has this been paid for", used by the attendance gate
 * and by anything that hands over a meeting link. A pay-per-lesson booking
 * needs its own settled payment; a plan booking needed a usable plan at the
 * time it was made, which is recorded on the booking itself rather than
 * re-derived here - a plan that has since been used up must not retroactively
 * bar a lesson it already paid for.
 */
export async function canAttend(bookingId: string): Promise<{
  allowed: boolean;
  reason: string;
}> {
  await connectDB();

  const booking = await Booking.findById(bookingId)
    .select('paymentStatus status subscription')
    .lean();

  if (!booking) return { allowed: false, reason: 'That lesson was not found' };

  if (booking.status === 'cancelled' || booking.status === 'rejected') {
    return { allowed: false, reason: `That lesson was ${booking.status}` };
  }

  if (booking.paymentStatus === 'covered') {
    return { allowed: true, reason: 'Covered by a monthly plan' };
  }

  if (booking.paymentStatus === 'paid') {
    return { allowed: true, reason: 'Paid' };
  }

  if (booking.paymentStatus === 'not_required') {
    return { allowed: true, reason: 'No payment required' };
  }

  return {
    allowed: false,
    reason: 'This lesson has not been paid for yet',
  };
}
