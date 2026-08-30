'use server';

import { revalidatePath } from 'next/cache';

import { getCapableUser } from '@/lib/auth/guard';
import {
  TestError,
  closeTest,
  deleteTest,
  generateTestForTutor,
  publishTest,
  saveTestDraft,
} from '@/services/test.service';
import {
  AttemptError,
  autoSubmitIfExpired,
  saveAttemptProgress,
  startAttempt,
  submitAttempt,
} from '@/services/attempt.service';
import { MarkingError, adjustMark } from '@/services/marking.service';
import { AiUnavailableError } from '@/lib/ai/assessment';
import {
  adjustMarkSchema,
  generateTestSchema,
  saveTestSchema,
  submitAttemptSchema,
  testIdSchema,
} from '@/validations/test';
import { objectId } from '@/validations/lesson-booking';
import type { ActionResult } from '@/actions/booking.actions';

/**
 * Assessment actions.
 *
 * Each re-checks the session and the role. Nothing here accepts a mark, a
 * score or a status from the caller: those are computed by the services from
 * the stored answer key (brief section 14).
 */

function fromError(error: unknown): ActionResult<never> {
  if (
    error instanceof TestError ||
    error instanceof AttemptError ||
    error instanceof MarkingError ||
    error instanceof AiUnavailableError
  ) {
    return { ok: false, error: error.message };
  }

  console.error('[test action] unexpected error', error);
  return { ok: false, error: 'Something went wrong. Please try again.' };
}

/** Zod 4 types `path` as PropertyKey[], so the segments are stringified. */
function issuesOf(error: { issues: readonly { path: PropertyKey[]; message: string }[] }) {
  return error.issues.map((issue) => ({
    field: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

/* ----------------------------- Tutor ----------------------------- */

export async function generateTestAction(
  input: unknown
): Promise<ActionResult<{ testId: string; questionCount: number; totalMarks: number }>> {
  const user = await getCapableUser('tests:generate');

  if (!user) return { ok: false, error: 'Only a tutor can create tests' };

  const parsed = generateTestSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please check the test settings',
      issues: issuesOf(parsed.error),
    };
  }

  try {
    const result = await generateTestForTutor(user, parsed.data);
    revalidatePath('/tutor/tests');
    return { ok: true, data: result };
  } catch (error) {
    return fromError(error);
  }
}

export async function saveTestAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('tests:manage');

  if (!user) return { ok: false, error: 'Only a tutor can edit tests' };

  const parsed = saveTestSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please check the questions and try again',
      issues: issuesOf(parsed.error),
    };
  }

  try {
    await saveTestDraft(user, parsed.data);
    revalidatePath('/tutor/tests');
    revalidatePath(`/tutor/tests/${parsed.data.testId}`);
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

export async function publishTestAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('tests:manage');

  if (!user) return { ok: false, error: 'Only a tutor can publish tests' };

  const parsed = testIdSchema.safeParse(input);

  if (!parsed.success) return { ok: false, error: 'That request is not valid' };

  try {
    await publishTest(user, parsed.data.testId);
    revalidatePath('/tutor/tests');
    revalidatePath(`/tutor/tests/${parsed.data.testId}`);
    revalidatePath('/student/tests');
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

export async function closeTestAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('tests:manage');

  if (!user) return { ok: false, error: 'Only a tutor can close tests' };

  const parsed = testIdSchema.safeParse(input);

  if (!parsed.success) return { ok: false, error: 'That request is not valid' };

  try {
    await closeTest(user, parsed.data.testId);
    revalidatePath('/tutor/tests');
    revalidatePath('/student/tests');
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

export async function deleteTestAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('tests:manage');

  if (!user) return { ok: false, error: 'Only a tutor can delete tests' };

  const parsed = testIdSchema.safeParse(input);

  if (!parsed.success) return { ok: false, error: 'That request is not valid' };

  try {
    await deleteTest(user, parsed.data.testId);
    revalidatePath('/tutor/tests');
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

/** Tutor overrides an AI or automatic mark. Audited in the service. */
export async function adjustMarkAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('tests:mark');

  if (!user) return { ok: false, error: 'Only a tutor can change a mark' };

  const parsed = adjustMarkSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? 'That request is not valid',
    };
  }

  try {
    await adjustMark(user, parsed.data);
    revalidatePath('/tutor/tests');
    revalidatePath('/student/performance');
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

/* ---------------------------- Student ---------------------------- */

export async function startAttemptAction(
  input: unknown
): Promise<ActionResult<{ attemptId: string }>> {
  const user = await getCapableUser('tests:attempt');

  if (!user) return { ok: false, error: 'Only a student can take a test' };

  const parsed = objectId.safeParse(input);

  if (!parsed.success) return { ok: false, error: 'That test reference is not valid' };

  try {
    const result = await startAttempt(user, parsed.data);
    return { ok: true, data: { attemptId: result.attemptId } };
  } catch (error) {
    return fromError(error);
  }
}

/** Autosave. Deliberately quiet: a failed save must not interrupt the test. */
export async function saveProgressAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('tests:attempt');

  if (!user) return { ok: false, error: 'Please sign in' };

  const parsed = submitAttemptSchema.safeParse(input);

  if (!parsed.success) return { ok: false, error: 'That request is not valid' };

  try {
    await saveAttemptProgress(user, parsed.data);
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

export async function submitAttemptAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('tests:attempt');

  if (!user) return { ok: false, error: 'Please sign in' };

  const parsed = submitAttemptSchema.safeParse(input);

  if (!parsed.success) return { ok: false, error: 'That request is not valid' };

  try {
    await submitAttempt(user, parsed.data);
    revalidatePath('/student/tests');
    revalidatePath('/student/performance');
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}

/**
 * Called by the browser when its timer reaches zero.
 *
 * The server checks the stored deadline before acting, so this cannot end
 * someone's test early.
 */
export async function autoSubmitAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('tests:attempt');

  if (!user) return { ok: false, error: 'Please sign in' };

  const parsed = objectId.safeParse(input);

  if (!parsed.success) return { ok: false, error: 'That request is not valid' };

  try {
    await autoSubmitIfExpired(user, parsed.data);
    revalidatePath('/student/tests');
    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}
