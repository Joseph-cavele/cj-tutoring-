import { z } from 'zod';

import { objectId } from '@/validations/lesson-booking';

/** Admin subject management (brief section 5). */

export const subjectSchema = z.object({
  name: z.string().trim().min(2, 'Enter a subject name').max(80),
  description: z.string().trim().max(500).optional(),
  defaultDurationMinutes: z
    .number()
    .int()
    .min(15, 'Lessons must be at least 15 minutes')
    .max(240, 'Lessons cannot run longer than four hours'),
  isActive: z.boolean(),
});

export const createSubjectSchema = subjectSchema;

export const updateSubjectSchema = subjectSchema.extend({
  subjectId: objectId,
});

export const deleteSubjectSchema = z.object({ subjectId: objectId });

export type SubjectInput = z.infer<typeof subjectSchema>;

/**
 * URL-safe key derived from the name.
 *
 * Generated rather than typed: the slug is used in links and lookups, so
 * letting an admin set it by hand invites duplicates that differ only by
 * punctuation.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
