import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { connectDB } from '@/lib/mongodb';
import { Grade, Subject } from '@/models';
import { listTutorTests } from '@/services/test.service';
import { isAiConfigured } from '@/lib/ai/assessment';
import TestGenerator from '@/components/tutor/TestGenerator';
import DashboardSection, { StatTile } from '@/components/dashboard/DashboardSection';

export const dynamic = 'force-dynamic';

/**
 * The tutor's assessments (brief section 12).
 *
 * Only tests this tutor created are listed - the service scopes on createdBy,
 * so there is nothing here that could show another tutor's paper.
 */
export default async function TutorTestsPage() {
  const user = await requireRole('tutor', '/tutor/tests');

  await connectDB();

  const [tests, subjects, grades] = await Promise.all([
    listTutorTests(user),
    Subject.find({ isActive: true }).select('name').sort({ name: 1 }).lean(),
    Grade.find({ isActive: true }).select('name level').sort({ level: 1 }).lean(),
  ]);

  const drafts = tests.filter((test) => test.status === 'draft');
  const published = tests.filter((test) => test.status === 'published');
  const closed = tests.filter((test) => test.status === 'closed');
  const awaitingMarking = tests.reduce(
    (sum, test) => sum + (test.submissionCount - test.markedCount),
    0
  );

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div>
          <Link
            href="/tutor/dashboard"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to dashboard
          </Link>

          <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            Assessments
          </h1>
          <p className="mt-2 text-[15px] text-brand-slate">
            Create tests, review them, and publish when you are happy.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Drafts" value={drafts.length} detail="awaiting review" />
          <StatTile label="Published" value={published.length} detail="live for students" />
          <StatTile label="Closed" value={closed.length} detail="no longer open" />
          <StatTile
            label="To review"
            value={awaitingMarking}
            detail="submissions"
            highlight={awaitingMarking > 0}
          />
        </div>

        {isAiConfigured() ? (
          <TestGenerator
            subjects={subjects.map((subject) => ({
              subjectId: subject._id.toString(),
              name: subject.name,
            }))}
            grades={grades.map((grade) => ({
              gradeId: grade._id.toString(),
              name: grade.name,
            }))}
          />
        ) : (
          <div className="rounded-3xl bg-white p-6 shadow-[var(--shadow-soft)]">
            <h2 className="text-[17px] font-bold text-brand-navy">
              AI test generation is not switched on
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-brand-slate">
              Set <code className="rounded bg-brand-blue-50 px-1.5 py-0.5">AI_API_KEY</code>{' '}
              in the environment to generate tests automatically.
            </p>
          </div>
        )}

        <DashboardSection
          title="Your tests"
          count={tests.length}
          emptyTitle="No tests yet"
          emptyBody="Generate one above, review the questions, then publish it to your students."
        >
          <ul className="space-y-3">
            {tests.map((test) => (
              <li key={test.testId}>
                <Link
                  href={`/tutor/tests/${test.testId}`}
                  className="flex gap-3 rounded-2xl border border-brand-blue-100 bg-white p-4 transition-colors hover:border-brand-blue hover:bg-brand-blue-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
                >
                  <FileText
                    className="mt-0.5 size-5 shrink-0 text-brand-blue"
                    aria-hidden="true"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-[16px] font-bold text-brand-navy">
                        {test.title}
                      </span>
                      <TestStatusBadge status={test.status} />
                      {test.isAiGenerated ? (
                        <span className="rounded-full bg-brand-blue-50 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-brand-blue uppercase">
                          AI
                        </span>
                      ) : null}
                    </span>

                    <span className="mt-1 block text-[13px] text-brand-slate">
                      {test.subjectName} · {test.gradeName}
                      {test.topic ? ` · ${test.topic}` : ''} · {test.totalMarks} marks ·{' '}
                      {test.durationMinutes} min
                    </span>

                    <span className="mt-1 block text-[13px] text-brand-slate">
                      {test.submissionCount === 0
                        ? 'No submissions yet'
                        : `${test.submissionCount} submission${
                            test.submissionCount === 1 ? '' : 's'
                          }, ${test.markedCount} marked`}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </DashboardSection>
      </div>
    </section>
  );
}

export function TestStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: 'bg-brand-amber/15 text-brand-amber-text',
    published: 'bg-green-100 text-green-800',
    closed: 'bg-brand-blue-50 text-brand-slate',
  };

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase ${
        styles[status] ?? styles.closed
      }`}
    >
      {status}
    </span>
  );
}
