'use server';

import { revalidatePath } from 'next/cache';

import { getCapableUser } from '@/lib/auth/guard';
import {
  UserAdminError,
  changeUserRole,
  linkParentToStudent,
  setUserActive,
  unlinkParentFromStudent,
} from '@/services/user-admin.service';
import {
  changeRoleSchema,
  linkParentSchema,
  setUserActiveSchema,
} from '@/validations/user';
import type { ActionResult } from '@/actions/booking.actions';

/**
 * Admin user management actions.
 *
 * The acting user's id is taken from the session and passed to the service,
 * which uses it for the "not yourself" guards. It is never accepted from the
 * request, or those guards would be trivially bypassed.
 */

function fromError(error: unknown): ActionResult<never> {
  if (error instanceof UserAdminError) return { ok: false, error: error.message };

  console.error('[user action] unexpected error', error);
  return { ok: false, error: 'Something went wrong. Please try again.' };
}

function refresh() {
  revalidatePath('/tutor/accounts');
  // A parent's dashboard is built from the links changed here.
  revalidatePath('/parent/dashboard');
  revalidatePath('/booking');
}

export async function linkParentAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('accounts:link-children');

  if (!user) return { ok: false, error: 'Only the tutor or an admin can manage accounts' };

  const parsed = linkParentSchema.safeParse(input);

  if (!parsed.success) return { ok: false, error: 'That request is not valid' };

  try {
    await linkParentToStudent(parsed.data);
    refresh();
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

export async function unlinkParentAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('accounts:link-children');

  if (!user) return { ok: false, error: 'Only the tutor or an admin can manage accounts' };

  const parsed = linkParentSchema.safeParse(input);

  if (!parsed.success) return { ok: false, error: 'That request is not valid' };

  try {
    await unlinkParentFromStudent(parsed.data);
    refresh();
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

export async function setUserActiveAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('accounts:manage');

  if (!user) return { ok: false, error: 'Only the tutor or an admin can manage accounts' };

  const parsed = setUserActiveSchema.safeParse(input);

  if (!parsed.success) return { ok: false, error: 'That request is not valid' };

  try {
    await setUserActive({ ...parsed.data, actingUserId: user.id });
    refresh();
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

export async function changeUserRoleAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('accounts:manage');

  if (!user) return { ok: false, error: 'Only the tutor or an admin can manage accounts' };

  const parsed = changeRoleSchema.safeParse(input);

  if (!parsed.success) return { ok: false, error: 'That request is not valid' };

  try {
    await changeUserRole({ ...parsed.data, actingUserId: user.id });
    refresh();
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}
