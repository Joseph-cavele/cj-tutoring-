import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { tutorProfileFor } from '@/lib/booking/access';
import { getTutorAvailability } from '@/services/availability.service';
import AvailabilityEditor from '@/components/tutor/AvailabilityEditor';

export const dynamic = 'force-dynamic';

/**
 * Where a tutor sets the hours they teach (brief section 7).
 *
 * The tutor is resolved from the session, so this page can only ever load and
 * save that tutor's own windows.
 */
export default async function TutorAvailabilityPage() {
  const user = await requireRole('tutor', '/tutor/availability');
  const profile = await tutorProfileFor(user.id);

  const windows = profile ? await getTutorAvailability(profile._id.toString()) : [];

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <Link
          href="/tutor/dashboard"
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to dashboard
        </Link>

        <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
          My availability
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-brand-slate">
          Students can only book inside these windows. Each window is cut into
          lessons of the length you choose, and a time disappears from the
          booking page as soon as somebody takes it.
        </p>

        {!profile ? (
          <p className="mt-8 rounded-2xl bg-white p-6 text-[15px] text-brand-slate shadow-[var(--shadow-soft)]">
            Your tutor profile is not set up yet. Please contact the office.
          </p>
        ) : (
          <div className="mt-8">
            <AvailabilityEditor
              initialWindows={windows.map((window) => ({
                dayOfWeek: window.dayOfWeek,
                startTime: window.startTime,
                endTime: window.endTime,
                slotMinutes: window.slotMinutes,
                teachingMode: window.teachingMode,
                isActive: window.isActive,
              }))}
            />
          </div>
        )}
      </div>
    </section>
  );
}
