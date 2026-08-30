'use server';

import { revalidatePath } from 'next/cache';

import { getCapableUser } from '@/lib/auth/guard';
import {
  SubjectError,
  createSubject,
  deleteSubject,
  updateSubject,
} from '@/services/subject.service';
import {
  createSubjectSchema,
  deleteSubjectSchema,
  updateSubjectSchema,
} from '@/validations/subject';
import type { ActionResult } from '@/actions/booking.actions';

/**
 * Subject management, admin only (brief section 12).
 *
 * Each action re-checks the role: being able to reach the page is not what
 * authorizes the write.
 */

function fromError(error: unknown): ActionResult<never> {
  if (error instanceof SubjectError) return { ok: false, error: error.message };

  console.error('[subject action] unexpected error', error);
  return { ok: false, error: 'Something went wrong. Please try again.' };
}

function refresh() {
  revalidatePath('/tutor/subjects');
  // The booking wizard reads the same list.
  revalidatePath('/booking');
}

export async function createSubjectAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('subjects:manage');

  if (!user) return { ok: false, error: 'Only the tutor or an admin can manage subjects' };

  const parsed = createSubjectSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please check the subject details',
      issues: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }

  try {
    await createSubject(parsed.data);
    refresh();
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

export async function updateSubjectAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('subjects:manage');

  if (!user) return { ok: false, error: 'Only the tutor or an admin can manage subjects' };

  const parsed = updateSubjectSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please check the subject details',
      issues: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }

  const { subjectId, ...fields } = parsed.data;

  try {
    await updateSubject(subjectId, fields);
    refresh();
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

export async function deleteSubjectAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('subjects:manage');

  if (!user) return { ok: false, error: 'Only the tutor or an admin can manage subjects' };

  const parsed = deleteSubjectSchema.safeParse(input);

  if (!parsed.success) return { ok: false, error: 'That request is not valid' };

  try {
    await deleteSubject(parsed.data.subjectId);
    refresh();
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}
