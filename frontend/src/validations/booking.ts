import { z } from 'zod';

import { GRADES, SUBJECTS, isSupported } from '@/lib/curriculum';
import { DELIVERY_MODES } from '@/models/types';

const SUBJECT_SLUGS = Object.values(SUBJECTS).map((subject) => subject.slug);

export const bookingSchema = z
  .object({
    name: z.string().trim().min(2, 'Please enter your name').max(80),
    email: z.email('Please enter a valid email address').max(200),
    phone: z
      .string()
      .trim()
      .regex(/^0\d{9}$/, 'Enter a 10-digit number, for example 0710836571')
      .optional()
      .or(z.literal('')),
    subjectSlug: z.enum(SUBJECT_SLUGS as [string, ...string[]]),
    grade: z.number().refine((value) => (GRADES as readonly number[]).includes(value), {
      message: 'Choose a grade',
    }),
    mode: z.enum(DELIVERY_MODES),
    // Native date input gives YYYY-MM-DD.
    preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
    preferredTime: z.string().regex(/^\d{2}:\d{2}$/, 'Choose a time'),
    notes: z.string().trim().max(1000, 'Please keep this under 1000 characters').optional(),
    /** Honeypot; see validations/contact.ts. */
    company: z.string().max(200).optional(),
  })
  // Physical Science does not exist below Grade 10, so the pair is checked
  // together rather than each field on its own (CLAUDE.md section 4).
  .refine((data) => isSupported(data.grade, data.subjectSlug), {
    message: 'We do not offer that subject in that grade yet',
    path: ['subjectSlug'],
  })
  // A trial cannot be booked for a date that has already passed.
  .refine(
    (data) => {
      const chosen = new Date(`${data.preferredDate}T00:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return chosen >= today;
    },
    { message: 'Choose today or a future date', path: ['preferredDate'] }
  );

export type BookingInput = z.infer<typeof bookingSchema>;
