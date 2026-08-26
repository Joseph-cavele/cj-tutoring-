import Link from 'next/link';
import { CalendarClock, CalendarPlus, ClipboardCheck, TrendingUp, Wallet } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { getParentOverview, type ChildOverview } from '@/services/parent.service';
import { getLearnerDashboard } from '@/services/booking-dashboard.service';
import { getChildrenPerformance } from '@/services/performance.service';
import { formatPrice } from '@/services/pricing.service';
import { CONTACT, mailtoHref, telHref } from '@/lib/contact';
import BookingCard from '@/components/booking/BookingCard';
import BookingOwnerActions from '@/components/booking/BookingOwnerActions';
import LessonMeetingLink from '@/components/booking/LessonMeetingLink';
import DashboardSection, { StatTile } from '@/components/dashboard/DashboardSection';
import PerformancePanel from '@/components/dashboard/PerformancePanel';
import { PRIMARY_BUTTON } from '@/components/booking/ui';
import { BOOKING_ROUTE } from '@/lib/routes';

export const dynamic = 'force-dynamic';

/**
 * Parent dashboard (brief section 11).
 *
 * Two halves: the academic picture of each linked child, and the bookings the
 * parent has placed. Both are read through services scoped by the parent's own
 * user id, so a parent reaches only their own children (CLAUDE.md section 25).
 */
