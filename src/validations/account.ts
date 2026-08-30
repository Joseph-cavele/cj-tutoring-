import { z } from 'zod';

import { passwordField } from '@/validations/password';

/**
 * Changing your own email address or password.
 *
 * Both carry the current password. Sessions last an hour and dashboards get
 * opened on shared and family devices, so an unattended screen must not be
 * enough to take the account over - proving you know the current password is
 * what stops that.
 */

export const changeEmailSchema = z.object({
  email: z.email('Please enter a valid email address').max(200),
  currentPassword: z.string().min(1, 'Enter your current password'),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    password: passwordField,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'The passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.password !== data.currentPassword, {
    message: 'Choose a password you are not already using',
    path: ['password'],
  });

export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
