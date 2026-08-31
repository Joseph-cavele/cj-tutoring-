import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { listBookings } from '@/services/lesson-booking.service';
import { BOOKING_STATUSES, type BookingStatus } from '@/models/Booking';
import BookingCard from '@/components/booking/BookingCard';
import BookingStatusControl from '@/components/owner/BookingStatusControl';
import DashboardSection, { StatTile } from '@/components/dashboard/DashboardSection';

export const dynamic = 'force-dynamic';

/**
 * Every booking on the platform (brief sections 12 and 14, rule 9).
 *
 * Admins are the only role whose scope filter is empty, so this page relies on
 * `requireRole` plus the service's own scoping rather than on any check of its
 * own.
 */
export default async function AdminBookingsPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireRole(STAFF_ROLES, '/tutor/bookings');

  // searchParams is a Promise in Next 16.
  const params = await props.searchParams;

  const filter = (BOOKING_STATUSES as readonly string[]).includes(params.status ?? '')
    ? (params.status as BookingStatus)
    : undefined;

  const bookings = await listBookings(user, {
    status: filter,
    limit: 100,
  });

  const counts = BOOKING_STATUSES.map((status) => ({
    status,
    count: bookings.filter((booking) => booking.status === status).length,
  }));

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-5xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div>
          <Link
            href="/tutor/dashboard"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to dashboard
          </Link>

          <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            Bookings
          </h1>
          <p className="mt-2 text-[15px] text-brand-slate">
            Every lesson booked on the platform. Changing a status here
            overrides the tutor&rsquo;s decision.
          </p>
        </div>

        {!filter ? (
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {counts.map((entry) => (
              <StatTile
                key={entry.status}
                label={entry.status}
                value={entry.count}
                highlight={entry.status === 'pending' && entry.count > 0}
              />
            ))}
          </div>
        ) : null}

        <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
          <FilterLink href="/tutor/bookings" active={!filter} label="All" />
          {BOOKING_STATUSES.map((status) => (
            <FilterLink
              key={status}
              href={`/tutor/bookings?status=${status}`}
              active={filter === status}
              label={status}
            />
          ))}
        </nav>

        <DashboardSection
          title={filter ? `${filter} bookings` : 'All bookings'}
          count={bookings.length}
          emptyTitle="Nothing to show"
          emptyBody={
            filter
              ? 'No bookings currently have that status.'
              : 'No lessons have been booked yet. They will appear here as soon as they are.'
          }
        >
          <ul className="space-y-3">
            {bookings.map((booking) => (
              <li key={booking.id}>
                <BookingCard
                  booking={booking}
                  perspective="owner"
                  showPayment
                  actions={
                    <BookingStatusControl
                      bookingId={booking.id}
                      status={booking.status}
                    />
                  }
                />
              </li>
            ))}
          </ul>
        </DashboardSection>
      </div>
    </section>
  );
}

function FilterLink({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`inline-flex min-h-11 items-center rounded-full px-4 text-[14px] font-semibold capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue ${
        active
          ? 'bg-brand-blue text-white'
          : 'border border-brand-blue-100 bg-white text-brand-navy hover:bg-brand-blue-50'
      }`}
    >
      {label}
    </Link>
  );
}
