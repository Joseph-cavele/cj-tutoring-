import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { getMyPerformance } from '@/services/performance.service';
import PerformancePanel from '@/components/dashboard/PerformancePanel';

export const dynamic = 'force-dynamic';

/** The student's own performance (brief section 10). Scoped by their session. */
export default async function StudentPerformancePage() {
  const user = await requireRole('student', '/student/performance');
  const performance = await getMyPerformance(user);

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-4xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div>
          <Link
            href="/student/dashboard"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to dashboard
          </Link>

          <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            My performance
          </h1>
          <p className="mt-2 text-[15px] text-brand-slate">
            How you are doing by subject and by topic.
          </p>
        </div>

        {performance ? (
          <PerformancePanel performance={performance} linkResults />
        ) : (
          <p className="rounded-2xl bg-white p-6 text-[15px] text-brand-slate shadow-[var(--shadow-soft)]">
            Your student profile is not set up yet. Please contact the office.
          </p>
        )}
      </div>
    </section>
  );
}
