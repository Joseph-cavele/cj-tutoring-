'use server';

import { revalidatePath } from 'next/cache';

import { getCapableUser } from '@/lib/auth/guard';
import {
  TutorError,
  adminUpdateTutor,
  setTutorApproval,
  updateMyTutorProfile,
} from '@/services/tutor.service';
import {
  adminTutorSchema,
  tutorApprovalSchema,
  tutorProfileSchema,
} from '@/validations/tutor';
import type { ActionResult } from '@/actions/booking.actions';

/**
 * Tutor profile and approval actions.
 *
 * The split matters: `updateTutorProfileAction` is reachable by a tutor and
 * validates against a schema with no approval fields in it, while the two
 * approval actions require the admin role. A tutor calling the admin action
 * directly is rejected before any parsing happens.
 */

function fromError(error: unknown): ActionResult<never> {
  if (error instanceof TutorError) return { ok: false, error: error.message };

  console.error('[tutor action] unexpected error', error);
  return { ok: false, error: 'Something went wrong. Please try again.' };
}

/** Refreshes everywhere a tutor's details are read. */
function refresh() {
  revalidatePath('/tutor/profile');
  revalidatePath('/tutor/dashboard');
  revalidatePath('/tutor/team');
  // The booking wizard reads the tutor list and their rates.
  revalidatePath('/booking');
}

export async function updateTutorProfileAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('tutor-profile:manage');

  if (!user) return { ok: false, error: 'Only a tutor can edit a tutor profile' };

  const parsed = tutorProfileSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please check your profile and try again',
      issues: parsed.error.issues.map((issue) => ({
        field: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    };
  }

  try {
    await updateMyTutorProfile(user, parsed.data);
    refresh();
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

/** Approve or suspend. Admin only (brief section 12). */
export async function setTutorApprovalAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('tutor-records:manage');

  if (!user) return { ok: false, error: 'Only the tutor or an admin can approve tutors' };

  const parsed = tutorApprovalSchema.safeParse(input);

  if (!parsed.success) return { ok: false, error: 'That request is not valid' };

  try {
    await setTutorApproval(parsed.data);
    refresh();
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

/** Admin fills in a tutor's rate and subjects so they can be booked. */
export async function adminUpdateTutorAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('tutor-records:manage');

  if (!user) return { ok: false, error: 'Only the tutor or an admin can edit tutor details' };

  const parsed = adminTutorSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'That request is not valid',
    };
  }

  try {
    await adminUpdateTutor(parsed.data);
    refresh();
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}
