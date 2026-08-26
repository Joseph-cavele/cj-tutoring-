import Link from 'next/link';
import { BookOpen, CalendarPlus, GraduationCap, LineChart } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { getLearnerDashboard } from '@/services/booking-dashboard.service';
import BookingCard from '@/components/booking/BookingCard';
import BookingOwnerActions from '@/components/booking/BookingOwnerActions';
import LessonMeetingLink from '@/components/booking/LessonMeetingLink';
import DashboardSection, { StatTile } from '@/components/dashboard/DashboardSection';
import { PRIMARY_BUTTON } from '@/components/booking/ui';
import { BOOKING_ROUTE } from '@/lib/routes';

export const dynamic = 'force-dynamic';

/**
 * Student dashboard (brief section 10).
 *
 * Bookings are read through the scoped service, so a student sees their own
 * lessons and nothing else regardless of what the page asks for.
 */
export default async function StudentDashboard() {
  const user = await requireRole('student', '/student/dashboard');
  const firstName = user.name?.split(' ')[0] ?? 'there';

  const { upcoming, past, stats } = await getLearnerDashboard(user);

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] font-bold tracking-wider text-brand-slate uppercase">
              Student
            </p>
            <h1 className="mt-1 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
              Hello, {firstName}
            </h1>
            <p className="mt-2 text-[15px] text-brand-slate">
              Your lessons, your work and your results.
            </p>
          </div>

          {/* The main action on this page, kept large for phones. */}
          <Link href={BOOKING_ROUTE} className={PRIMARY_BUTTON}>
            <CalendarPlus className="size-4" aria-hidden="true" />
            Book a lesson
          </Link>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Confirmed" value={stats.upcomingCount} detail="lessons ahead" />
          <StatTile
            label="Awaiting tutor"
            value={stats.pendingCount}
            detail="requests"
            highlight={stats.pendingCount > 0}
          />
          <StatTile label="Completed" value={stats.completedCount} detail="lessons done" />
        </div>

        <DashboardSection
          title="Upcoming lessons"
          description="Confirmed lessons and requests still waiting on a tutor."
          count={upcoming.length}
          emptyTitle="No lessons booked"
          emptyBody="Book a lesson and it will appear here. You will see the status change as soon as your tutor responds."
          action={
            <Link href={BOOKING_ROUTE} className={PRIMARY_BUTTON}>
              Book a lesson
            </Link>
          }
        >
          <ul className="space-y-3">
            {upcoming.map((booking) => (
              <li key={booking.id}>
                <BookingCard
                  booking={booking}
                  perspective="student"
                  showPayment
                  actions={
                    <div className="space-y-3">
                      <LessonMeetingLink user={user} bookingId={booking.id} />
                      <BookingOwnerActions booking={booking} />
                    </div>
                  }
                />
              </li>
            ))}
          </ul>
        </DashboardSection>

        <DashboardSection
          title="Previous lessons"
          count={past.length}
          emptyTitle="Nothing yet"
          emptyBody="Lessons move here once the date has passed, along with whether they went ahead."
        >
          <ul className="space-y-3">
            {past.map((booking) => (
              <li key={booking.id}>
                <BookingCard booking={booking} perspective="student" />
              </li>
            ))}
          </ul>
        </DashboardSection>

        <p className="text-[14px] text-brand-slate">
          Need help with a problem right now? The study assistant is the button
          in the corner of every page.
        </p>

        <nav aria-label="Student sections" className="grid gap-3 sm:grid-cols-2">
          <SectionLink
            href="/student/tests"
            icon={<GraduationCap className="size-5" />}
            title="Tests"
            body="Take a test your tutor has set, and see your marks."
          />
          <SectionLink
            href="/student/performance"
            icon={<LineChart className="size-5" />}
            title="Performance"
            body="How you are doing by subject and by topic."
          />
          <SectionLink
            href="/student/materials"
            icon={<BookOpen className="size-5" />}
            title="Study materials"
            body="Notes, worksheets and past papers for your grade."
          />
        </nav>
      </div>
    </section>
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
