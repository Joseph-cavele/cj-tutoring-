'use server';

import { revalidatePath } from 'next/cache';

import { getAuthorizedUser } from '@/lib/auth/guard';
import { LessonError, recordLesson } from '@/services/lesson.service';
import { recordLessonSchema } from '@/validations/lesson';
import type { ActionResult } from '@/actions/booking.actions';

/**
 * Recording the write-up for a taught lesson.
 *
 * No role list here: `recordLesson` refuses anyone who is not staff, and
 * keeping that decision in the service means the API route and this action
 * cannot drift apart on who is allowed to write.
 */
export async function recordLessonAction(
  input: unknown
): Promise<ActionResult<{ lessonId: string }>> {
  const user = await getAuthorizedUser();

  if (!user) return { ok: false, error: 'Please sign in again.' };

  const parsed = recordLessonSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please check the details and try again',
      issues: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }

  try {
    const result = await recordLesson({ user, input: parsed.data });

    // The queue and the student's history both change on every write-up.
    revalidatePath('/tutor/lessons');
    revalidatePath('/student/dashboard');

    return { ok: true, data: result };
  } catch (error) {
    if (error instanceof LessonError) return { ok: false, error: error.message };

    console.error('[lesson action] unexpected error', error);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }
}
