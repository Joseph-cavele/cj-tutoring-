/**
 * Booking enums, with no database driver attached.
 *
 * The model files import Mongoose, so anything a client component needs has to
 * live here instead - importing a constant from `@/models/Booking` in the
 * browser drags the whole MongoDB driver into the bundle and fails the build
 * (CLAUDE.md section 33). The models re-export these, so there is still one
 * definition.
 */

export const BOOKING_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
  'completed',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/**
 * Statuses that still occupy the tutor and the student.
 *
 * Cancelled and rejected are absent, which is what releases the time
 * (booking rule 10).
 */
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = ['pending', 'accepted', 'completed'];

/**
 * Whether the lesson has been paid for.
 *
 * A booking is created before the gateway is called so the slot is held while
 * the payer is on the checkout page. It only reaches the tutor once this says
 * `paid`, which is set by the verified webhook and never by the browser.
 */
export const BOOKING_PAYMENT_STATUSES = [
  'pending',
  'paid',
  'failed',
  'refunded',
  /** No gateway configured, so the lesson is not gated on payment at all.
   *  Distinct from `paid` so an unconfigured install never looks settled. */
  'not_required',
] as const;
export type BookingPaymentStatus = (typeof BOOKING_PAYMENT_STATUSES)[number];

/** Payment states that let a booking reach the tutor's decision queue. */
export const PAYMENT_SETTLED: BookingPaymentStatus[] = ['paid', 'not_required'];

/** 0 = Sunday, matching JavaScript getDay(). */
export const WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
] as const;

/** Builds one slot reservation key. Kept here so every caller agrees. */
export function slotKey(ownerId: string, isoDate: string, startTime: string): string {
  return `${ownerId}:${isoDate}:${startTime}`;
}
