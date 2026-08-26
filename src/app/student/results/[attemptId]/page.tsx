import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Check, Clock, Sparkles, X } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { getAttemptResult } from '@/services/attempt.service';
import { QUESTION_TYPE_LABELS } from '@/lib/assessment/constants';
import { SECONDARY_BUTTON } from '@/components/booking/ui';

export const dynamic = 'force-dynamic';

/**
 * A marked test (brief section 9).
 *
 * Scoped to the student who sat it, so the URL cannot be edited to read
 * someone else's marks.
 */
export default async function ResultPage(props: {
  params: Promise<{ attemptId: string }>;
}) {
  const user = await requireRole('student', '/student/tests');

  // params is a Promise in Next 16.
  const { attemptId } = await props.params;

  const result = await getAttemptResult(user, attemptId);

  if (!result) notFound();

  // Marking runs on submit, so this is the brief window before it finishes.
  if (result.status !== 'marked') {
    return (
      <section className="bg-brand-cream py-16">
        <div className="mx-auto max-w-lg px-4 text-center sm:px-6">
          <div className="rounded-3xl bg-white p-8 shadow-[var(--shadow-soft)]">
            <Clock className="mx-auto size-12 text-brand-amber" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-extrabold text-brand-navy">
              Marking your test
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-brand-slate">
              This takes a moment for written answers. Refresh shortly and your
              mark will be here.
            </p>
            <Link href="/student/tests" className={`${SECONDARY_BUTTON} mt-6`}>
              Back to tests
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div>
          <Link
            href="/student/tests"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to tests
          </Link>
        </div>

        <div className="rounded-3xl bg-white p-6 text-center shadow-[var(--shadow-soft)] sm:p-8">
          <p className="text-[13px] font-bold tracking-wider text-brand-slate uppercase">
            {result.subjectName}
            {result.topic ? ` — ${result.topic}` : ''}
          </p>

          <h1 className="mt-1 text-2xl font-extrabold text-brand-navy">
            {result.testTitle}
          </h1>

          <p className="mt-6 text-5xl font-extrabold tracking-tight text-brand-navy">
            {result.percentage}%
          </p>

          <p className="mt-2 text-[16px] text-brand-slate">
            {result.score} out of {result.totalMarks} · Grade{' '}
            <span className="font-bold text-brand-navy">{result.grade}</span>
          </p>

          {result.autoSubmitted ? (
            <p className="mt-3 text-[13px] text-brand-amber-text">
              This test was submitted automatically when the time ran out.
            </p>
          ) : null}
        </div>

        {result.feedback ? (
          <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
            <h2 className="text-[17px] font-bold text-brand-navy">Feedback</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-brand-navy">
              {result.feedback}
            </p>

            {result.weakAreas.length > 0 ? (
              <div className="mt-4">
                <p className="text-[13px] font-bold tracking-wide text-brand-slate uppercase">
                  Worth revising
                </p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {result.weakAreas.map((area) => (
                    <li
                      key={area}
                      className="rounded-full bg-brand-amber/15 px-3 py-1 text-[13px] font-semibold text-brand-amber-text"
                    >
                      {area}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* CLAUDE.md section 17: AI output is checked with a human. */}
            <p className="mt-4 flex items-start gap-2 rounded-xl bg-brand-blue-50/60 p-3 text-[13px] leading-relaxed text-brand-slate">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden="true" />
              Written answers were marked with AI assistance. If you think a mark
              is wrong, raise it with your tutor - they can review and change it.
            </p>
          </div>
        ) : null}

        <div className="space-y-3">
          <h2 className="text-[18px] font-extrabold text-brand-navy">Your answers</h2>

          <ol className="space-y-3">
            {result.questions.map((question, index) => {
              const full = question.marksAwarded >= question.maxMarks;
              const none = question.marksAwarded === 0;

              return (
                <li
                  key={question.questionId}
                  className="rounded-2xl border border-brand-blue-100 bg-white p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-[15px] font-bold text-brand-navy">
                      {full ? (
                        <Check className="size-4 text-green-600" aria-hidden="true" />
                      ) : none ? (
                        <X className="size-4 text-red-600" aria-hidden="true" />
                      ) : null}
                      Question {index + 1}
                    </h3>

                    <p
                      className={`text-[14px] font-bold ${
                        full ? 'text-green-700' : none ? 'text-red-700' : 'text-brand-amber-text'
                      }`}
                    >
                      {question.marksAwarded} / {question.maxMarks}
                    </p>
                  </div>

                  <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-line text-brand-navy">
                    {question.prompt}
                  </p>

                  <dl className="mt-3 space-y-2 text-[14px]">
                    <div className="rounded-xl bg-brand-blue-50/50 p-3">
                      <dt className="text-[12px] font-bold tracking-wide text-brand-slate uppercase">
                        Your answer
                      </dt>
                      <dd className="mt-1 whitespace-pre-line text-brand-navy">
                        {question.response || <em className="text-brand-slate">Not answered</em>}
                      </dd>
                    </div>

                    {!full && question.correctAnswer ? (
                      <div className="rounded-xl bg-green-50 p-3">
                        <dt className="text-[12px] font-bold tracking-wide text-green-800 uppercase">
                          {QUESTION_TYPE_LABELS[question.type] === 'Written explanation'
                            ? 'Model answer'
                            : 'Correct answer'}
                        </dt>
                        <dd className="mt-1 whitespace-pre-line text-green-900">
                          {question.correctAnswer}
                        </dd>
                      </div>
                    ) : null}

                    {question.feedback ? (
                      <div className="rounded-xl bg-white p-3 ring-1 ring-brand-blue-100">
                        <dt className="text-[12px] font-bold tracking-wide text-brand-slate uppercase">
                          Comment
                        </dt>
                        <dd className="mt-1 text-brand-navy">{question.feedback}</dd>
                      </div>
                    ) : null}

                    {question.explanation ? (
                      <div className="rounded-xl bg-white p-3 ring-1 ring-brand-blue-100">
                        <dt className="text-[12px] font-bold tracking-wide text-brand-slate uppercase">
                          Explanation
                        </dt>
                        <dd className="mt-1 whitespace-pre-line text-brand-navy">
                          {question.explanation}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
