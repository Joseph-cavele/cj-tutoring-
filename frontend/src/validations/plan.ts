import { z } from 'zod';

import { MANUAL_PAYMENT_METHODS } from '@/lib/payments/plans';

/**
 * What the browser is allowed to say about a payment.
 *
 * No amount appears anywhere in this file, and that is the point: the price of
 * a lesson comes from the booking and the price of a month comes from the
 * package, both read server-side (CLAUDE.md section 19). A schema that
 * accepted an amount would be the first step towards trusting one.
 */

const objectId = z
  .string()
  .trim()
  .regex(/^[a-f\d]{24}$/i, 'That reference is not valid');

export const startPlanCheckoutSchema = z.object({
  packageSlug: z.string().trim().min(1, 'Choose a plan').max(80),
  /** Only meaningful for a parent or the tutor buying on someone's behalf. */
  studentId: objectId.optional(),
});

export type StartPlanCheckoutInput = z.infer<typeof startPlanCheckoutSchema>;

/**
 * Cash and EFT only.
 *
 * `paystack` is deliberately absent rather than rejected later: the tutor must
 * not be able to name the gateway on a payment the gateway never processed,
 * and keeping it out of the schema means no code path can be reached with it.
 */
const manualMethod = z.enum(
  MANUAL_PAYMENT_METHODS as [string, ...string[]],
  { message: 'Choose cash or EFT' }
);

export const recordLessonPaymentSchema = z.object({
  bookingId: objectId,
  method: manualMethod,
  note: z.string().trim().max(500).optional(),
});

export type RecordLessonPaymentInput = z.infer<typeof recordLessonPaymentSchema>;

export const recordPlanPaymentSchema = z.object({
  studentId: objectId,
  packageSlug: z.string().trim().min(1, 'Choose a plan').max(80),
  method: manualMethod,
  note: z.string().trim().max(500).optional(),
});

export type RecordPlanPaymentInput = z.infer<typeof recordPlanPaymentSchema>;

export const setPaymentStatusSchema = z.object({
  paymentId: objectId,
  // Only the two a human can legitimately assert. Nothing here can mark a
  // payment successful - that stays with the verified provider callback.
  status: z.enum(['refunded', 'cancelled'], { message: 'Choose an outcome' }),
  note: z.string().trim().max(500).optional(),
});

export type SetPaymentStatusInput = z.infer<typeof setPaymentStatusSchema>;
