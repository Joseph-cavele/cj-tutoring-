/**
 * Lesson enums, with no database driver attached.
 *
 * Same reason as `booking/constants.ts`: the post-lesson form is a client
 * component, and importing a constant from `@/models/Lesson` in the browser
 * drags the whole MongoDB driver into the bundle and fails the build
 * (CLAUDE.md section 33). The model re-exports these, so there is still one
 * definition.
 */

/**
 * How the student got on, recorded by the tutor after the lesson.
 *
 * Coarse on purpose. This is a one-tap field on a phone at the end of a
 * lesson, not an assessment - marks come from tests, and the nuance goes in
 * `notes`. Ordered best to worst so a report can sort on the index.
 */
export const LESSON_PROGRESS = ['excellent', 'good', 'satisfactory', 'needs_work'] as const;
export type LessonProgress = (typeof LESSON_PROGRESS)[number];

/** Human labels, for selects and reports. */
export const LESSON_PROGRESS_LABELS: Record<LessonProgress, string> = {
  excellent: 'Excellent',
  good: 'Good',
  satisfactory: 'Satisfactory',
  needs_work: 'Needs work',
};
