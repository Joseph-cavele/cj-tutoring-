import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { getAllTutorWeeks, type TutorWeek } from '@/services/availability.service';
import { WEEKDAYS } from '@/lib/booking/constants';
import { MODE_LABELS } from '@/types/booking';
import DashboardSection, { StatTile } from '@/components/dashboard/DashboardSection';

export const dynamic = 'force-dynamic';

/**
 * Coverage across the week (brief section 12).
 *
 * Read-only on purpose: a tutor owns their own diary, and an admin editing it
 * behind their back would produce lessons the tutor did not agree to. This is
 * for spotting gaps - a day nobody covers, an approved tutor who never set any
 * hours - and then having a conversation.
 */
export default async function AdminAvailabilityPage() {
  await requireRole('admin', '/admin/availability');

  const weeks = await getAllTutorWeeks();

  // Coverage per weekday, counting only tutors who can actually be booked.
  const bookable = weeks.filter((week) => week.isVerified && week.isActive);

  const coverage = WEEKDAYS.map((day) => ({
    ...day,
    tutors: bookable.filter((week) =>
      week.days.some(
        (entry) =>
          entry.dayOfWeek === day.value &&
          entry.windows.some((window) => window.isActive)
      )
    ).length,
  }));

  const withoutHours = bookable.filter((week) => week.totalHours === 0);
  const uncovered = coverage.filter((day) => day.tutors === 0);

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div>
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to dashboard
          </Link>

          <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            Availability
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-brand-slate">
            Which tutors are open when. Tutors set their own hours, so this is a
            view rather than an editor.
          </p>
        </div>

        <section aria-label="Coverage by day">
          <h2 className="text-[18px] font-extrabold text-brand-navy">Coverage</h2>
          <p className="mt-1 text-[14px] text-brand-slate">
            Bookable tutors open on each day.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {coverage.map((day) => (
              <StatTile
                key={day.value}
                label={day.label.slice(0, 3)}
                value={day.tutors}
                detail={day.tutors === 1 ? 'tutor' : 'tutors'}
                highlight={day.tutors === 0}
              />
            ))}
          </div>
        </section>

        {uncovered.length > 0 || withoutHours.length > 0 ? (
          <div className="rounded-2xl bg-brand-amber/15 p-5">
            <h2 className="text-[16px] font-bold text-brand-amber-text">Gaps</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-brand-navy">
              {uncovered.length > 0 ? (
                <li>
                  Nobody is available on{' '}
                  {uncovered.map((day) => day.label).join(', ')}. Students cannot
                  book those days at all.
                </li>
              ) : null}
              {withoutHours.length > 0 ? (
                <li>
                  {withoutHours.map((week) => week.name).join(', ')}{' '}
                  {withoutHours.length === 1 ? 'is' : 'are'} approved but{' '}
                  {withoutHours.length === 1 ? 'has' : 'have'} set no hours, so{' '}
                  {withoutHours.length === 1 ? 'they cannot' : 'they cannot'} be
                  booked.
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        <DashboardSection
          title="Tutors"
          description="Fewest hours first, so gaps surface at the top."
          count={weeks.length}
          emptyTitle="No tutors yet"
          emptyBody="Once tutors are approved and set their hours, their weeks appear here."
        >
          <ul className="space-y-3">
            {weeks.map((week) => (
              <li key={week.tutorId}>
                <TutorWeekCard week={week} />
              </li>
            ))}
          </ul>
        </DashboardSection>
      </div>
    </section>
  );
}

function TutorWeekCard({ week }: { week: TutorWeek }) {
  const daysWithHours = week.days.filter((day) => day.windows.length > 0);

  return (
    <article className="rounded-2xl border border-brand-blue-100 bg-white p-4 sm:p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="flex flex-wrap items-center gap-2 text-[17px] font-bold text-brand-navy">
          {week.name}
          {!week.isVerified ? (
            <span className="rounded-full bg-brand-amber/15 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-brand-amber-text uppercase">
              Not approved
            </span>
          ) : !week.isActive ? (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-red-700 uppercase">
              Deactivated
            </span>
          ) : null}
        </h3>

        <p className="text-[13px] text-brand-slate">
          {week.totalHours} hour{week.totalHours === 1 ? '' : 's'} open ·{' '}
          {week.bookedSlots} upcoming lesson{week.bookedSlots === 1 ? '' : 's'}
        </p>
      </header>

      {daysWithHours.length === 0 ? (
        <p className="mt-3 rounded-xl bg-brand-blue-50/60 p-3 text-[14px] text-brand-slate">
          No hours set. Students cannot book this tutor.
        </p>
      ) : (
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {daysWithHours.map((day) => (
            <div key={day.dayOfWeek} className="flex gap-3 rounded-xl bg-brand-blue-50/50 p-3">
              <dt className="w-20 shrink-0 text-[13px] font-bold text-brand-navy">
                {WEEKDAYS.find((entry) => entry.value === day.dayOfWeek)?.label}
              </dt>
              <dd className="min-w-0 flex-1 space-y-1">
                {day.windows.map((window, index) => (
                  <p
                    key={index}
                    className={`text-[13px] ${
                      window.isActive ? 'text-brand-navy' : 'text-brand-slate line-through'
                    }`}
                  >
                    {window.startTime}&ndash;{window.endTime} ·{' '}
                    {window.slotMinutes} min · {MODE_LABELS[window.teachingMode]}
                  </p>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
