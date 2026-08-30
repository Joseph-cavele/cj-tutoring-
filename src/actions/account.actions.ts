'use server';

import { revalidatePath } from 'next/cache';

import { getAuthorizedUser } from '@/lib/auth/guard';
import { AccountError, changeMyEmail, changeMyPassword } from '@/services/account.service';
import { changeEmailSchema, changePasswordSchema } from '@/validations/account';
import type { ActionResult } from '@/actions/booking.actions';

/**
 * Changing your own sign-in details.
 *
 * No role list: every signed-in user may edit their own account, and the
 * service only ever touches the id on the session, so there is nothing here
 * one user could aim at another.
 */

function fromError(error: unknown): ActionResult<never> {
  if (error instanceof AccountError) return { ok: false, error: error.message };

  console.error('[account action] unexpected error', error);
  return { ok: false, error: 'Something went wrong. Please try again.' };
}

/** Turns Zod issues into the shape the forms already render. */
function invalid(issues: { path: PropertyKey[]; message: string }[]): ActionResult<never> {
  return {
    ok: false,
    error: 'Please check the details and try again',
    issues: issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    })),
  };
}

export async function changeEmailAction(input: unknown): Promise<ActionResult> {
  const user = await getAuthorizedUser();

  if (!user) return { ok: false, error: 'Please sign in again' };

  const parsed = changeEmailSchema.safeParse(input);

  if (!parsed.success) return invalid(parsed.error.issues);

  try {
    await changeMyEmail(user, parsed.data);
    revalidatePath('/tutor/settings');
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const user = await getAuthorizedUser();

  if (!user) return { ok: false, error: 'Please sign in again' };

  const parsed = changePasswordSchema.safeParse(input);

  if (!parsed.success) return invalid(parsed.error.issues);

  try {
    await changeMyPassword(user, parsed.data);
    revalidatePath('/tutor/settings');
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}
