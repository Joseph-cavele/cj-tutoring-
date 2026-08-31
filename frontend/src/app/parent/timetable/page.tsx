import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { getTimetable } from '@/services/timetable.service';
import TimetableList from '@/components/timetable/TimetableList';

export const dynamic = 'force-dynamic';

/**
 * The test timetable (brief section 23), as a parent sees it, for their linked children's grades.
 *
 * The page passes only the session; which tests come back is decided entirely
 * by the service, from this user's own profile. No grade or student id is
 * accepted here, so the three copies of this page cannot disagree about who
 * sees what.
 */
export default async function ParentTimetablePage() {
  const user = await requireRole('parent', '/parent/timetable');

  const days = await getTimetable({ user });

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Link
          href="/parent/dashboard"
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to dashboard
        </Link>

        <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
          Test timetable
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-brand-slate">
          Tests coming up for your children, with the date and time each one opens.
        </p>

        <div className="mt-8">
          <TimetableList
            days={days}
            showGrade={true}
            emptyTitle="No tests scheduled"
            emptyBody="When a test is scheduled for one of your children, it will appear here."
          />
        </div>
      </div>
    </section>
  );
}
