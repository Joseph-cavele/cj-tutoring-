import { connectDB } from '@/lib/mongodb';
import { Result, Student, Test } from '@/models';
import type { SessionUser } from '@/lib/auth/guard';
import { parentProfileFor, studentProfileFor } from '@/lib/booking/access';
import { gradeSymbol } from '@/lib/assessment/constants';
import { isStaff } from '@/lib/auth/roles';

/**
 * Performance reporting (brief section 10).
 *
 * Everything is computed from published Results, so a student sees exactly the
 * marks they have been given and nothing that is still being marked.
 */

export type SubjectPerformance = {
  subjectName: string;
  averagePercentage: number;
  testCount: number;
};

export type TopicPerformance = {
  topic: string;
  averagePercentage: number;
  testCount: number;
};

export type RecentResult = {
  resultId: string;
  attemptId: string | null;
  testTitle: string;
  subjectName: string;
  topic: string;
  score: number;
  maxScore: number;
  percentage: number;
  grade: string;
  feedback: string;
  completedAt: string;
};

export type StudentPerformance = {
  studentId: string;
  studentName: string;
  averagePercentage: number | null;
  testsCompleted: number;
  highestPercentage: number | null;
  lowestPercentage: number | null;
  bySubject: SubjectPerformance[];
  byTopic: TopicPerformance[];
  recent: RecentResult[];
  weakAreas: string[];
};

/** Mean of a list of percentages, rounded. Null when there is nothing to average. */
function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

/**
 * The full picture for one student.
 *
 * Takes a resolved studentId, never a raw one from a request - callers get
 * that id from an authorization helper first.
 */
async function buildPerformance(studentId: string): Promise<StudentPerformance> {
  await connectDB();

  const student = await Student.findById(studentId)
    .populate<{ user: { name: string } }>('user', 'name')
    .select('user')
    .lean();

  const results = await Result.find({ student: studentId, publishedAt: { $ne: null } })
    .populate<{ subject: { name: string } }>('subject', 'name')
    .sort({ publishedAt: -1 })
    .limit(200)
    .lean();

  // Topic lives on the Test, so the titles are fetched in one go rather than
  // per result.
  // A type predicate, because filter(Boolean) does not narrow the element type.
  const testIds = results
    .map((result) => result.test)
    .filter((test): test is NonNullable<typeof test> => Boolean(test));

  const tests = await Test.find({ _id: { $in: testIds } })
    .select('title topic')
    .lean();

  const testById = new Map(tests.map((test) => [test._id.toString(), test]));

  const percentages = results.map((result) => result.percentage);

  const subjectBuckets = new Map<string, number[]>();
  const topicBuckets = new Map<string, number[]>();

  for (const result of results) {
    const subjectName = result.subject?.name ?? 'Other';
    subjectBuckets.set(subjectName, [
      ...(subjectBuckets.get(subjectName) ?? []),
      result.percentage,
    ]);

    const topic = result.test ? testById.get(result.test.toString())?.topic : undefined;

    if (topic) {
      topicBuckets.set(topic, [...(topicBuckets.get(topic) ?? []), result.percentage]);
    }
  }

  // Weak areas recorded at marking time, most recent first, de-duplicated.
  const weakAreas = [
    ...new Set(results.flatMap((result) => result.weakAreas ?? [])),
  ].slice(0, 6);

  return {
    studentId,
    studentName: student?.user?.name ?? 'Student',
    averagePercentage: average(percentages),
    testsCompleted: results.length,
    highestPercentage: percentages.length ? Math.max(...percentages) : null,
    lowestPercentage: percentages.length ? Math.min(...percentages) : null,
    bySubject: [...subjectBuckets.entries()]
      .map(([subjectName, values]) => ({
        subjectName,
        averagePercentage: average(values) ?? 0,
        testCount: values.length,
      }))
      .sort((a, b) => b.averagePercentage - a.averagePercentage),
    byTopic: [...topicBuckets.entries()]
      .map(([topic, values]) => ({
        topic,
        averagePercentage: average(values) ?? 0,
        testCount: values.length,
      }))
      .sort((a, b) => a.averagePercentage - b.averagePercentage),
    recent: results.slice(0, 10).map((result) => ({
      resultId: result._id.toString(),
      attemptId: result.attempt?.toString() ?? null,
      testTitle: result.test
        ? (testById.get(result.test.toString())?.title ?? 'Test')
        : 'Assessment',
      subjectName: result.subject?.name ?? 'Subject',
      topic: result.test ? (testById.get(result.test.toString())?.topic ?? '') : '',
      score: result.score,
      maxScore: result.maxScore,
      percentage: result.percentage,
      grade: result.grade ?? gradeSymbol(result.percentage),
      feedback: result.remarks ?? '',
      completedAt: (result.publishedAt ?? result.createdAt).toISOString(),
    })),
    weakAreas,
  };
}

/** The signed-in student's own performance. */
export async function getMyPerformance(user: SessionUser): Promise<StudentPerformance | null> {
  const student = await studentProfileFor(user.id);

  if (!student) return null;

  return buildPerformance(student._id.toString());
}

/**
 * A parent's view of one child (brief section 11).
 *
 * The link is verified against the parent's own record, so a parent cannot
 * read a student they are not linked to by supplying an id
 * (CLAUDE.md section 25).
 */
export async function getChildPerformance(
  user: SessionUser,
  studentId: string
): Promise<StudentPerformance | null> {
  if (user.role !== 'parent') return null;

  const parent = await parentProfileFor(user.id);

  if (!parent) return null;

  const isLinked = parent.students.some((linked) => linked.toString() === studentId);

  if (!isLinked) return null;

  return buildPerformance(studentId);
}

/** Every child of the signed-in parent, for the dashboard summary. */
export async function getChildrenPerformance(
  user: SessionUser
): Promise<StudentPerformance[]> {
  if (user.role !== 'parent') return [];

  const parent = await parentProfileFor(user.id);

  if (!parent) return [];

  return Promise.all(
    parent.students.map((studentId) => buildPerformance(studentId.toString()))
  );
}

/**
 * A tutor's view of the students who have sat their tests (brief section 12).
 *
 * Scoped to tests this tutor created, which is what "students assigned to
 * them" means in the assessment context - a tutor sees performance on their
 * own assessments, not a student's whole record.
 */
export async function getStudentsForTutor(user: SessionUser): Promise<StudentPerformance[]> {
  await connectDB();

  if (user.role !== 'tutor' && !isStaff(user.role)) return [];

  const tests = await Test.find(
    isStaff(user.role) ? {} : { createdBy: user.id }
  )
    .select('_id')
    .lean();

  if (tests.length === 0) return [];

  const studentIds = await Result.distinct('student', {
    test: { $in: tests.map((test) => test._id) },
    publishedAt: { $ne: null },
  });

  const performances = await Promise.all(
    studentIds.slice(0, 50).map((studentId) => buildPerformance(String(studentId)))
  );

  return performances.sort((a, b) => (a.averagePercentage ?? 0) - (b.averagePercentage ?? 0));
}
