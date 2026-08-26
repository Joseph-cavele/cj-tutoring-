/**
 * Assessment enums, free of any database driver.
 *
 * Same reason as the booking constants: the test builder and the test player
 * are client components, and importing a model would pull Mongoose into the
 * browser bundle (CLAUDE.md section 33).
 */

export const QUESTION_TYPES = [
  'multiple_choice',
  'true_false',
  /** A single exact value, marked by comparing numbers within a tolerance. */
  'numeric',
  'short_answer',
  'essay',
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/**
 * Question types a computer can mark from the stored answer alone.
 *
 * Kept as data rather than a condition in the marking code, because the brief
 * is explicit that these must be marked deterministically and never handed to
 * the AI.
 */
export const AUTO_MARKED_TYPES: QuestionType[] = [
  'multiple_choice',
  'true_false',
  'numeric',
];

export function isAutoMarked(type: QuestionType): boolean {
  return AUTO_MARKED_TYPES.includes(type);
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: 'Multiple choice',
  true_false: 'True or false',
  numeric: 'Numeric answer',
  short_answer: 'Short answer',
  essay: 'Written explanation',
};

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const TEST_STATUSES = ['draft', 'published', 'closed'] as const;
export type TestStatus = (typeof TEST_STATUSES)[number];

/** Who awarded the marks on one answer. Shown to tutors, kept for audit. */
export const MARK_SOURCES = ['auto', 'ai', 'tutor'] as const;
export type MarkSource = (typeof MARK_SOURCES)[number];

export const ATTEMPT_STATUSES = ['in_progress', 'submitted', 'marked'] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

/**
 * Percentage to symbol, on the South African NSC seven-point scale.
 *
 * Kept here so the student's dashboard, the tutor's marking screen and the
 * stored Result all describe the same mark the same way.
 */
export function gradeSymbol(percentage: number): string {
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B';
  if (percentage >= 60) return 'C';
  if (percentage >= 50) return 'D';
  if (percentage >= 40) return 'E';
  if (percentage >= 30) return 'F';
  return 'G';
}

/** Numeric answers are compared with a tolerance, not by string equality. */
export const NUMERIC_TOLERANCE = 0.01;
