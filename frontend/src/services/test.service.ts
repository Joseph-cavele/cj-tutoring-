import { connectDB } from '@/lib/mongodb';
import { Grade, Question, Subject, Test, TestAttempt } from '@/models';
import type { SessionUser } from '@/lib/auth/guard';
import { studentProfileFor } from '@/lib/booking/access';
import {
  isAutoMarked,
  type Difficulty,
  type QuestionType,
  type TestStatus,
} from '@/lib/assessment/constants';
import { generateTest } from '@/lib/ai/assessment';
import type { GenerateTestInput, SaveTestInput } from '@/validations/test';

export class TestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'TestError';
  }
}

/* ------------------------------------------------------------------ *
 * Tutor side
 * ------------------------------------------------------------------ */

/**
 * Generates a test with the AI and saves it as a draft.
 *
 * Draft, always. The brief is explicit that AI-generated tests are not
 * published without tutor review, so there is no code path here that can
 * publish one.
 */
export async function generateTestForTutor(user: SessionUser, input: GenerateTestInput) {
  await connectDB();

  const [subject, grade] = await Promise.all([
    Subject.findById(input.subjectId).select('name').lean(),
    Grade.findById(input.gradeId).select('name').lean(),
  ]);

  if (!subject) throw new TestError('That subject was not found', 404);
  if (!grade) throw new TestError('That grade was not found', 404);

  const generated = await generateTest({
    subject: subject.name,
    gradeLabel: grade.name,
    topic: input.topic,
    difficulty: input.difficulty,
    questionCount: input.questionCount,
    totalMarks: input.totalMarks,
    questionTypes: input.questionTypes,
  });

  if (generated.length === 0) {
    throw new TestError('The AI did not return any questions. Please try again.', 502);
  }

  // The stored total is what the questions actually add up to, not what was
  // requested: a mark total that disagrees with the questions would make every
  // percentage wrong.
  const totalMarks = generated.reduce((sum, question) => sum + question.marks, 0);

  const test = await Test.create({
    title: input.title?.trim() || `${subject.name}: ${input.topic}`,
    description: `AI-generated ${input.difficulty} test on ${input.topic}.`,
    subject: subject._id,
    grade: grade._id,
    topic: input.topic,
    difficulty: input.difficulty as Difficulty,
    createdBy: user.id,
    durationMinutes: input.durationMinutes,
    totalMarks,
    status: 'draft',
    isAiGenerated: true,
  });

  await Question.insertMany(
    generated.map((question, index) => ({
      test: test._id,
      type: question.type,
      prompt: question.prompt,
      options: question.options,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation || undefined,
      rubric: question.rubric,
      marks: question.marks,
      order: index,
    }))
  );

  return { testId: test._id.toString(), questionCount: generated.length, totalMarks };
}

/** The tutor's own tests. Scoped by createdBy, so one tutor cannot list another's. */
export async function listTutorTests(user: SessionUser) {
  await connectDB();

  const tests = await Test.find({ createdBy: user.id })
    .populate<{ subject: { name: string } }>('subject', 'name')
    .populate<{ grade: { name: string } }>('grade', 'name')
    .sort({ updatedAt: -1 })
    .limit(100)
    .lean();

  const counts = await TestAttempt.aggregate<{ _id: unknown; total: number; marked: number }>([
    { $match: { test: { $in: tests.map((test) => test._id) } } },
    {
      $group: {
        _id: '$test',
        total: { $sum: 1 },
        marked: { $sum: { $cond: [{ $eq: ['$status', 'marked'] }, 1, 0] } },
      },
    },
  ]);

  const byTest = new Map(counts.map((row) => [String(row._id), row]));

  return tests.map((test) => ({
    testId: test._id.toString(),
    title: test.title,
    subjectName: test.subject?.name ?? 'Subject',
    gradeName: test.grade?.name ?? 'Grade',
    topic: test.topic ?? '',
    difficulty: test.difficulty,
    status: test.status as TestStatus,
    totalMarks: test.totalMarks,
    durationMinutes: test.durationMinutes,
    isAiGenerated: test.isAiGenerated,
    submissionCount: byTest.get(test._id.toString())?.total ?? 0,
    markedCount: byTest.get(test._id.toString())?.marked ?? 0,
    updatedAt: test.updatedAt.toISOString(),
  }));
}

export type TutorQuestionView = {
  questionId: string;
  type: QuestionType;
  prompt: string;
  options: { key: string; text: string }[];
  correctAnswer: string;
  explanation: string;
  rubric: { marks: number; criterion: string }[];
  marks: number;
};

/**
 * A test with its full answer key, for the tutor who owns it.
 *
 * The ownership check is the query itself: a test created by someone else
 * simply is not found, so there is no separate "is this mine" branch that
 * could be forgotten.
 */
