import { z } from 'zod';

import { GRADES } from '@/lib/curriculum';

/**
 * Roles a visitor may create for themselves.
 *
 * Tutor is deliberately absent. The tutor role now carries owner powers -
 * every student's marks, every payment, every account - so a public signup
 * route into it would be a privilege escalation waiting for an approval
 * mistake. The owner account is made with `npm run make:owner` instead, which
 * needs shell and database access to run.
 */
export const SIGNUP_ROLES = ['student', 'parent'] as const;
export type SignupRole = (typeof SIGNUP_ROLES)[number];

export const loginSchema = z.object({
  email: z.email('Please enter a valid email address'),
  password: z.string().min(1, 'Please enter your password'),
});

export type LoginInput = z.infer<typeof loginSchema>;

const passwordField = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');

const baseFields = {
  name: z.string().trim().min(2, 'Please enter your full name').max(80),
  email: z.email('Please enter a valid email address').max(200),
  password: passwordField,
  phone: z
    .string()
    .trim()
    .regex(/^0\d{9}$/, 'Enter a 10-digit number, for example 0710836571')
    .optional()
    .or(z.literal('')),
  /** Honeypot; see validations/contact.ts for why it is not rejected here. */
  company: z.string().max(200).optional(),
};

/**
 * Registration differs per role, so the schema is a discriminated union rather
 * than one shape with everything optional. A student must pick a grade; a tutor
 * must not be able to grant themselves one.
 */
export const registerSchema = z.discriminatedUnion('role', [
  z.object({
    ...baseFields,
    role: z.literal('student'),
    // Plain number, not z.coerce: coerce widens the input type to unknown,
    // which breaks the discriminated union for react-hook-form. The form sends
    // a real number via valueAsNumber, and JSON carries it as a number too.
    grade: z
      .number()
      .refine((value) => (GRADES as readonly number[]).includes(value), 'Choose your grade'),
  }),
  z.object({
    ...baseFields,
    role: z.literal('parent'),
  }),
]);

export type RegisterInput = z.infer<typeof registerSchema>;
