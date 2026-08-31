import Link from 'next/link';
import {
  BookOpen,
  CalendarClock,
  CalendarPlus,
  GraduationCap,
  LineChart,
  Sparkles,
} from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { getLearnerDashboard } from '@/services/booking-dashboard.service';
import BookingCard from '@/components/booking/BookingCard';
import BookingOwnerActions from '@/components/booking/BookingOwnerActions';
import LessonMeetingLink from '@/components/booking/LessonMeetingLink';
import DashboardSection from '@/components/dashboard/DashboardSection';
import QuickAccessTile from '@/components/dashboard/QuickAccessTile';
import { PRIMARY_BUTTON } from '@/components/booking/ui';
import { BOOKING_ROUTE } from '@/lib/routes';

export const dynamic = 'force-dynamic';

/**
 * Student dashboard (brief section 10).
 *
 * Phone-shaped: a greeting panel that carries the counts, then a grid of large
 * tap targets for the sections a student actually has, then their lessons.
 * Every tile points at a route that exists - a tile that goes nowhere is worse
 * than no tile - so there is no Fees, Attendance or Library entry until those
 * pages are built.
 *
 * Bookings are read through the scoped service, so a student sees their own
 * lessons and nothing else regardless of what the page asks for.
 */
export default async function StudentDashboard() {
  const user = await requireRole('student', '/student/dashboard');
  const firstName = user.name?.split(' ')[0] ?? 'there';

  const { upcoming, past, awaitingPayment, stats } = await getLearnerDashboard(user);

  return (
    <section className="bg-brand-cream py-6 lg:py-10">
      <div className="mx-auto max-w-5xl space-y-5 px-4 sm:px-6 lg:px-8">
        {/* Greeting panel. The counts live inside it so a phone screen leads
            with what the student came to find out, not with a stats strip. */}
        <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-blue to-brand-blue-dark p-5 text-white shadow-[var(--shadow-float)] sm:p-7">
          <p className="text-[13px] font-bold tracking-wider text-white/70 uppercase">
            Student portal
          </p>
          <h1 className="mt-1 text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl">
            Hello, {firstName}
            <span aria-hidden="true"> 👋</span>
          </h1>
          <p className="mt-1.5 text-[15px] text-white/80">
            Your lessons, your work and your results.
          </p>

          <dl className="mt-5 grid grid-cols-3 gap-2 sm:max-w-md">
            <HeroStat label="Confirmed" value={stats.upcomingCount} />
            <HeroStat label="Awaiting tutor" value={stats.pendingCount} />
            <HeroStat label="Completed" value={stats.completedCount} />
          </dl>

          <Link
            href={BOOKING_ROUTE}
            className="mt-5 inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-6 text-[15px] font-semibold text-brand-blue transition-colors hover:bg-brand-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <CalendarPlus className="size-4" aria-hidden="true" />
            Book a lesson
          </Link>
        </header>

        {/* Only shown when there is money outstanding: an unpaid lesson never
            reaches the tutor, so the student needs to know before they wait. */}
        {awaitingPayment.length > 0 ? (
          <p className="rounded-2xl bg-brand-amber/15 px-4 py-3 text-[14px] font-medium text-brand-amber-text">
            {awaitingPayment.length === 1
              ? 'One lesson is still waiting for payment. Your tutor only sees it once it is paid.'
              : `${awaitingPayment.length} lessons are still waiting for payment. Your tutor only sees them once they are paid.`}
          </p>
        ) : null}

        <nav aria-label="Student sections">
          <h2 className="text-[18px] font-extrabold text-brand-navy">Quick access</h2>

          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <QuickAccessTile
              href={BOOKING_ROUTE}
              icon={<CalendarPlus className="size-5" />}
              title="Book a lesson"
              body="Pick a tutor, a subject and a time."
              tone="blue"
            />
            <QuickAccessTile
              href="/student/tests"
              icon={<GraduationCap className="size-5" />}
              title="Tests"
              body="Take a test and see your marks."
              tone="amber"
            />
            <QuickAccessTile
              href="/student/timetable"
              icon={<CalendarClock className="size-5" />}
              title="Test timetable"
              body="When your next tests are."
              tone="blue"
            />
            <QuickAccessTile
              href="/student/performance"
              icon={<LineChart className="size-5" />}
              title="Performance"
              body="How you are doing by subject."
              tone="blue"
            />
            <QuickAccessTile
              href="/student/materials"
              icon={<BookOpen className="size-5" />}
              title="Materials"
              body="Notes, worksheets and past papers."
              tone="amber"
            />
          </div>
        </nav>

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

        <p className="flex items-start gap-2 text-[14px] text-brand-slate">
          <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Need help with a problem right now? The study assistant is the button in
          the corner of every page.
        </p>
      </div>
    </section>
  );
}

/** One count on the greeting panel, sized for a three-across phone row. */
function HeroStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/12 px-3 py-2.5">
      <dt className="text-[11px] leading-tight font-semibold tracking-wide text-white/70 uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-xl font-extrabold">{value}</dd>
    </div>
  );
}
