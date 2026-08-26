import { z } from 'zod';

import { DELIVERY_MODES } from '@/models/types';

/**
 * Input shapes for the authenticated booking flow.
 *
 * Everything the browser sends is treated as a claim, not a fact: ids are
 * checked for shape here and for ownership in the service, and price, status
 * and availability are never accepted from the client at all
 * (brief section 13).
 */

/** A Mongo ObjectId as it arrives over the wire. */
export const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'That reference is not valid');

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a time');

export const createBookingSchema = z.object({
  /**
   * Omitted when a student books for themselves - the server uses their own
   * profile rather than trusting an id from the form.
   */
  studentId: objectId.optional(),
  subjectId: objectId,
  tutorId: objectId,
  date: isoDate,
  startTime: time,
  durationMinutes: z
    .number()
    .int()
    .min(15, 'Choose a lesson length')
    .max(240, 'Lessons cannot run longer than four hours'),
  teachingMode: z.enum(DELIVERY_MODES),
  notes: z.string().trim().max(1000, 'Please keep notes under 1000 characters').optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

/** Tutor accepting or rejecting a request from their dashboard. */
export const decideBookingSchema = z.object({
  bookingId: objectId,
  decision: z.enum(['accepted', 'rejected']),
  note: z.string().trim().max(500).optional(),
});

export type DecideBookingInput = z.infer<typeof decideBookingSchema>;

export const cancelBookingSchema = z.object({
  bookingId: objectId,
  reason: z.string().trim().max(500).optional(),
});

/** Admin override. Admins may set any status; everyone else may not. */
export const adminStatusSchema = z.object({
  bookingId: objectId,
  status: z.enum(['pending', 'accepted', 'rejected', 'cancelled', 'completed']),
  note: z.string().trim().max(500).optional(),
});

/** Query for the slot picker. */
export const slotQuerySchema = z.object({
  tutorId: objectId,
  date: isoDate,
  teachingMode: z.enum(DELIVERY_MODES).optional(),
});

/** One weekly availability window, as the tutor edits it. */
export const availabilityWindowSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: time,
    endTime: time,
    slotMinutes: z
      .number()
      .int()
      .min(15, 'Lessons must be at least 15 minutes')
      .max(240, 'Lessons cannot run longer than four hours'),
    teachingMode: z.enum(DELIVERY_MODES),
    isActive: z.boolean().default(true),
  })
  .refine((window) => window.startTime < window.endTime, {
    message: 'The end time must be after the start time',
    path: ['endTime'],
  });

export type AvailabilityWindowInput = z.infer<typeof availabilityWindowSchema>;

export const saveAvailabilitySchema = z.object({
  windows: z.array(availabilityWindowSchema).max(40, 'That is too many windows'),
});

/**
 * A parent adding a child to their own account.
 *
 * No password field: the child is emailed a one-time invite link and chooses
 * their own, so a parent never sets or knows their child's credentials, and
 * the account cannot be signed into until the invite is accepted.
 */
export const addChildSchema = z.object({
  name: z.string().trim().min(2, 'Enter your child\u2019s full name').max(80),
  email: z.email('Enter a valid email address').max(200),
  phone: z
    .string()
    .trim()
    .regex(/^0\d{9}$/, 'Enter a 10-digit number, for example 0710836571')
    .optional()
    .or(z.literal('')),
  gradeLevel: z
    .number()
    .int()
    .min(1, 'Choose a grade')
    .max(12, 'Choose a grade'),
});

export type AddChildInput = z.infer<typeof addChildSchema>;
