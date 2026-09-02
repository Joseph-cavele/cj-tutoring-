/**
 * Payment plan and payment method vocabulary, with no database driver attached.
 *
 * Client components render plan pickers, method badges and lesson counters, so
 * these cannot live in a model file - importing `@/models/Payment` in the
 * browser drags the whole MongoDB driver into the bundle and fails the build
 * (CLAUDE.md section 33). The models re-export from here, so there is still one
 * definition of each list.
 *
 * Deliberately free of prices. What a lesson or a month costs is database
 * driven (CLAUDE.md section 5): per-lesson rates live on the tutor, monthly
 * rates live on a Package. A number written here would be a fourth place to
 * change a price and the one nobody remembers.
 */

/**
 * How a student is paying for tuition.
 *
 * - `per_lesson`: each lesson is bought on its own and must be settled before
 *   it is attended.
 * - `monthly`: one payment covers a fixed number of lessons in a window, and
 *   individual lessons are drawn down against it.
 */
export const PAYMENT_PLANS = ['per_lesson', 'monthly'] as const;
export type PaymentPlan = (typeof PAYMENT_PLANS)[number];

/**
 * How the money actually arrived.
 *
 * `paystack` is the only one the platform can confirm for itself - the other
 * two are recorded by the tutor after the fact, from a bank statement or a
 * handful of notes, and carry no gateway verification at all. Keeping them in
 * the same list as the gateway is what lets one payment history show
 * everything the business took, rather than only the online half.
 */
export const PAYMENT_METHODS = ['paystack', 'eft', 'cash'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Methods the tutor records by hand, because no gateway can confirm them. */
export const MANUAL_PAYMENT_METHODS: PaymentMethod[] = ['eft', 'cash'];

export function isManualMethod(method: PaymentMethod): boolean {
  return MANUAL_PAYMENT_METHODS.includes(method);
}

/** Cash is only offered where the tutor is physically present to take it. */
export function methodsForMode(mode: string): PaymentMethod[] {
  return mode === 'in_person'
    ? ['paystack', 'eft', 'cash']
    : ['paystack', 'eft'];
}

export const PLAN_LABELS: Record<PaymentPlan, string> = {
  per_lesson: 'Pay per lesson',
  monthly: 'Monthly plan',
};

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  paystack: 'Card / online',
  eft: 'EFT',
  cash: 'Cash',
};

/**
 * How many lessons a monthly plan has left, floored at zero.
 *
 * Shared so the student's counter, the tutor's table and the attendance gate
 * cannot drift apart - a plan that reads "1 of 4 remaining" on one screen and
 * refuses attendance on another is worse than either answer alone.
 */
export function lessonsRemaining(total: number, used: number): number {
  return Math.max(0, total - used);
}

/** "3 of 4 lessons remaining", or the completed state once they are used up. */
export function describeRemaining(total: number, used: number): string {
  const left = lessonsRemaining(total, used);

  if (left === 0) return 'Monthly plan completed';

  return `${left} of ${total} lesson${total === 1 ? '' : 's'} remaining`;
}
