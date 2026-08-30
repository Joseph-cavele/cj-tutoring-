import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { getTimetable } from '@/services/timetable.service';
import TimetableList from '@/components/timetable/TimetableList';

export const dynamic = 'force-dynamic';

/**
 * The test timetable (brief section 23), as the tutor sees it.
 *
 * The page passes only the session; which tests come back is decided entirely
 * by the service, from this user's own profile. No grade or student id is
 * accepted here, so the three copies of this page cannot disagree about who
 * sees what.
 */
export default async function TutorTimetablePage() {
  const user = await requireRole(STAFF_ROLES, '/tutor/timetable');

  const days = await getTimetable({ user });

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Link
          href="/tutor/dashboard"
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to dashboard
        </Link>

        <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
          Test timetable
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-brand-slate">
          Every test with a scheduled sitting, drafts included. Set a sitting on a test from its own page.
        </p>

        <div className="mt-8">
          <TimetableList
            days={days}
            showGrade={true}
            emptyTitle="Nothing scheduled"
            emptyBody="Open a test and set an opening time to put it on the timetable."
          />
        </div>
      </div>
    </section>
  );
}
