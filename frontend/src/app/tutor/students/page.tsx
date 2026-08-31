import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { getStudentsForTutor } from '@/services/performance.service';
import PerformancePanel from '@/components/dashboard/PerformancePanel';
import DashboardSection from '@/components/dashboard/DashboardSection';
import { STAFF_ROLES } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

/**
 * Student performance for a tutor (brief section 12).
 *
 * Limited to students who have sat this tutor's tests - the service filters on
 * tests they created, so a tutor cannot browse the whole school. Weakest
 * averages come first, because those are the ones needing attention.
 */
export default async function TutorStudentsPage() {
  const user = await requireRole(STAFF_ROLES, '/tutor/students');
  const students = await getStudentsForTutor(user);

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div>
          <Link
            href="/tutor/dashboard"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to dashboard
          </Link>

          <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            Student performance
          </h1>
          <p className="mt-2 text-[15px] text-brand-slate">
            How students have done on the tests you set. Weakest averages first.
          </p>
        </div>

        <DashboardSection
          title="Students"
          count={students.length}
          emptyTitle="No results yet"
          emptyBody="Once a student completes one of your tests, their performance appears here."
        >
          <div className="space-y-8">
            {students.map((student) => (
              <article key={student.studentId}>
                <h2 className="text-xl font-extrabold text-brand-navy">
                  {student.studentName}
                </h2>
                <div className="mt-3">
                  <PerformancePanel performance={student} />
                </div>
              </article>
            ))}
          </div>
        </DashboardSection>
      </div>
    </section>
  );
}
