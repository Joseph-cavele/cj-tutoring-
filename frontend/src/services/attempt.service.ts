import { connectDB } from '@/lib/mongodb';
import { Question, Test, TestAttempt } from '@/models';
import type { SessionUser } from '@/lib/auth/guard';
import { studentProfileFor } from '@/lib/booking/access';
import { gradeSymbol, type QuestionType } from '@/lib/assessment/constants';
import { markAttempt } from '@/services/marking.service';

export class AttemptError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'AttemptError';
  }
}

export type StudentQuestionView = {
  questionId: string;
  type: QuestionType;
  prompt: string;
  options: { key: string; text: string }[];
  marks: number;
};

/**
 * Starts an attempt, or resumes one already in progress.
 *
 * The deadline is computed here and stored on the attempt, so the timer the
 * student sees is a display of a server-side fact rather than the thing that
 * decides when time is up (brief section 6).
 */
export async function startAttempt(user: SessionUser, testId: string) {
  await connectDB();

  const student = await studentProfileFor(user.id);

  if (!student) throw new AttemptError('Your student profile is not set up yet', 409);

  const test = await Test.findById(testId).select('status grade durationMinutes attemptsAllowed').lean();

  if (!test || test.status !== 'published') {
    throw new AttemptError('That test is not available', 404);
  }

  // A student may only sit tests set for their own grade.
  if (test.grade.toString() !== student.grade.toString()) {
    throw new AttemptError('That test is not for your grade', 403);
  }

  const existing = await TestAttempt.findOne({ test: test._id, student: student._id });

  if (existing) {
    if (existing.status !== 'in_progress') {
      throw new AttemptError('You have already completed this test', 409);
    }

    return { attemptId: existing._id.toString(), expiresAt: existing.expiresAt?.toISOString() };
  }

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + test.durationMinutes * 60_000);

  try {
    const attempt = await TestAttempt.create({
      test: test._id,
      student: student._id,
      attemptNumber: 1,
      answers: [],
      status: 'in_progress',
      startedAt,
      expiresAt,
    });

    return { attemptId: attempt._id.toString(), expiresAt: expiresAt.toISOString() };
  } catch (error) {
    // The unique index on (test, student, attemptNumber) is what actually
    // enforces one attempt, so a race loses here rather than duplicating.
    if (typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000) {
      throw new AttemptError('You have already started this test', 409);
    }

    throw error;
  }
}

/**
 * The paper as the student sees it.
 *
 * `correctAnswer`, `explanation` and `rubric` are `select: false` and are not
 * asked for here, so the answer key cannot reach the browser mid-test
 * (brief section 6).
 */
export async function getAttemptPaper(user: SessionUser, attemptId: string) {
  await connectDB();

  const student = await studentProfileFor(user.id);

  if (!student) throw new AttemptError('Your student profile is not set up yet', 409);

  // Scoped by student: an attempt belonging to someone else is simply not found.
  const attempt = await TestAttempt.findOne({ _id: attemptId, student: student._id }).lean();

  if (!attempt) throw new AttemptError('That attempt was not found', 404);

  const test = await Test.findById(attempt.test)
    .populate<{ subject: { name: string } }>('subject', 'name')
    .lean();

  if (!test) throw new AttemptError('That test was not found', 404);

  const questions = await Question.find({ test: test._id })
    .select('type prompt options marks order')
    .sort({ order: 1 })
    .lean();

  return {
    attemptId: attempt._id.toString(),
    status: attempt.status,
    expiresAt: attempt.expiresAt?.toISOString() ?? null,
    test: {
      testId: test._id.toString(),
      title: test.title,
      description: test.description ?? '',
      subjectName: test.subject?.name ?? 'Subject',
      topic: test.topic ?? '',
      durationMinutes: test.durationMinutes,
      totalMarks: test.totalMarks,
    },
    questions: questions.map<StudentQuestionView>((question) => ({
      questionId: question._id.toString(),
      type: question.type,
      prompt: question.prompt,
      options: question.options ?? [],
      marks: question.marks,
    })),
    // Whatever they had typed before a refresh or a dropped connection.
    savedAnswers: attempt.answers.map((answer) => ({
      questionId: answer.question.toString(),
      response: answer.response,
    })),
  };
}

/**
 * Stores progress without submitting.
 *
 * Called as the student works, so a closed tab or a flat battery does not lose
 * their answers (brief section 6).
 */
export async function saveAttemptProgress(
  user: SessionUser,
  input: { attemptId: string; answers: { questionId: string; response: string }[] }
) {
  await connectDB();

  const student = await studentProfileFor(user.id);

  if (!student) throw new AttemptError('Your student profile is not set up yet', 409);

  const attempt = await TestAttempt.findOne({ _id: input.attemptId, student: student._id });

  if (!attempt) throw new AttemptError('That attempt was not found', 404);
  if (attempt.status !== 'in_progress') return { saved: false };

  attempt.answers = input.answers.map((answer) => ({
    question: answer.questionId as unknown as (typeof attempt.answers)[number]['question'],
    response: answer.response,
  }));

  await attempt.save();

  return { saved: true };
}

/**
 * Submits an attempt and marks it.
 *
 * The submitted answers are stored, then marking runs entirely on the server
 * from the stored answer key - no score is ever accepted from the browser
 * (brief section 14).
 */
