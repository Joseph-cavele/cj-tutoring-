'use server';

import { revalidatePath } from 'next/cache';

import { getAuthorizedUser } from '@/lib/auth/guard';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { ApplicationError, decideApplication } from '@/services/application.service';
import { applicationDecisionSchema } from '@/validations/application';
import type { ActionResult } from '@/actions/booking.actions';

/**
 * The tutor's answer to an application.
 *
 * Rendering the buttons is not what grants the power: the role is re-checked
 * here on the server, and the acting id comes from the session rather than the
 * form, so a crafted request cannot approve anybody.
 */

function fromError(error: unknown): ActionResult<never> {
  if (error instanceof ApplicationError) return { ok: false, error: error.message };

  console.error('[application action] unexpected error', error);
  return { ok: false, error: 'Something went wrong. Please try again.' };
}

export async function decideApplicationAction(input: unknown): Promise<ActionResult> {
  const user = await getAuthorizedUser(STAFF_ROLES);

  if (!user) return { ok: false, error: 'Only the tutor or an admin can answer applications' };

  const parsed = applicationDecisionSchema.safeParse(input);

  if (!parsed.success) return { ok: false, error: 'That request is not valid' };

  try {
    await decideApplication({ ...parsed.data, actingUserId: user.id });

    revalidatePath('/tutor/applications');
    // The dashboard carries the waiting count, and an accepted account shows
    // up on the accounts screen as active.
    revalidatePath('/tutor/dashboard');
    revalidatePath('/admin/users');

    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}