export async function getTestForTutor(user: SessionUser, testId: string) {
  await connectDB();

  const filter = user.role === 'admin' ? { _id: testId } : { _id: testId, createdBy: user.id };

  const test = await Test.findOne(filter)
    .populate<{ subject: { name: string } }>('subject', 'name')
    .populate<{ grade: { name: string } }>('grade', 'name')
    .lean();

  if (!test) return null;

  // Explicitly selecting the fields that are select:false.
  const questions = await Question.find({ test: test._id })
    .select('+correctAnswer +explanation +rubric')
    .sort({ order: 1 })
    .lean();

  return {
    testId: test._id.toString(),
    title: test.title,
    description: test.description ?? '',
    subjectName: test.subject?.name ?? 'Subject',
    gradeName: test.grade?.name ?? 'Grade',
    topic: test.topic ?? '',
    difficulty: test.difficulty,
    status: test.status as TestStatus,
    durationMinutes: test.durationMinutes,
    totalMarks: test.totalMarks,
    isAiGenerated: test.isAiGenerated,
    questions: questions.map<TutorQuestionView>((question) => ({
      questionId: question._id.toString(),
      type: question.type,
      prompt: question.prompt,
      options: question.options ?? [],
      correctAnswer: question.correctAnswer,
      explanation: question.explanation ?? '',
      rubric: question.rubric ?? [],
      marks: question.marks,
    })),
  };
}

/**
 * Saves a tutor's edits to a draft.
 *
 * Questions are replaced wholesale, because the editor sends the whole test
 * and a question the tutor deleted must actually disappear. Refused once the
 * test is published: changing the questions under students who have already
 * sat it would invalidate their marks.
 */
export async function saveTestDraft(user: SessionUser, input: SaveTestInput) {
  await connectDB();

  const filter = user.role === 'admin'
    ? { _id: input.testId }
    : { _id: input.testId, createdBy: user.id };

  const test = await Test.findOne(filter);

  if (!test) throw new TestError('That test was not found', 404);

  if (test.status !== 'draft') {
    throw new TestError('A published test cannot be edited. Close it and copy it instead.', 409);
  }

  const totalMarks = input.questions.reduce((sum, question) => sum + question.marks, 0);

  test.title = input.title;
  test.description = input.description || undefined;
  test.topic = input.topic || undefined;
  test.durationMinutes = input.durationMinutes;
  test.totalMarks = totalMarks;
  await test.save();

  await Question.deleteMany({ test: test._id });

  await Question.insertMany(
    input.questions.map((question, index) => ({
      test: test._id,
      type: question.type,
      prompt: question.prompt,
      // Options only mean anything for multiple choice.
      options: question.type === 'multiple_choice' ? question.options : [],
      correctAnswer: question.correctAnswer,
      explanation: question.explanation || undefined,
      // A rubric only applies where a human judgement is needed.
      rubric: isAutoMarked(question.type) ? [] : question.rubric,
      marks: question.marks,
      order: index,
    }))
  );

  return { testId: test._id.toString(), totalMarks };
}

/** Publishes a reviewed draft so students can see it (brief section 3). */
export async function publishTest(user: SessionUser, testId: string) {
  await connectDB();

  const filter = user.role === 'admin' ? { _id: testId } : { _id: testId, createdBy: user.id };
  const test = await Test.findOne(filter);

  if (!test) throw new TestError('That test was not found', 404);
  if (test.status === 'published') return { testId, status: test.status };

  const questionCount = await Question.countDocuments({ test: test._id });

  if (questionCount === 0) {
    throw new TestError('Add at least one question before publishing', 409);
  }

  test.status = 'published';
  test.publishedAt = new Date();
  await test.save();

  return { testId: test._id.toString(), status: test.status };
}

/** Closes a test so no new attempts can start. Existing marks are untouched. */
export async function closeTest(user: SessionUser, testId: string) {
  await connectDB();

  const filter = user.role === 'admin' ? { _id: testId } : { _id: testId, createdBy: user.id };
  const test = await Test.findOneAndUpdate(filter, { $set: { status: 'closed' } }, { new: true });

  if (!test) throw new TestError('That test was not found', 404);

  return { testId: test._id.toString(), status: test.status as TestStatus };
}

/** Deletes a draft. Refused once anyone has sat it. */
export async function deleteTest(user: SessionUser, testId: string) {
  await connectDB();

  const filter = user.role === 'admin' ? { _id: testId } : { _id: testId, createdBy: user.id };
  const test = await Test.findOne(filter).select('_id status');

  if (!test) throw new TestError('That test was not found', 404);

  const attempts = await TestAttempt.countDocuments({ test: test._id });

  if (attempts > 0) {
    throw new TestError('Students have already sat this test. Close it instead of deleting it.', 409);
  }

  await Question.deleteMany({ test: test._id });
  await Test.deleteOne({ _id: test._id });

  return { deleted: true };
}