export async function submitAttempt(
  user: SessionUser,
  input: { attemptId: string; answers: { questionId: string; response: string }[] }
) {
  await connectDB();

  const student = await studentProfileFor(user.id);

  if (!student) throw new AttemptError('Your student profile is not set up yet', 409);

  const attempt = await TestAttempt.findOne({ _id: input.attemptId, student: student._id });

  if (!attempt) throw new AttemptError('That attempt was not found', 404);

  if (attempt.status !== 'in_progress') {
    // Already submitted - most likely the timer auto-submitted first. Show the
    // result rather than erroring.
    return { attemptId: attempt._id.toString(), alreadySubmitted: true };
  }

  // Late answers are dropped: the deadline is the server's, not the timer's.
  const isLate = Boolean(attempt.expiresAt && attempt.expiresAt.getTime() < Date.now());

  if (!isLate) {
    attempt.answers = input.answers.map((answer) => ({
      question: answer.questionId as unknown as (typeof attempt.answers)[number]['question'],
      response: answer.response,
    }));
  }

  attempt.status = 'submitted';
  attempt.submittedAt = new Date();
  attempt.autoSubmitted = isLate;
  await attempt.save();

  await markAttempt(attempt._id.toString());

  return { attemptId: attempt._id.toString(), alreadySubmitted: false, wasLate: isLate };
}

/**
 * Submits an attempt whose time has run out.
 *
 * The browser asks for this when its timer hits zero, but the server checks
 * the stored deadline before acting, so calling it early does nothing.
 */
export async function autoSubmitIfExpired(user: SessionUser, attemptId: string) {
  await connectDB();

  const student = await studentProfileFor(user.id);

  if (!student) throw new AttemptError('Your student profile is not set up yet', 409);

  const attempt = await TestAttempt.findOne({ _id: attemptId, student: student._id });

  if (!attempt) throw new AttemptError('That attempt was not found', 404);
  if (attempt.status !== 'in_progress') return { submitted: false };

  if (!attempt.expiresAt || attempt.expiresAt.getTime() > Date.now()) {
    return { submitted: false };
  }

  attempt.status = 'submitted';
  attempt.submittedAt = new Date();
  attempt.autoSubmitted = true;
  await attempt.save();

  await markAttempt(attempt._id.toString());

  return { submitted: true };
}

export type AttemptResultView = {
  attemptId: string;
  status: string;
  testTitle: string;
  subjectName: string;
  topic: string;
  score: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  isPassed: boolean;
  feedback: string;
  weakAreas: string[];
  autoSubmitted: boolean;
  completedAt: string | null;
  questions: {
    questionId: string;
    prompt: string;
    type: QuestionType;
    response: string;
    marksAwarded: number;
    maxMarks: number;
    isCorrect: boolean | null;
    markedBy: string | null;
    feedback: string;
    /** Released only after marking - never while a test is in progress. */
    correctAnswer: string | null;
    explanation: string | null;
  }[];
};

/**
 * The marked paper, for the student who sat it.
 *
 * The answer key is included here and nowhere else: it is selected only once
 * the attempt has been marked, so "do not reveal correct answers before
 * submission" holds by construction rather than by a UI decision.
 */
export async function getAttemptResult(
  user: SessionUser,
  attemptId: string
): Promise<AttemptResultView | null> {
  await connectDB();

  const student = await studentProfileFor(user.id);

  if (!student) return null;

  // Scoped to this student: another student's attempt is simply not found.
  const attempt = await TestAttempt.findOne({ _id: attemptId, student: student._id }).lean();

  if (!attempt) return null;

  const test = await Test.findById(attempt.test)
    .populate<{ subject: { name: string } }>('subject', 'name')
    .lean();

  if (!test) return null;

  const isMarked = attempt.status === 'marked';

  const questions = await Question.find({ test: test._id })
    // The answer key is only ever selected once the paper is marked.
    .select(isMarked ? '+correctAnswer +explanation' : '')
    .sort({ order: 1 })
    .lean();

  const answerByQuestion = new Map(
    attempt.answers.map((answer) => [answer.question.toString(), answer])
  );

  return {
    attemptId: attempt._id.toString(),
    status: attempt.status,
    testTitle: test.title,
    subjectName: test.subject?.name ?? 'Subject',
    topic: test.topic ?? '',
    score: attempt.score ?? 0,
    totalMarks: attempt.totalMarks ?? test.totalMarks,
    percentage: attempt.percentage ?? 0,
    grade: gradeSymbol(attempt.percentage ?? 0),
    isPassed: attempt.isPassed ?? false,
    feedback: attempt.feedback ?? '',
    weakAreas: attempt.weakAreas ?? [],
    autoSubmitted: attempt.autoSubmitted,
    completedAt: attempt.submittedAt?.toISOString() ?? null,
    questions: questions.map((question) => {
      const answer = answerByQuestion.get(question._id.toString());

      return {
        questionId: question._id.toString(),
        prompt: question.prompt,
        type: question.type,
        response: answer?.response ?? '',
        marksAwarded: answer?.marksAwarded ?? 0,
        maxMarks: answer?.maxMarks ?? question.marks,
        isCorrect: answer?.isCorrect ?? null,
        markedBy: answer?.markedBy ?? null,
        feedback: answer?.feedback ?? '',
        correctAnswer: isMarked ? question.correctAnswer : null,
        explanation: isMarked ? (question.explanation ?? null) : null,
      };
    }),
  };
}
