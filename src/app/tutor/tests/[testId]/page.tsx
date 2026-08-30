import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { getTestForTutor } from '@/services/test.service';
import TestReviewer from '@/components/tutor/TestReviewer';
import { TestStatusBadge } from '@/app/tutor/tests/page';
import { SECONDARY_BUTTON } from '@/components/booking/ui';
import { STAFF_ROLES } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

/**
 * Review one test before publishing (brief section 3).
 *
 * `getTestForTutor` scopes on createdBy, so a tutor opening someone else's
 * test id gets a 404 rather than a paper with its answers.
 */
export default async function TutorTestPage(props: {
  params: Promise<{ testId: string }>;
}) {
  const user = await requireRole(STAFF_ROLES, '/tutor/tests');

  // params is a Promise in Next 16.
  const { testId } = await props.params;

  const test = await getTestForTutor(user, testId);

  if (!test) notFound();

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Link
          href="/tutor/tests"
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to assessments
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            {test.title}
          </h1>
          <TestStatusBadge status={test.status} />
        </div>

        <p className="mt-2 text-[15px] text-brand-slate">
          {test.subjectName} · {test.gradeName}
          {test.topic ? ` · ${test.topic}` : ''} · {test.difficulty}
        </p>

        {test.isAiGenerated && test.status === 'draft' ? (
          <div className="mt-5 rounded-2xl bg-brand-amber/15 p-4">
            <p className="text-[14px] leading-relaxed text-brand-navy">
              <span className="font-bold">This test was drafted by AI.</span> Check
              every question, answer and mark allocation before you publish it.
              AI-generated content should always be verified against your
              materials.
            </p>
          </div>
        ) : null}

        {test.status !== 'draft' ? (
          <Link
            href={`/tutor/tests/${test.testId}/submissions`}
            className={`${SECONDARY_BUTTON} mt-5`}
          >
            View submissions and marking
          </Link>
        ) : null}

        <div className="mt-6">
          <TestReviewer
            testId={test.testId}
            initialTitle={test.title}
            initialDescription={test.description}
            initialTopic={test.topic}
            initialDuration={test.durationMinutes}
            initialAvailableFrom={test.availableFrom}
            initialAvailableUntil={test.availableUntil}
            isDraft={test.status === 'draft'}
            initialQuestions={test.questions.map((question) => ({
              questionId: question.questionId,
              type: question.type,
              prompt: question.prompt,
              options: question.options,
              correctAnswer: question.correctAnswer,
              explanation: question.explanation,
              rubric: question.rubric,
              marks: question.marks,
            }))}
          />
        </div>
      </div>
    </section>
  );
}
