/**
 * What the platform actually teaches, from CLAUDE.md section 4.
 *
 * Lives in lib rather than in a component because registration, class
 * creation, the marketing pages and validation all need the same rules.
 * Section 4 is explicit: unsupported grade/subject combinations must not be
 * offered anywhere.
 */

export const SUBJECTS = {
  mathematics: {
    slug: 'mathematics',
    name: 'Mathematics',
    grades: [8, 9, 10, 11, 12],
    blurb: 'Algebra, functions, trigonometry, geometry and calculus, following CAPS.',
    /** CAPS strands, in roughly the order they are taught. */
    topics: [
      'Numbers, operations and relationships',
      'Patterns, functions and algebra',
      'Equations and inequalities',
      'Trigonometry',
      'Euclidean geometry',
      'Analytical geometry',
      'Differential calculus',
      'Financial mathematics',
      'Probability and statistics',
    ],
  },
  physicalScience: {
    slug: 'physical-science',
    name: 'Physical Science',
    grades: [10, 11, 12],
    blurb: 'Mechanics, waves, electricity, chemical change and matter.',
    topics: [
      'Mechanics: motion, forces and momentum',
      'Waves, sound and light',
      'Electrostatics and electric circuits',
      'Electromagnetism',
      'Matter and materials',
      'Chemical bonding and intermolecular forces',
      'Chemical change: stoichiometry and reactions',
      'Acids, bases and redox reactions',
      'Chemical systems and organic chemistry',
    ],
  },
} as const;

export type SubjectSlug = (typeof SUBJECTS)[keyof typeof SUBJECTS]['slug'];

export const GRADES = [8, 9, 10, 11, 12] as const;
export type Grade = (typeof GRADES)[number];

/** Subjects offered for one grade. Empty combinations simply do not appear. */
export function subjectsForGrade(grade: Grade) {
  return Object.values(SUBJECTS).filter((subject) =>
    (subject.grades as readonly number[]).includes(grade)
  );
}

/** Guard for anywhere a grade/subject pair arrives from outside. */
export function isSupported(grade: number, slug: string): boolean {
  const subject = Object.values(SUBJECTS).find((entry) => entry.slug === slug);
  return Boolean(subject && (subject.grades as readonly number[]).includes(grade));
}

/** Human-readable grade range, e.g. "Grades 10 to 12". */
export function gradeRange(grades: readonly number[]): string {
  const first = grades[0];
  const last = grades[grades.length - 1];
  return first === last ? `Grade ${first}` : `Grades ${first} to ${last}`;
}
