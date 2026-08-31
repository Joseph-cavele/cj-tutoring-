import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Sparkles } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { getTestForTutor, getTestSubmissions } from '@/services/test.service';
import { isAutoMarked, QUESTION_TYPE_LABELS } from '@/lib/assessment/constants';
import MarkAdjuster from '@/components/tutor/MarkAdjuster';
import DashboardSection from '@/components/dashboard/DashboardSection';
import { STAFF_ROLES } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

/**
 * Marking review (brief section 12).
 *
 * Shows what the AI awarded and why, next to the rubric it was given, so a
 * tutor can check its work rather than take it on trust. Any change is
 * audited.
 */
export default async function TestSubmissionsPage(props: {
  params: Promise<{ testId: string }>;
}) {
  const user = await requireRole(STAFF_ROLES, '/tutor/tests');

  // params is a Promise in Next 16.
  const { testId } = await props.params;

  const test = await getTestForTutor(user, testId);

  if (!test) notFound();

  const submissions = await getTestSubmissions(user, testId);

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div>
          <Link
            href={`/tutor/tests/${testId}`}
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to test
          </Link>

          <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            Submissions
          </h1>
          <p className="mt-2 text-[15px] text-brand-slate">
            {test.title} · {test.totalMarks} marks
          </p>
        </div>

        <DashboardSection
          title="Students"
          count={submissions.length}
          emptyTitle="Nobody has sat this test yet"
          emptyBody="Submissions appear here as students complete the test, already marked."
        >
          <div className="space-y-6">
            {submissions.map((submission) => (
              <article
                key={submission.attemptId}
                className="rounded-2xl border border-brand-blue-100 bg-white p-4 sm:p-5"
              >
                <header className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <h2 className="text-[17px] font-bold text-brand-navy">
                      {submission.studentName}
                    </h2>
                    <p className="mt-0.5 text-[13px] text-brand-slate">
                      {submission.submittedAt
                        ? new Intl.DateTimeFormat('en-ZA', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(new Date(submission.submittedAt))
                        : 'Not submitted'}
                      {submission.autoSubmitted ? ' · auto-submitted' : ''}
                    </p>
                  </div>

                  <p className="text-right">
                    <span className="block text-xl font-extrabold text-brand-navy">
                      {submission.percentage}%
                    </span>
                    <span className="block text-[13px] text-brand-slate">
                      {submission.score}/{submission.totalMarks}
                    </span>
                  </p>
                </header>

                <ol className="mt-4 space-y-3">
                  {submission.answers.map((answer, index) => (
                    <li
                      key={answer.questionId}
                      className="rounded-xl border border-brand-blue-100 p-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-[14px] font-bold text-brand-navy">
                          Q{index + 1} · {QUESTION_TYPE_LABELS[answer.type]}
                        </p>

                        <p className="flex items-center gap-2 text-[14px] font-bold text-brand-navy">
                          {answer.markedBy === 'ai' ? (
                            <span
                              title="Marked with AI assistance"
                              className="inline-flex items-center gap-1 rounded-full bg-brand-blue-50 px-2 py-0.5 text-[11px] font-bold tracking-wide text-brand-blue uppercase"
                            >
                              <Sparkles className="size-3" aria-hidden="true" />
                              AI
                            </span>
                          ) : answer.markedBy === 'tutor' ? (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold tracking-wide text-green-800 uppercase">
                              You
                            </span>
                          ) : (
                            <span className="rounded-full bg-brand-blue-50 px-2 py-0.5 text-[11px] font-bold tracking-wide text-brand-slate uppercase">
                              Auto
                            </span>
                          )}
                          {answer.marksAwarded}/{answer.maxMarks}
                        </p>
                      </div>

                      <p className="mt-2 text-[14px] leading-relaxed text-brand-navy">
                        {answer.prompt}
                      </p>

                      <div className="mt-2 rounded-lg bg-brand-blue-50/50 p-2.5">
                        <p className="text-[12px] font-bold tracking-wide text-brand-slate uppercase">
                          Student answer
                        </p>
                        <p className="mt-1 text-[14px] whitespace-pre-line text-brand-navy">
                          {answer.response || (
                            <em className="text-brand-slate">Not answered</em>
                          )}
                        </p>
                      </div>

                      {answer.feedback ? (
                        <p className="mt-2 text-[13px] leading-relaxed text-brand-slate">
                          <span className="font-semibold text-brand-navy">Comment: </span>
                          {answer.feedback}
                        </p>
                      ) : null}

                      {/* The rubric the AI was given, so its mark can be checked
                          against the same criteria a tutor would apply. */}
                      {!isAutoMarked(answer.type) && answer.rubric.length > 0 ? (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-[13px] font-semibold text-brand-blue">
                            Rubric and model answer
                          </summary>
                          <ul className="mt-2 space-y-1 text-[13px] text-brand-navy">
                            {answer.rubric.map((entry, position) => (
                              <li key={position}>
                                <span className="font-semibold">{entry.marks}:</span>{' '}
                                {entry.criterion}
                              </li>
                            ))}
                          </ul>
                          <p className="mt-2 text-[13px] whitespace-pre-line text-brand-slate">
                            {answer.modelAnswer}
                          </p>
                        </details>
                      ) : null}

                      <div className="mt-3">
                        <MarkAdjuster
                          attemptId={submission.attemptId}
                          questionId={answer.questionId}
                          currentMarks={answer.marksAwarded}
                          maxMarks={answer.maxMarks}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </DashboardSection>
      </div>
    </section>
  );
}