/* ------------------------------------------------------------------ *
 * Student side
 * ------------------------------------------------------------------ */

/**
 * Tests this student may sit.
 *
 * Matched on their own grade, taken from their student record rather than
 * from the request, and limited to published tests inside their availability
 * window.
 */
export async function listAvailableTests(user: SessionUser) {
  await connectDB();

  const student = await studentProfileFor(user.id);

  if (!student) return [];

  const now = new Date();

  const tests = await Test.find({
    status: 'published',
    grade: student.grade,
    $and: [
      { $or: [{ availableFrom: null }, { availableFrom: { $exists: false } }, { availableFrom: { $lte: now } }] },
      { $or: [{ availableUntil: null }, { availableUntil: { $exists: false } }, { availableUntil: { $gte: now } }] },
    ],
  })
    .populate<{ subject: { name: string } }>('subject', 'name')
    .sort({ publishedAt: -1 })
    .limit(50)
    .lean();

  const attempts = await TestAttempt.find({
    student: student._id,
    test: { $in: tests.map((test) => test._id) },
  })
    .select('test status percentage attemptNumber')
    .lean();

  const byTest = new Map(attempts.map((attempt) => [attempt.test.toString(), attempt]));

  return tests.map((test) => {
    const attempt = byTest.get(test._id.toString());

    return {
      testId: test._id.toString(),
      title: test.title,
      description: test.description ?? '',
      subjectName: test.subject?.name ?? 'Subject',
      topic: test.topic ?? '',
      difficulty: test.difficulty,
      durationMinutes: test.durationMinutes,
      totalMarks: test.totalMarks,
      attemptsAllowed: test.attemptsAllowed,
      attemptStatus: attempt?.status ?? null,
      attemptId: attempt?._id.toString() ?? null,
      percentage: attempt?.percentage ?? null,
      /** Can only be started when nothing has been sat yet. */
      canStart: !attempt,
    };
  });
}

export type SubmissionView = {
  attemptId: string;
  studentName: string;
  score: number;
  totalMarks: number;
  percentage: number;
  status: string;
  submittedAt: string | null;
  autoSubmitted: boolean;
  answers: {
    questionId: string;
    prompt: string;
    type: QuestionType;
    response: string;
    marksAwarded: number;
    maxMarks: number;
    markedBy: string | null;
    feedback: string;
    /** Present for written questions, so the tutor can check the AI's work. */
    rubric: { marks: number; criterion: string }[];
    modelAnswer: string;
  }[];
};

/**
 * Submissions on one of the tutor's tests (brief section 12).
 *
 * Ownership is the query: a test created by another tutor yields nothing, so
 * this cannot be used to read another tutor's marking.
 */
export async function getTestSubmissions(
  user: SessionUser,
  testId: string
): Promise<SubmissionView[]> {
  await connectDB();

  const filter = user.role === 'admin' ? { _id: testId } : { _id: testId, createdBy: user.id };
  const test = await Test.findOne(filter).select('_id').lean();

  if (!test) return [];

  const [attempts, questions] = await Promise.all([
    TestAttempt.find({ test: test._id, status: { $ne: 'in_progress' } })
      .populate<{ student: { user?: { name?: string } } }>({
        path: 'student',
        select: 'user',
        populate: { path: 'user', select: 'name' },
      })
      .sort({ submittedAt: -1 })
      .limit(100)
      .lean(),
    // The tutor owns this test, so the answer key is theirs to see.
    Question.find({ test: test._id })
      .select('+correctAnswer +rubric')
      .sort({ order: 1 })
      .lean(),
  ]);

  const questionById = new Map(questions.map((question) => [question._id.toString(), question]));

  return attempts.map((attempt) => ({
    attemptId: attempt._id.toString(),
    studentName: attempt.student?.user?.name ?? 'Student',
    score: attempt.score ?? 0,
    totalMarks: attempt.totalMarks ?? 0,
    percentage: attempt.percentage ?? 0,
    status: attempt.status,
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    autoSubmitted: attempt.autoSubmitted,
    answers: attempt.answers.map((answer) => {
      const question = questionById.get(answer.question.toString());

      return {
        questionId: answer.question.toString(),
        prompt: question?.prompt ?? 'Question',
        type: (question?.type ?? 'short_answer') as QuestionType,
        response: answer.response ?? '',
        marksAwarded: answer.marksAwarded ?? 0,
        maxMarks: answer.maxMarks ?? question?.marks ?? 0,
        markedBy: answer.markedBy ?? null,
        feedback: answer.feedback ?? '',
        rubric: question?.rubric ?? [],
        modelAnswer: question?.correctAnswer ?? '',
      };
    }),
  }));
}
