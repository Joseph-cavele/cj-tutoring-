import { connectDB } from '@/lib/mongodb';
import { MarkAdjustment, Question, Result, Test, TestAttempt } from '@/models';
import type { SessionUser } from '@/lib/auth/guard';
import { gradeSymbol, isAutoMarked } from '@/lib/assessment/constants';
import { markObjective, toPercentage } from '@/lib/assessment/marking';
import { AiUnavailableError, generateFeedback, markWrittenAnswer } from '@/lib/ai/assessment';
import { isStaff } from '@/lib/auth/roles';

export class MarkingError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'MarkingError';
  }
}

/**
 * Marks a submitted attempt (brief section 7).
 *
 * Two mechanisms, deliberately separate:
 *
 * - Objective questions are marked deterministically from the stored answer
 *   key. The AI never sees them, so a multiple-choice answer is never at the
 *   mercy of a model's mood.
 * - Written questions go to the AI with only the question, the rubric, the
 *   model answer and the student's response, and the mark it returns is
 *   clamped to the tutor's allocation.
 *
 * Runs entirely server-side. No mark in here comes from the browser.
 */
export async function markAttempt(attemptId: string) {
  await connectDB();

  const attempt = await TestAttempt.findById(attemptId);

  if (!attempt) throw new MarkingError('That attempt was not found', 404);
  if (attempt.status === 'marked') return { alreadyMarked: true };

  const test = await Test.findById(attempt.test)
    .populate<{ subject: { _id: unknown; name: string } }>('subject', 'name')
    .lean();

  if (!test) throw new MarkingError('That test was not found', 404);

  // The answer key, fetched explicitly because these fields are select:false.
  const questions = await Question.find({ test: test._id })
    .select('+correctAnswer +explanation +rubric')
    .sort({ order: 1 })
    .lean();

  const responseByQuestion = new Map(
    attempt.answers.map((answer) => [answer.question.toString(), answer.response ?? ''])
  );

  const marked: {
    question: string;
    response: string;
    isCorrect?: boolean;
    marksAwarded: number;
    maxMarks: number;
    markedBy: 'auto' | 'ai';
    feedback?: string;
    prompt: string;
  }[] = [];

  let aiFailed = false;

  for (const question of questions) {
    const questionId = question._id.toString();
    const response = responseByQuestion.get(questionId) ?? '';

    if (isAutoMarked(question.type)) {
      const result = markObjective({
        type: question.type,
        correctAnswer: question.correctAnswer,
        response,
        marks: question.marks,
      });

      marked.push({
        question: questionId,
        response,
        isCorrect: result.isCorrect,
        marksAwarded: result.marksAwarded,
        maxMarks: question.marks,
        markedBy: 'auto',
        feedback: result.isCorrect
          ? undefined
          : (question.explanation ?? undefined),
        prompt: question.prompt,
      });

      continue;
    }

    // Written answer: rubric-based AI marking.
    try {
      const result = await markWrittenAnswer({
        prompt: question.prompt,
        modelAnswer: question.correctAnswer,
        rubric: question.rubric ?? [],
        maxMarks: question.marks,
        studentAnswer: response,
      });

      marked.push({
        question: questionId,
        response,
        marksAwarded: result.marksAwarded,
        maxMarks: question.marks,
        markedBy: 'ai',
        feedback: result.improvement
          ? `${result.feedback} ${result.improvement}`
          : result.feedback,
        prompt: question.prompt,
      });
    } catch (error) {
      // The AI being down must not lose the student's work or invent a mark.
      // Zero is recorded provisionally and the attempt is flagged for the
      // tutor, who can adjust it - which is audited.
      if (!(error instanceof AiUnavailableError)) throw error;

      aiFailed = true;

      marked.push({
        question: questionId,
        response,
        marksAwarded: 0,
        maxMarks: question.marks,
        markedBy: 'ai',
        feedback: 'This answer is waiting for your tutor to mark it.',
        prompt: question.prompt,
      });
    }
  }

  const score = marked.reduce((sum, entry) => sum + entry.marksAwarded, 0);
  const totalMarks = questions.reduce((sum, question) => sum + question.marks, 0);
  const percentage = toPercentage(score, totalMarks);

  const summary = await generateFeedback({
    subject: test.subject?.name ?? 'this subject',
    topic: test.topic ?? test.title,
    percentage,
    perQuestion: marked.map((entry) => ({
      prompt: entry.prompt,
      marksAwarded: entry.marksAwarded,
      maxMarks: entry.maxMarks,
    })),
  });

  attempt.answers = marked.map((entry) => ({
    question: entry.question as unknown as (typeof attempt.answers)[number]['question'],
    response: entry.response,
    isCorrect: entry.isCorrect,
    marksAwarded: entry.marksAwarded,
    maxMarks: entry.maxMarks,
    markedBy: entry.markedBy,
    feedback: entry.feedback,
  }));

  attempt.score = score;
  attempt.totalMarks = totalMarks;
  attempt.percentage = percentage;
  attempt.isPassed = test.passMark ? score >= test.passMark : percentage >= 50;
  attempt.feedback = aiFailed
    ? `${summary.feedback} Some written answers are still awaiting your tutor's marking.`
    : summary.feedback;
  attempt.weakAreas = summary.weakAreas;
  attempt.status = 'marked';
  attempt.markedAt = new Date();

  await attempt.save();

  await publishResult(attempt._id.toString());

  return { alreadyMarked: false, score, totalMarks, percentage };
}