export default async function ParentDashboard() {
  // Server-side check, not just the proxy.
  const user = await requireRole('parent', '/parent/dashboard');
  const firstName = user.name?.split(' ')[0] ?? 'there';

  const [children, bookings, performance] = await Promise.all([
    getParentOverview(user.id),
    getLearnerDashboard(user),
    // Test results and averages, scoped to this parent's own children.
    getChildrenPerformance(user),
  ]);

  const rejected = bookings.past
    .filter((booking) => booking.status === 'rejected')
    .slice(0, 5);

  return (
    <section className="bg-brand-cream py-12 lg:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[13px] font-bold tracking-wider text-brand-slate uppercase">
              Parent
            </p>
            <h1 className="mt-1 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
              Hello, {firstName}
            </h1>
            <p className="mt-2 text-[15px] text-brand-slate">
              Lessons, attendance, performance and payments for your children.
            </p>
          </div>

          {children.length > 0 ? (
            <Link href={BOOKING_ROUTE} className={PRIMARY_BUTTON}>
              <CalendarPlus className="size-4" aria-hidden="true" />
              Book a lesson
            </Link>
          ) : null}
        </div>

        {children.length === 0 ? <NoChildrenLinked /> : (
          <>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <StatTile
                label="Confirmed"
                value={bookings.stats.upcomingCount}
                detail="lessons ahead"
              />
              <StatTile
                label="Awaiting tutor"
                value={bookings.stats.pendingCount}
                detail="requests"
                highlight={bookings.stats.pendingCount > 0}
              />
              <StatTile label="My children" value={children.length} detail="linked" />
            </div>

            <div className="mt-6 space-y-6">
              <DashboardSection
                title="Upcoming lessons"
                description="Confirmed lessons and requests still waiting on a tutor."
                count={bookings.upcoming.length}
                emptyTitle="No lessons booked"
                emptyBody="Book a lesson for one of your children and it will appear here with its status."
                action={
                  <Link href={BOOKING_ROUTE} className={PRIMARY_BUTTON}>
                    Book a lesson
                  </Link>
                }
              >
                <ul className="space-y-3">
                  {bookings.upcoming.map((booking) => (
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

              {rejected.length > 0 ? (
                <DashboardSection
                  title="Declined requests"
                  description="A tutor could not take these. You can book another time."
                  count={rejected.length}
                  emptyTitle=""
                  emptyBody=""
                >
                  <ul className="space-y-3">
                    {rejected.map((booking) => (
                      <li key={booking.id}>
                        <BookingCard booking={booking} perspective="student" />
                      </li>
                    ))}
                  </ul>
                </DashboardSection>
              ) : null}
            </div>

            <h2 className="mt-10 text-2xl font-extrabold tracking-tight text-brand-navy">
              My children
            </h2>

            <div className="mt-4 space-y-6">
              {children.map((child) => (
                <ChildCard key={child.studentId} child={child} />
              ))}
            </div>

            {performance.length > 0 ? (
              <>
                <h2 className="mt-10 text-2xl font-extrabold tracking-tight text-brand-navy">
                  Test results and progress
                </h2>

                <div className="mt-4 space-y-8">
                  {performance.map((child) => (
                    <article key={child.studentId}>
                      <h3 className="text-lg font-bold text-brand-navy">
                        {child.studentName}
                      </h3>
                      <div className="mt-3">
                        {/* Results are read-only for a parent: no link through
                            to the paper, which belongs to the student. */}
                        <PerformancePanel performance={child} />
                      </div>
                    </article>
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

/**
 * Empty state.
 *
 * A parent account is created without any child attached, and only the office
 * can link one, so this explains the situation rather than showing zeroes that
 * look like a child with no attendance.
 */
function NoChildrenLinked() {
  return (
    <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-[var(--shadow-soft)]">
      <h2 className="text-xl font-bold text-brand-navy">No children on your account yet</h2>
      <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-brand-slate">
        Add your child and you can book their first lesson straight away. They
        get their own email invitation to set a password, so you never have to
        choose one for them.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href={BOOKING_ROUTE} className={PRIMARY_BUTTON}>
          <CalendarPlus className="size-4" aria-hidden="true" />
          Add a child and book
        </Link>
        <a
          href={mailtoHref}
          className="inline-flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-brand-blue px-6 text-[15px] font-semibold text-brand-blue transition-colors hover:bg-brand-blue-50"
        >
          Email us
        </a>
        <a
          href={telHref}
          className="inline-flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-brand-blue px-6 text-[15px] font-semibold text-brand-blue transition-colors hover:bg-brand-blue-50"
        >
          {CONTACT.phone.display}
        </a>
      </div>
    </div>
  );
}

function ChildCard({ child }: { child: ChildOverview }) {
  const dateFormat = new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <article className="rounded-3xl bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-xl font-extrabold text-brand-navy sm:text-2xl">{child.name}</h2>
        <p className="text-[14px] font-semibold text-brand-blue">{child.gradeName}</p>
      </header>

      <dl className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat
          icon={<ClipboardCheck className="size-5" />}
          label="Attendance"
          value={
            child.attendance.percentage === null
              ? 'No lessons yet'
              : `${child.attendance.percentage}%`
          }
          detail={
            child.attendance.total > 0
              ? `${child.attendance.attended} of ${child.attendance.total} lessons`
              : 'Nothing recorded so far'
          }
        />

        <Stat
          icon={<TrendingUp className="size-5" />}
          label="Average"
          value={
            child.performance.averagePercentage === null
              ? 'No results yet'
              : `${child.performance.averagePercentage}%`
          }
          detail={
            child.performance.resultCount > 0
              ? `across ${child.performance.resultCount} published result${
                  child.performance.resultCount === 1 ? '' : 's'
                }`
              : 'Results appear once marked'
          }
        />

        <Stat
          icon={<Wallet className="size-5" />}
          label="Balance"
          value={
            child.balance.outstanding > 0
              ? formatPrice(child.balance.outstanding, child.balance.currency)
              : 'Nothing owed'
          }
          detail={
            child.balance.unpaidInvoices > 0
              ? `${child.balance.unpaidInvoices} unpaid invoice${
                  child.balance.unpaidInvoices === 1 ? '' : 's'
                }`
              : 'All invoices settled'
          }
          alert={child.balance.outstanding > 0}
        />
      </dl>

      <div className="mt-6 grid gap-4 border-t border-brand-blue-100 pt-6 sm:grid-cols-2">
        <div>
          <p className="text-[13px] font-bold tracking-wide text-brand-slate uppercase">
            Package
          </p>
          {child.subscription ? (
            <p className="mt-1 text-[15px] text-brand-navy">
              {child.subscription.packageName} —{' '}
              <span className="font-semibold">
                {child.subscription.sessionsRemaining} session
                {child.subscription.sessionsRemaining === 1 ? '' : 's'} left
              </span>
            </p>
          ) : (
            <p className="mt-1 text-[15px] text-brand-slate">No active package</p>
          )}
        </div>

        <div>
          <p className="text-[13px] font-bold tracking-wide text-brand-slate uppercase">
            Next lesson
          </p>
          {child.nextLesson ? (
            <p className="mt-1 flex items-center gap-2 text-[15px] text-brand-navy">
              <CalendarClock className="size-4 shrink-0 text-brand-blue" aria-hidden="true" />
              {child.nextLesson.title}, {dateFormat.format(child.nextLesson.startsAt)}
            </p>
          ) : (
            <p className="mt-1 text-[15px] text-brand-slate">Nothing scheduled</p>
          )}
        </div>
      </div>

    </article>
  );
}

function Stat({
  icon,
  label,
  value,
  detail,
  alert,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-brand-blue-50/60 p-4">
      <dt className="flex items-center gap-2 text-[13px] font-bold tracking-wide text-brand-slate uppercase">
        <span aria-hidden="true" className={alert ? 'text-brand-amber' : 'text-brand-blue'}>
          {icon}
        </span>
        {label}
      </dt>
      <dd>
        <p
          className={`mt-2 text-2xl font-extrabold tracking-tight ${
            alert ? 'text-brand-amber-text' : 'text-brand-navy'
          }`}
        >
          {value}
        </p>
        <p className="mt-0.5 text-[13px] text-brand-slate">{detail}</p>
      </dd>
    </div>
  );
}

