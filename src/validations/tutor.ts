import { z } from 'zod';

import { DELIVERY_MODES } from '@/models/types';
import { objectId } from '@/validations/lesson-booking';

/**
 * Tutor profile and admin tutor management.
 *
 * Deliberately split into two schemas. `isVerified` and `isActive` decide
 * whether a tutor can sign in and take bookings, so they appear only in the
 * admin schema - a tutor editing their own profile has no field that could
 * approve themselves (brief section 12).
 */

/** What a tutor may change about themselves. */
export const tutorProfileSchema = z.object({
  bio: z.string().trim().max(2000, 'Please keep your bio under 2000 characters').optional(),
  qualifications: z
    .array(z.string().trim().min(2).max(160))
    .max(10, 'Ten qualifications is the maximum')
    .default([]),
  hourlyRate: z
    .number()
    .min(1, 'Set your hourly rate')
    .max(10_000, 'That rate looks wrong'),
  subjectIds: z
    .array(objectId)
    .min(1, 'Choose at least one subject you teach')
    .max(20),
  gradeIds: z.array(objectId).max(20).default([]),
  teachingModes: z
    .array(z.enum(DELIVERY_MODES))
    .min(1, 'Choose at least one teaching format'),
  profileImage: z
    .string()
    .trim()
    .url('Enter a valid image URL')
    .max(500)
    .optional()
    .or(z.literal('')),
});

export type TutorProfileInput = z.infer<typeof tutorProfileSchema>;

/** Admin-only switches. */
export const tutorApprovalSchema = z.object({
  tutorId: objectId,
  /** Approving also lets the account sign in; see the service. */
  isVerified: z.boolean(),
  isActive: z.boolean(),
});

/** Admin editing a tutor's commercial details on their behalf. */
export const adminTutorSchema = z.object({
  tutorId: objectId,
  hourlyRate: z.number().min(0).max(10_000),
  subjectIds: z.array(objectId).max(20).default([]),
  teachingModes: z.array(z.enum(DELIVERY_MODES)).default([]),
});
