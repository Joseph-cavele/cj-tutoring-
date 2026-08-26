import { notFound, redirect } from 'next/navigation';

import { requireRole } from '@/lib/auth/guard';
import { AttemptError, getAttemptPaper } from '@/services/attempt.service';
import TestPlayer from '@/components/student/TestPlayer';

export const dynamic = 'force-dynamic';

/**
 * Sitting a test.
 *
 * The paper is fetched with the answer key deliberately not selected, so the
 * page's own props - which end up in the HTML sent to the browser - cannot
 * contain a correct answer (brief section 6).
 */
export default async function TakeTestPage(props: {
  params: Promise<{ attemptId: string }>;
}) {
  const user = await requireRole('student', '/student/tests');

  // params is a Promise in Next 16.
  const { attemptId } = await props.params;

  let paper;

  try {
    paper = await getAttemptPaper(user, attemptId);
  } catch (error) {
    if (error instanceof AttemptError) notFound();
    throw error;
  }

  // Already finished: the result is what they want, not the paper again.
  if (paper.status !== 'in_progress') {
    redirect(`/student/results/${attemptId}`);
  }

  return (
    <section className="bg-brand-cream py-6 lg:py-10">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <TestPlayer
          attemptId={paper.attemptId}
          title={paper.test.title}
          description={paper.test.description}
          totalMarks={paper.test.totalMarks}
          expiresAt={paper.expiresAt}
          questions={paper.questions}
          savedAnswers={paper.savedAnswers}
        />
      </div>
    </section>
  );
}
