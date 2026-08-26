import { CalendarDays, Clock, MapPin, Monitor, StickyNote, User } from 'lucide-react';

import type { BookingStatus } from '@/lib/booking/constants';
import type { BookingView } from '@/services/lesson-booking.service';
import { MODE_LABELS, formatBookingDate, formatDuration } from '@/types/booking';

/**
 * One booking, as every dashboard shows it.
 *
 * Presentational only: it renders whatever BookingView it is handed and takes
 * its action buttons as a slot, so the tutor's Accept/Reject and the student's
 * Cancel live in their own client components and this stays a server
 * component.
 */

const STATUS_STYLES: Record<BookingStatus, { label: string; className: string }> = {
  pending: {
    label: 'Awaiting tutor',
    className: 'bg-brand-amber/15 text-brand-amber-text',
  },
  accepted: { label: 'Confirmed', className: 'bg-green-100 text-green-800' },
  rejected: { label: 'Declined', className: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Cancelled', className: 'bg-brand-blue-50 text-brand-slate' },
  completed: { label: 'Completed', className: 'bg-brand-blue-100 text-brand-navy' },
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const style = STATUS_STYLES[status];

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[12px] font-bold tracking-wide uppercase ${style.className}`}
    >
      {style.label}
    </span>
  );
}

/** Shown to the payer while a booking is still waiting on the gateway. */
function PaymentNote({ booking }: { booking: BookingView }) {
  if (booking.paymentStatus === 'pending') {
    return (
      <p className="mt-3 rounded-xl bg-brand-amber/10 px-3 py-2 text-[13px] font-medium text-brand-amber-text">
        Payment not completed. Your tutor only sees this request once it is paid.
      </p>
    );
  }

  if (booking.paymentStatus === 'failed') {
    return (
      <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] font-medium text-red-700">
        Payment failed. Please try again or contact the office.
      </p>
    );
  }

  return null;
}

export default function BookingCard({
  booking,
  /** Whose name to lead with: a tutor cares about the student, and vice versa. */
  perspective,
  actions,
  showPayment = false,
}: {
  booking: BookingView;
  perspective: 'student' | 'tutor' | 'admin';
  actions?: React.ReactNode;
  showPayment?: boolean;
}) {
  const counterparty =
    perspective === 'tutor' ? booking.student.name : booking.tutor.name;
  const counterpartyLabel = perspective === 'tutor' ? 'Student' : 'Tutor';

  return (
    <article className="rounded-2xl border border-brand-blue-100 bg-white p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[17px] font-bold text-brand-navy">{booking.subject.name}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-[14px] text-brand-slate">
            <User className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="sr-only">{counterpartyLabel}: </span>
            {counterparty}
          </p>
        </div>

        <StatusBadge status={booking.status} />
      </header>

      <dl className="mt-4 grid gap-2 text-[14px] sm:grid-cols-2">
        <Detail icon={<CalendarDays className="size-4" />} label="Date">
          {formatBookingDate(booking.date)}
        </Detail>

        <Detail icon={<Clock className="size-4" />} label="Time">
          {booking.startTime} &ndash; {booking.endTime} (
          {formatDuration(booking.durationMinutes)})
        </Detail>

        <Detail
          icon={
            booking.teachingMode === 'in_person' ? (
              <MapPin className="size-4" />
            ) : (
              <Monitor className="size-4" />
            )
          }
          label="Format"
        >
          {MODE_LABELS[booking.teachingMode]}
        </Detail>

        {perspective === 'admin' && booking.parent ? (
          <Detail icon={<User className="size-4" />} label="Booked by">
            {booking.parent.name}
          </Detail>
        ) : null}
      </dl>

      {booking.notes ? (
        <div className="mt-3 flex gap-2 rounded-xl bg-brand-blue-50/60 p-3">
          <StickyNote
            className="mt-0.5 size-4 shrink-0 text-brand-blue"
            aria-hidden="true"
          />
          <p className="text-[13px] leading-relaxed whitespace-pre-line text-brand-navy">
            {booking.notes}
          </p>
        </div>
      ) : null}

      {booking.status === 'rejected' && booking.decisionNote ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">
          <span className="font-semibold">Reason: </span>
          {booking.decisionNote}
        </p>
      ) : null}

      {showPayment ? <PaymentNote booking={booking} /> : null}

      {actions ? <div className="mt-4">{actions}</div> : null}
    </article>
  );
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="shrink-0 text-brand-blue">
        {icon}
      </span>
      <dt className="sr-only">{label}</dt>
      <dd className="text-brand-navy">{children}</dd>
    </div>
  );
}
