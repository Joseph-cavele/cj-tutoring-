import { z } from 'zod';

/** Password set and reset (shares the strength rules used at registration). */

/** Exported so account settings can reuse the same rules. */
export const passwordField = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(128, 'Password is too long')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[0-9]/, 'Include a number');

export const forgotPasswordSchema = z.object({
  email: z.email('Please enter a valid email address').max(200),
  /** Honeypot; see validations/contact.ts. */
  company: z.string().max(200).optional(),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(10, 'That link is not valid').max(200),
    password: passwordField,
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'The passwords do not match',
    path: ['confirmPassword'],
  });

export const createPasswordSchema = z
  .object({
    token: z.string().min(10, 'That password setup link is not valid').max(200),
    password: passwordField,
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'The passwords do not match',
    path: ['confirmPassword'],
  });

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type CreatePasswordInput = z.infer<typeof createPasswordSchema>;
