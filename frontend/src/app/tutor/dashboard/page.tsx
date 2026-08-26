import Link from 'next/link';
import { BookOpen, CalendarClock, GraduationCap, Users } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { getTutorDashboard } from '@/services/booking-dashboard.service';
import {
  bookabilityBlockers,
  getMyTutorProfile,
  hasAvailability,
} from '@/services/tutor.service';
import BookingCard from '@/components/booking/BookingCard';
import LessonMeetingLink from '@/components/booking/LessonMeetingLink';
import { TutorDecision, CancelBooking } from '@/components/booking/BookingActions';
import DashboardSection, { StatTile } from '@/components/dashboard/DashboardSection';
import { SECONDARY_BUTTON } from '@/components/booking/ui';

export const dynamic = 'force-dynamic';

/**
 * Tutor dashboard (brief section 9).
 *
 * Everything shown is scoped to the signed-in tutor by the service layer, so
 * the page never filters by an id taken from the URL or the session's own
 * claims about which bookings are theirs.
 */
export default async function TutorDashboard() {
  // Server-side check, not just the proxy: authorization is enforced where
  // the work happens (brief section 2).
  const user = await requireRole('tutor', '/tutor/dashboard');
  const firstName = user.name?.split(' ')[0] ?? 'there';

  const [profile, { pending, today, upcoming, stats }] = await Promise.all([
    getMyTutorProfile(user),
    getTutorDashboard(user),
  ]);

  // Everything standing between this tutor and a bookable listing, so an
  // empty dashboard always comes with a reason.
  const blockers = profile ? bookabilityBlockers(profile) : [];

  if (profile && !(await hasAvailability(profile.tutorId))) {
    blockers.push('No availability set, so there are no times to book');
  }

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
        <header>
          <p className="text-[13px] font-bold tracking-wider text-brand-slate uppercase">
            Tutor
          </p>
          <h1 className="mt-1 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            Hello, {firstName}
          </h1>
          <p className="mt-2 text-[15px] text-brand-slate">
            Your lessons, your requests and your diary.
          </p>
        </header>

        {/* A tutor who is not fully set up cannot receive bookings at all, so
            say exactly why rather than showing four empty sections. */}
        {blockers.length > 0 ? <NotBookableYet blockers={blockers} /> : null}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Requests"
            value={stats.pendingCount}
            detail="waiting on you"
            highlight={stats.pendingCount > 0}
          />
          <StatTile label="Today" value={stats.todayCount} detail="lessons" />
          <StatTile label="Upcoming" value={stats.upcomingCount} detail="confirmed" />
          <StatTile label="Students" value={stats.studentCount} detail="on your books" />
        </div>

        <DashboardSection
          title="Pending booking requests"
          description="Accept or decline. The student sees your answer straight away."
          count={pending.length}
          emptyTitle="No requests waiting"
          emptyBody="New booking requests appear here as soon as a student or parent books and pays for a lesson with you."
        >
          <ul className="space-y-3">
            {pending.map((booking) => (
              <li key={booking.id}>
                <BookingCard
                  booking={booking}
                  perspective="tutor"
                  actions={<TutorDecision bookingId={booking.id} />}
                />
              </li>
            ))}
          </ul>
        </DashboardSection>

        <DashboardSection
          title="Today&rsquo;s lessons"
          count={today.length}
          emptyTitle="Nothing on today"
          emptyBody="Confirmed lessons for today will show here with everything you need to run them."
        >
          <ul className="space-y-3">
            {today.map((booking) => (
              <li key={booking.id}>
                <BookingCard
                  booking={booking}
                  perspective="tutor"
                  actions={<LessonMeetingLink user={user} bookingId={booking.id} />}
                />
              </li>
            ))}
          </ul>
        </DashboardSection>

        <DashboardSection
          title="Upcoming bookings"
          count={upcoming.length}
          emptyTitle="Nothing scheduled yet"
          emptyBody="Once you accept a request it moves here until the day of the lesson."
          action={
            <Link href="/tutor/availability" className={SECONDARY_BUTTON}>
              <CalendarClock className="size-4" aria-hidden="true" />
              Set availability
            </Link>
          }
        >
          <ul className="space-y-3">
            {upcoming.map((booking) => (
              <li key={booking.id}>
                <BookingCard
                  booking={booking}
                  perspective="tutor"
                  actions={
                    <div className="space-y-3">
                      <LessonMeetingLink user={user} bookingId={booking.id} />
                      <CancelBooking
                        bookingId={booking.id}
                        label="Withdraw from this lesson"
                      />
                    </div>
                  }
                />
              </li>
            ))}
          </ul>
        </DashboardSection>

        <nav aria-label="Tutor sections" className="grid gap-3 sm:grid-cols-2">
          <SectionLink
            href="/tutor/availability"
            icon={<CalendarClock className="size-5" />}
            title="Availability"
            body="Set the days and hours you teach, online or in person."
          />
          <SectionLink
            href="/tutor/students"
            icon={<Users className="size-5" />}
            title="Students"
            body="The students currently on your books."
          />
          <SectionLink
            href="/tutor/tests"
            icon={<GraduationCap className="size-5" />}
            title="Assessments"
            body="Create tests, mark submissions and review results."
          />
          <SectionLink
            href="/tutor/materials"
            icon={<BookOpen className="size-5" />}
            title="Study materials"
            body="Upload notes, worksheets and past papers for a grade."
          />
          <SectionLink
            href="/tutor/profile"
            icon={<Users className="size-5" />}
            title="Profile"
            body="Your bio, subjects and hourly rate."
          />
        </nav>
      </div>
    </section>
  );
}

function NotBookableYet({ blockers }: { blockers: string[] }) {
  return (
    <div className="rounded-2xl bg-brand-amber/15 p-5">
      <h2 className="text-[16px] font-bold text-brand-amber-text">
        Students cannot book you yet
      </h2>

      <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-brand-navy">
        {blockers.map((blocker) => (
          <li key={blocker}>{blocker}</li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/tutor/profile" className={SECONDARY_BUTTON}>
          Complete my profile
        </Link>
        <Link href="/tutor/availability" className={SECONDARY_BUTTON}>
          Set availability
        </Link>
      </div>
    </div>
  );
}

function SectionLink({
  href,
  icon,
  title,
  body,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="flex gap-3 rounded-2xl bg-white p-5 shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-float)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-brand-blue">
        {icon}
      </span>
      <span>
        <span className="block text-[16px] font-bold text-brand-navy">{title}</span>
        <span className="mt-1 block text-[14px] leading-relaxed text-brand-slate">
          {body}
        </span>
      </span>
    </Link>
  );
}
