'use server';

import { revalidatePath } from 'next/cache';

import { getCapableUser } from '@/lib/auth/guard';
import { PARENT_INVITE_RULES, checkRateLimit } from '@/lib/rate-limit';
import {
  ParentInviteError,
  createParentInvite,
  redeemParentInvite,
  revokeParentInvite,
} from '@/services/parent-invite.service';
import {
  createParentInviteSchema,
  redeemParentInviteSchema,
  revokeParentInviteSchema,
} from '@/validations/parent-invite';
import type { ActionResult } from '@/actions/booking.actions';

/**
 * Parent invitation codes (brief section 2).
 *
 * Each action re-checks the session and the capability, because a server
 * action is a public endpoint that anything can call - not only the component
 * that renders the button.
 */

function fromError(error: unknown): ActionResult<never> {
  if (error instanceof ParentInviteError) {
    return { ok: false, error: error.message };
  }

  console.error('[parent invite action] unexpected error', error);
  return { ok: false, error: 'Something went wrong. Please try again.' };
}

/** The tutor issues a code for one student. The code is returned once. */
export async function createParentInviteAction(
  input: unknown
): Promise<ActionResult<{ code: string; expiresAt: string; studentName: string }>> {
  const user = await getCapableUser('children:invite');

  if (!user) return { ok: false, error: 'Please sign in again.' };

  const parsed = createParentInviteSchema.safeParse(input);

  if (!parsed.success) return { ok: false, error: 'Please choose a student.' };

  try {
    const invite = await createParentInvite({ user, studentId: parsed.data.studentId });

    revalidatePath('/tutor/accounts');

    return {
      ok: true,
      data: {
        code: invite.code,
        expiresAt: invite.expiresAt.toISOString(),
        studentName: invite.studentName,
      },
    };
  } catch (error) {
    return fromError(error);
  }
}

/** The tutor withdraws a code that has not been used. */
export async function revokeParentInviteAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('children:invite');

  if (!user) return { ok: false, error: 'Please sign in again.' };

  const parsed = revokeParentInviteSchema.safeParse(input);

  if (!parsed.success) return { ok: false, error: 'That invitation was not recognised.' };

  try {
    await revokeParentInvite({ user, inviteId: parsed.data.inviteId });

    revalidatePath('/tutor/accounts');

    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

/**
 * A parent redeems a code.
 *
 * Rate limited by user id - never by anything the client sends - so a script
 * cannot sit on this endpoint. The limit is applied BEFORE the code is looked
 * up, so a blocked caller learns nothing about whether their guess existed.
 */
export async function redeemParentInviteAction(
  input: unknown
): Promise<ActionResult<{ studentName: string; alreadyLinked: boolean }>> {
  const user = await getCapableUser('children:claim');

  if (!user) return { ok: false, error: 'Please sign in again.' };

  const limit = await checkRateLimit(`parent-invite:${user.id}`, PARENT_INVITE_RULES);

  if (!limit.allowed) {
    return {
      ok: false,
      error: `Too many attempts. Please try again in ${limit.retryAfterSeconds} seconds.`,
    };
  }

  const parsed = redeemParentInviteSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'Please enter the code your tutor gave you.',
    };
  }

  try {
    const result = await redeemParentInvite({ user, code: parsed.data.code });

    // The dashboard and the booking page both change the moment a child is
    // linked: one gains a card, the other gains a bookable student.
    revalidatePath('/parent/dashboard');
    revalidatePath('/booking');

    return {
      ok: true,
      data: { studentName: result.studentName, alreadyLinked: result.alreadyLinked },
    };
  } catch (error) {
    return fromError(error);
  }
}
