import { GRADES, SUBJECTS, gradeRange, isSupported, subjectsForGrade } from '../curriculum';

/**
 * CLAUDE.md section 4 is explicit: unsupported grade/subject combinations must
 * never be offered. Physical Science starts at Grade 10, and that boundary is
 * the thing most likely to be broken by a careless edit, so it is pinned here.
 */

describe('subjectsForGrade', () => {
  it('offers Mathematics only below Grade 10', () => {
    for (const grade of [8, 9] as const) {
      expect(subjectsForGrade(grade).map((s) => s.slug)).toEqual(['mathematics']);
    }
  });

  it('offers both subjects from Grade 10 up', () => {
    for (const grade of [10, 11, 12] as const) {
      expect(subjectsForGrade(grade).map((s) => s.slug).sort()).toEqual([
        'mathematics',
        'physical-science',
      ]);
    }
  });

  it('offers something in every grade the platform advertises', () => {
    for (const grade of GRADES) {
      expect(subjectsForGrade(grade).length).toBeGreaterThan(0);
    }
  });
});

describe('isSupported', () => {
  it('accepts Mathematics across the full range', () => {
    for (const grade of GRADES) {
      expect(isSupported(grade, 'mathematics')).toBe(true);
    }
  });

  it('rejects Physical Science below Grade 10', () => {
    expect(isSupported(8, 'physical-science')).toBe(false);
    expect(isSupported(9, 'physical-science')).toBe(false);
  });

  it('accepts Physical Science from Grade 10', () => {
    expect(isSupported(10, 'physical-science')).toBe(true);
    expect(isSupported(12, 'physical-science')).toBe(true);
  });

  it('rejects grades outside the platform, not just bad subjects', () => {
    expect(isSupported(7, 'mathematics')).toBe(false);
    expect(isSupported(13, 'mathematics')).toBe(false);
    expect(isSupported(0, 'mathematics')).toBe(false);
  });

  it('rejects an unknown subject slug', () => {
    expect(isSupported(11, 'astrophysics')).toBe(false);
    expect(isSupported(11, '')).toBe(false);
  });
});

describe('subject data', () => {
  it('gives every subject a slug, a name and at least one topic', () => {
    for (const subject of Object.values(SUBJECTS)) {
      expect(subject.slug).toMatch(/^[a-z-]+$/);
      expect(subject.name.length).toBeGreaterThan(0);
      expect(subject.topics.length).toBeGreaterThan(0);
    }
  });

  it('lists grades in ascending order, which gradeRange depends on', () => {
    for (const subject of Object.values(SUBJECTS)) {
      const grades = [...subject.grades];
      expect(grades).toEqual([...grades].sort((a, b) => a - b));
    }
  });
});

describe('gradeRange', () => {
  it('describes a span', () => {
    expect(gradeRange([8, 9, 10, 11, 12])).toBe('Grades 8 to 12');
    expect(gradeRange([10, 11, 12])).toBe('Grades 10 to 12');
  });

  it('describes a single grade without a range', () => {
    expect(gradeRange([12])).toBe('Grade 12');
  });
});
