import { connectDB } from '@/lib/mongodb';
import { Parent, Student, Test } from '@/models';
import { isStaff } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/guard';
import { formatSitting, sittingIsoDate, sittingTime } from '@/lib/assessment/schedule';

/**
 * The test timetable (brief section 23).
 *
 * One reader, three audiences, and the difference between them is entirely a
 * database filter rather than anything the caller passes:
 *
 *   tutor    every scheduled test
 *   student  published tests for their own grade
 *   parent   published tests for the grades their linked children are in
 *
 * A student's grade and a parent's children are both read from their own
 * profile, so no grade or student id is ever accepted from the client
 * (CLAUDE.md section 25).
 *
 * Only tests with an opening time appear. A test with no window is not
 * scheduled - it is practice a student can take whenever - and putting it on a
 * timetable under today's date would be a lie.
 */

export type TimetableEntry = {
  testId: string;
  title: string;
  subjectName: string;
  gradeName: string;
  topic: string | null;
  /** "YYYY-MM-DD" in South Africa. */
  isoDate: string;
  /** "02 September" */
  dateLabel: string;
  /** "15:00" */
  timeLabel: string;
  closesTimeLabel: string | null;
  durationMinutes: number;
  totalMarks: number;
  isPast: boolean;
  /** Drafts are only ever visible to the tutor. */
  isDraft: boolean;
};

/** Days, each with the tests sitting on them, oldest first. */
export type TimetableDay = {
  isoDate: string;
  dateLabel: string;
  entries: TimetableEntry[];
};

async function gradeScopeFor(user: SessionUser): Promise<Record<string, unknown> | null> {
  // The owner sees everything that has been scheduled, drafts included, since
  // a draft sitting is still something they need to plan around.
  if (isStaff(user.role)) return {};

  if (user.role === 'student') {
    const student = await Student.findOne({ user: user.id }).select('grade').lean();

    // No profile means no grade, and an unfiltered query would show the whole
    // school. Return null so the caller answers with nothing.
    if (!student?.grade) return null;

    return { grade: student.grade, status: 'published' };
  }

  const parent = await Parent.findOne({ user: user.id }).select('students').lean();

  if (!parent || parent.students.length === 0) return null;

  const children = await Student.find({ _id: { $in: parent.students } })
    .select('grade')
    .lean();

  const grades = children.map((child) => child.grade).filter(Boolean);

  if (grades.length === 0) return null;

  return { grade: { $in: grades }, status: 'published' };
}

export async function getTimetable(params: {
  user: SessionUser;
  /** Include sittings that have already happened. */
  includePast?: boolean;
  now?: Date;
}): Promise<TimetableDay[]> {
  await connectDB();

  const scope = await gradeScopeFor(params.user);

  if (!scope) return [];

  const now = params.now ?? new Date();

  const filter: Record<string, unknown> = {
    ...scope,
    availableFrom: { $ne: null, $exists: true },
  };

  if (!params.includePast) {
    // A sitting is worth showing until it closes, or for the rest of its own
    // day when it has no closing time - a test at 15:00 should not vanish
    // from a student's timetable at 15:01 while they are sitting it.
    const startOfToday = new Date(now);
    startOfToday.setUTCHours(0, 0, 0, 0);

    filter.availableFrom = { $ne: null, $exists: true, $gte: startOfToday };
  }

  const tests = await Test.find(filter)
    .populate<{ subject: { name: string } }>('subject', 'name')
    .populate<{ grade: { name: string } }>('grade', 'name')
    .select('title subject grade topic availableFrom availableUntil durationMinutes totalMarks status')
    .sort({ availableFrom: 1 })
    .limit(200)
    .lean();

  const byDate = new Map<string, TimetableDay>();

  for (const test of tests) {
    if (!test.availableFrom) continue;

    const sitting = formatSitting(test.availableFrom);
    const isoDate = sittingIsoDate(test.availableFrom);

    const entry: TimetableEntry = {
      testId: test._id.toString(),
      title: test.title,
      subjectName: test.subject?.name ?? 'Subject',
      gradeName: test.grade?.name ?? 'Grade',
      topic: test.topic ?? null,
      isoDate,
      dateLabel: sitting.dateLabel,
      timeLabel: sitting.timeLabel,
      closesTimeLabel: test.availableUntil ? sittingTime(test.availableUntil) : null,
      durationMinutes: test.durationMinutes,
      totalMarks: test.totalMarks,
      isPast: test.availableFrom.getTime() < now.getTime(),
      isDraft: test.status === 'draft',
    };

    const day = byDate.get(isoDate) ?? {
      isoDate,
      dateLabel: sitting.dateLabel,
      entries: [],
    };

    day.entries.push(entry);
    byDate.set(isoDate, day);
  }

  return [...byDate.values()];
}

/** The next few sittings, for a dashboard panel rather than a full page. */
export async function getUpcomingTests(params: {
  user: SessionUser;
  limit?: number;
  now?: Date;
}): Promise<TimetableEntry[]> {
  const days = await getTimetable({ user: params.user, now: params.now });

  return days.flatMap((day) => day.entries).slice(0, params.limit ?? 3);
}

/**
 * Scheduled sittings inside a date range, keyed by day.
 *
 * Used by the calendar, which needs the tests for one month grid and nothing
 * else. Returns a Map so the calendar can look each day up directly.
 */
export async function getSittingsByDate(params: {
  user: SessionUser;
  fromIsoDate: string;
  toIsoDate: string;
}): Promise<Map<string, TimetableEntry[]>> {
  const days = await getTimetable({ user: params.user, includePast: true });

  const byDate = new Map<string, TimetableEntry[]>();

  for (const day of days) {
    if (day.isoDate >= params.fromIsoDate && day.isoDate <= params.toIsoDate) {
      byDate.set(day.isoDate, day.entries);
    }
  }

  return byDate;
}