/**
 * Writes the student-visible Result row.
 *
 * Upserted on the attempt, so re-marking after a tutor adjusts a mark updates
 * the same result rather than stacking duplicates in the student's history.
 */
async function publishResult(attemptId: string) {
  const attempt = await TestAttempt.findById(attemptId).lean();

  if (!attempt || attempt.status !== 'marked') return;

  const test = await Test.findById(attempt.test).select('subject title').lean();

  if (!test) return;

  await Result.findOneAndUpdate(
    { attempt: attempt._id },
    {
      $set: {
        student: attempt.student,
        subject: test.subject,
        test: test._id,
        attempt: attempt._id,
        score: attempt.score ?? 0,
        maxScore: attempt.totalMarks ?? 0,
        percentage: attempt.percentage ?? 0,
        grade: gradeSymbol(attempt.percentage ?? 0),
        remarks: attempt.feedback,
        weakAreas: attempt.weakAreas ?? [],
        publishedAt: new Date(),
      },
    },
    { upsert: true }
  );
}

/**
 * A tutor overrides one mark (brief section 12).
 *
 * The change is audited before it is applied - who, from what, to what, and
 * why - and the totals are recomputed rather than adjusted by hand, so the
 * percentage can never drift out of step with the answers.
 */
export async function adjustMark(
  user: SessionUser,
  input: { attemptId: string; questionId: string; newMarks: number; reason: string }
) {
  await connectDB();

  const attempt = await TestAttempt.findById(input.attemptId);

  if (!attempt) throw new MarkingError('That attempt was not found', 404);

  // Only the tutor who set the test (or an admin) may change its marks.
  const test = await Test.findById(attempt.test).select('createdBy passMark').lean();

  if (!test) throw new MarkingError('That test was not found', 404);

  if (!isStaff(user.role) && test.createdBy.toString() !== user.id) {
    throw new MarkingError('Only the tutor who set this test can change its marks', 403);
  }

  const answer = attempt.answers.find(
    (entry) => entry.question.toString() === input.questionId
  );

  if (!answer) throw new MarkingError('That question is not on this attempt', 404);

  const maxMarks = answer.maxMarks ?? 0;

  // A tutor may not award more than the question is worth either.
  if (input.newMarks > maxMarks) {
    throw new MarkingError(`That question is only worth ${maxMarks} mark(s)`, 400);
  }

  const originalMarks = answer.marksAwarded ?? 0;

  await MarkAdjustment.create({
    attempt: attempt._id,
    question: input.questionId,
    originalMarks,
    newMarks: input.newMarks,
    changedBy: user.id,
    reason: input.reason,
  });

  answer.marksAwarded = input.newMarks;
  answer.markedBy = 'tutor';

  const score = attempt.answers.reduce((sum, entry) => sum + (entry.marksAwarded ?? 0), 0);
  const totalMarks = attempt.totalMarks ?? 0;

  attempt.score = score;
  attempt.percentage = toPercentage(score, totalMarks);
  attempt.isPassed = test.passMark ? score >= test.passMark : attempt.percentage >= 50;

  await attempt.save();
  await publishResult(attempt._id.toString());

  return { score, percentage: attempt.percentage };
}

/** The audit trail for one attempt, for the tutor's marking screen. */
export async function getMarkAdjustments(attemptId: string) {
  await connectDB();

  const rows = await MarkAdjustment.find({ attempt: attemptId })
    .populate<{ changedBy: { name: string } }>('changedBy', 'name')
    .sort({ createdAt: -1 })
    .lean();

  return rows.map((row) => ({
    id: row._id.toString(),
    questionId: row.question?.toString() ?? null,
    originalMarks: row.originalMarks,
    newMarks: row.newMarks,
    changedByName: row.changedBy?.name ?? 'Someone',
    reason: row.reason,
    changedAt: row.createdAt.toISOString(),
  }));
}
