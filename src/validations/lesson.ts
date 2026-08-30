import { z } from 'zod';

import { objectId } from '@/validations/lesson-booking';
import { LESSON_PROGRESS } from '@/lib/lessons/constants';
import { ATTENDANCE_STATUS } from '@/models/types';

/**
 * The tutor's post-lesson write-up.
 *
 * One form covers both records: the teaching notes land on the Lesson, the
 * status lands on Attendance. Keeping them in a single schema means the two
 * can never be submitted half-and-half.
 */
export const recordLessonSchema = z.object({
  bookingId: objectId,

  /**
   * Required even when the write-up is a draft. A lesson with notes but no
   * attendance would silently skew the attendance percentage, which is the one
   * number parents check.
   */
  attendance: z.enum(ATTENDANCE_STATUS),

  notes: z.string().trim().max(5000, 'Notes are limited to 5000 characters').optional(),
  homework: z.string().trim().max(5000, 'Homework is limited to 5000 characters').optional(),
  progress: z.enum(LESSON_PROGRESS).optional(),

  /**
   * False saves a draft, true marks the write-up finished. Reports count only
   * completed lessons, so a tutor can save notes mid-thought without those
   * partial rows landing in a parent's report.
   */
  completed: z.boolean().default(false),
});

export type RecordLessonInput = z.infer<typeof recordLessonSchema>;
