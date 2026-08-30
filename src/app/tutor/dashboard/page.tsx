import Link from 'next/link';
import {
  BookOpen,
  CalendarClock,
  CreditCard,
  GraduationCap,
  KeyRound,
  Receipt,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { getTutorDashboard } from '@/services/booking-dashboard.service';
import {
  bookabilityBlockers,
  getMyTutorProfile,
  hasAvailability,
} from '@/services/tutor.service';
import { listApplications } from '@/services/application.service';
import { getPaymentTotals } from '@/services/payment-admin.service';
import { formatPrice } from '@/services/pricing.service';
import BookingCard from '@/components/booking/BookingCard';
import LessonMeetingLink from '@/components/booking/LessonMeetingLink';
import { TutorDecision, CancelBooking } from '@/components/booking/BookingActions';
import ApplicationDecision from '@/components/tutor/ApplicationDecision';
import DashboardSection, { StatTile } from '@/components/dashboard/DashboardSection';
import { SECONDARY_BUTTON } from '@/components/booking/ui';

export const dynamic = 'force-dynamic';

/**
 * Tutor dashboard (brief section 9).
 *
 * CJ Private Tutoring is run by one tutor who is also the owner, so this is
 * both a teaching screen and the business screen: the day's lessons and the
 * requests to answer, then the money, the applications to let people in, and
 * the way through to every admin section.
 *
 * Lessons are scoped to the signed-in tutor by the service layer, so the page
 * never filters by an id taken from the URL or the session's own claims about
 * which bookings are theirs. The money and the applications are business-wide,
 * which is what the owner needs to see - they are read only after
 * `requireRole` has confirmed this is a staff account.
 */
export default async function TutorDashboard() {
  // Server-side check, not just the proxy: authorization is enforced where
  // the work happens (brief section 2).
  const user = await requireRole('tutor', '/tutor/dashboard');
  const firstName = user.name?.split(' ')[0] ?? 'there';

  const [profile, { pending, today, upcoming, stats }, applications, money] =
    await Promise.all([
      getMyTutorProfile(user),
      getTutorDashboard(user),
      listApplications('pending'),
      getPaymentTotals(),
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
            Your lessons, your requests, your diary and how the business is doing.
          </p>
        </header>

        {/* A tutor who is not fully set up cannot receive bookings at all, so
            say exactly why rather than showing four empty sections. */}
        {blockers.length > 0 ? <NotBookableYet blockers={blockers} /> : null}

        {/* Two strips of three: what needs answering today, then how the
            business stands. Three columns each so nothing is orphaned on a
            wide screen, and one per row on a phone. */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile
            label="Requests"
            value={stats.pendingCount}
            detail="waiting on you"
            highlight={stats.pendingCount > 0}
          />
          <StatTile label="Today" value={stats.todayCount} detail="lessons" />
          <StatTile
            label="Applications"
            value={applications.length}
            detail="to review"
            highlight={applications.length > 0}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile label="Upcoming" value={stats.upcomingCount} detail="confirmed lessons" />
          <StatTile label="Students" value={stats.studentCount} detail="on your books" />
          <StatTile
            label="This month"
            value={formatPrice(money.collectedThisMonth, money.currency)}
            detail="collected"
          />
        </div>

        <DashboardSection
          title="New applications"
          description="Students, parents and tutors waiting to join. Nobody can sign in until you accept them."
          count={applications.length}
          emptyTitle="Nobody is waiting"
          emptyBody="When someone registers, their application lands here for you to accept or decline. They are emailed either way."
          action={
            <Link href="/tutor/applications" className={SECONDARY_BUTTON}>
              <UserPlus className="size-4" aria-hidden="true" />
              All applications
            </Link>
          }
        >
          <ul className="space-y-3">
            {/* The five oldest. The full queue lives on its own page. */}
            {applications.slice(0, 5).map((application) => (
              <li
                key={application.userId}
                className="rounded-2xl border border-brand-blue-100 bg-white p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[16px] font-bold text-brand-navy">
                    {application.name}
                  </p>
                  <span className="rounded-full bg-brand-blue-50 px-3 py-1 text-[12px] font-bold text-brand-blue uppercase">
                    {application.role}
                  </span>
                </div>
                <p className="mt-0.5 text-[14px] text-brand-slate">
                  {application.detail} · {application.email}
                </p>
                <div className="mt-3">
                  <ApplicationDecision
                    userId={application.userId}
                    name={application.name}
                  />
                </div>
              </li>
            ))}
          </ul>
        </DashboardSection>

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

        <section className="rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-extrabold text-brand-navy">The business</h2>
              <p className="mt-1 text-[14px] text-brand-slate">
                Money collected and money still owed, across every student.
              </p>
            </div>

            <Link href="/admin/payments" className={SECONDARY_BUTTON}>
              <Receipt className="size-4" aria-hidden="true" />
              Payments and invoices
            </Link>
          </header>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="This month"
              value={formatPrice(money.collectedThisMonth, money.currency)}
              detail="collected"
            />
            <StatTile
              label="All time"
              value={formatPrice(money.collected, money.currency)}
              detail="collected"
            />
            <StatTile
              label="Outstanding"
              value={formatPrice(money.unpaidBookingValue, money.currency)}
              detail={`${money.unpaidBookings} unpaid lesson${
                money.unpaidBookings === 1 ? '' : 's'
              }`}
              // Amber only when there is actually something to chase.
              highlight={money.unpaidBookings > 0}
            />
            <StatTile
              label="Not completed"
              value={formatPrice(money.pending, money.currency)}
              detail="checkouts started"
            />
          </div>
        </section>

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

          {/* Owner sections. Reachable because a solo tutor is staff - see
              @/lib/auth/roles - and guarded again on every page and action. */}
          <SectionLink
            href="/tutor/applications"
            icon={<UserPlus className="size-5" />}
            title="Applications"
            body="Accept or decline the people asking to join."
          />
          <SectionLink
            href="/admin/payments"
            icon={<CreditCard className="size-5" />}
            title="Payments and invoices"
            body="Revenue, outstanding lessons and every invoice."
          />
          <SectionLink
            href="/admin/users"
            icon={<Users className="size-5" />}
            title="Accounts"
            body="Students, parents and linking a parent to their child."
          />
          <SectionLink
            href="/admin/bookings"
            icon={<CalendarClock className="size-5" />}
            title="All bookings"
            body="Every lesson booked, and the power to change its status."
          />
          <SectionLink
            href="/admin/dashboard"
            icon={<Settings className="size-5" />}
            title="Business settings"
            body="Subjects, tutors, availability and the rest of the admin."
          />
          <SectionLink
            href="/tutor/settings"
            icon={<KeyRound className="size-5" />}
            title="Settings"
            body="Change the email address and password you sign in with."
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
