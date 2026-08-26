import { NUMERIC_TOLERANCE, type QuestionType } from '@/lib/assessment/constants';

/**
 * Deterministic marking.
 *
 * Objective questions are marked by comparing the student's response with the
 * stored answer key and nothing else - never by asking the AI
 * (brief section 7). Pure functions, so the same answer always earns the same
 * mark and the logic can be reasoned about without a database.
 */

export type ObjectiveMark = {
  isCorrect: boolean;
  marksAwarded: number;
};

/** Trims, lowercases and collapses whitespace, for forgiving text comparison. */
function normalise(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Reads a number from a student's answer.
 *
 * Tolerates the things students actually type - a comma decimal separator,
 * spaces as thousands separators, a trailing unit - because "12,5 m" is a
 * correct answer to a question that wanted 12.5 and should not be marked wrong
 * on formatting.
 */
export function parseNumeric(value: string): number | null {
  const cleaned = value
    .trim()
    .replace(/\s/g, '')
    .replace(/,/g, '.')
    // Keep digits, sign, decimal point and exponent; drop trailing units.
    .replace(/[^0-9.eE+-].*$/, '');

  if (!cleaned) return null;

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Marks one objective answer.
 *
 * All-or-nothing: an objective question is either right or it is not, so no
 * part marks are awarded here.
 */
export function markObjective(params: {
  type: QuestionType;
  correctAnswer: string;
  response: string;
  marks: number;
}): ObjectiveMark {
  const { type, correctAnswer, response, marks } = params;

  // An unanswered question earns nothing, whatever the type.
  if (!response.trim()) return { isCorrect: false, marksAwarded: 0 };

  if (type === 'numeric') {
    const expected = parseNumeric(correctAnswer);
    const given = parseNumeric(response);

    if (expected === null || given === null) {
      return { isCorrect: false, marksAwarded: 0 };
    }

    // Relative tolerance for large numbers, absolute for values near zero,
    // so 1 000 000 is not marked wrong for being out by 0.005.
    const allowed = Math.max(NUMERIC_TOLERANCE, Math.abs(expected) * NUMERIC_TOLERANCE);
    const isCorrect = Math.abs(expected - given) <= allowed;

    return { isCorrect, marksAwarded: isCorrect ? marks : 0 };
  }

  if (type === 'true_false') {
    const expected = normalise(correctAnswer);
    const given = normalise(response);

    // Accept the common spellings of the same two answers.
    const asBool = (value: string) =>
      ['true', 't', 'yes', '1'].includes(value)
        ? true
        : ['false', 'f', 'no', '0'].includes(value)
          ? false
          : null;

    const expectedBool = asBool(expected);
    const givenBool = asBool(given);

    if (expectedBool === null || givenBool === null) {
      return { isCorrect: false, marksAwarded: 0 };
    }

    const isCorrect = expectedBool === givenBool;
    return { isCorrect, marksAwarded: isCorrect ? marks : 0 };
  }

  // Multiple choice: the response is an option key.
  const isCorrect = normalise(correctAnswer) === normalise(response);

  return { isCorrect, marksAwarded: isCorrect ? marks : 0 };
}

/** Percentage, rounded to a whole number and clamped to 0-100. */
export function toPercentage(score: number, totalMarks: number): number {
  if (totalMarks <= 0) return 0;

  return Math.max(0, Math.min(100, Math.round((score / totalMarks) * 100)));
}
