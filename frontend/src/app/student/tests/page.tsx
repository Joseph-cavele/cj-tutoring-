import Link from 'next/link';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { listAvailableTests } from '@/services/test.service';
import StartTestButton from '@/components/student/StartTestButton';
import DashboardSection from '@/components/dashboard/DashboardSection';
import { SECONDARY_BUTTON } from '@/components/booking/ui';

export const dynamic = 'force-dynamic';

/**
 * Tests set for this student (brief section 6).
 *
 * The list is matched to the grade on their own student record, so a student
 * cannot reach a paper set for another grade.
 */
export default async function StudentTestsPage() {
  const user = await requireRole('student', '/student/tests');
  const tests = await listAvailableTests(user);

  const available = tests.filter((test) => test.canStart);
  const inProgress = tests.filter((test) => test.attemptStatus === 'in_progress');
  const done = tests.filter((test) => test.attemptStatus === 'marked');

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-3xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div>
          <Link
            href="/student/dashboard"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to dashboard
          </Link>

          <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            Tests
          </h1>
          <p className="mt-2 text-[15px] text-brand-slate">
            Tests your tutors have set for your grade.
          </p>
        </div>

        {inProgress.length > 0 ? (
          <DashboardSection
            title="In progress"
            description="You started these. The clock is still running."
            count={inProgress.length}
            emptyTitle=""
            emptyBody=""
          >
            <ul className="space-y-3">
              {inProgress.map((test) => (
                <li
                  key={test.testId}
                  className="rounded-2xl border-[1.5px] border-brand-amber bg-white p-4"
                >
                  <h3 className="text-[16px] font-bold text-brand-navy">{test.title}</h3>
                  <p className="mt-1 text-[13px] text-brand-slate">
                    {test.subjectName}
                    {test.topic ? ` · ${test.topic}` : ''} · {test.totalMarks} marks
                  </p>
                  <Link
                    href={`/student/tests/${test.attemptId}`}
                    className={`${SECONDARY_BUTTON} mt-3`}
                  >
                    Continue test
                  </Link>
                </li>
              ))}
            </ul>
          </DashboardSection>
        ) : null}

        <DashboardSection
          title="Available tests"
          count={available.length}
          emptyTitle="No tests right now"
          emptyBody="When a tutor publishes a test for your grade it will appear here."
        >
          <ul className="space-y-3">
            {available.map((test) => (
              <li
                key={test.testId}
                className="rounded-2xl border border-brand-blue-100 bg-white p-4 sm:p-5"
              >
                <h3 className="text-[16px] font-bold text-brand-navy">{test.title}</h3>

                <p className="mt-1 text-[13px] text-brand-slate">
                  {test.subjectName}
                  {test.topic ? ` · ${test.topic}` : ''} · {test.totalMarks} marks ·{' '}
                  {test.durationMinutes} minutes · {test.difficulty}
                </p>

                {test.description ? (
                  <p className="mt-2 text-[14px] leading-relaxed text-brand-slate">
                    {test.description}
                  </p>
                ) : null}

                <div className="mt-4">
                  <StartTestButton
                    testId={test.testId}
                    durationMinutes={test.durationMinutes}
                  />
                </div>
              </li>
            ))}
          </ul>
        </DashboardSection>

        <DashboardSection
          title="Completed"
          count={done.length}
          emptyTitle="Nothing completed yet"
          emptyBody="Once you finish a test your mark and feedback will appear here."
        >
          <ul className="space-y-3">
            {done.map((test) => (
              <li
                key={test.testId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-blue-100 bg-white p-4"
              >
                <div className="min-w-0">
                  <h3 className="flex items-center gap-2 text-[16px] font-bold text-brand-navy">
                    <CheckCircle2
                      className="size-4 shrink-0 text-green-600"
                      aria-hidden="true"
                    />
                    {test.title}
                  </h3>
                  <p className="mt-1 text-[13px] text-brand-slate">
                    {test.subjectName} · {test.percentage}%
                  </p>
                </div>

                {test.attemptId ? (
                  <Link
                    href={`/student/results/${test.attemptId}`}
                    className={SECONDARY_BUTTON}
                  >
                    See result
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </DashboardSection>
      </div>
    </section>
  );
}
