import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { STAFF_ROLES } from '@/lib/auth/roles';
import {
  getTutorCalendar,
  type CalendarBooking,
  type CalendarDay,
} from '@/services/calendar.service';
import { nowInSast } from '@/lib/availability/slots';
import { WEEKDAYS } from '@/lib/booking/constants';
import { MODE_LABELS } from '@/types/booking';
import { StatTile } from '@/components/dashboard/DashboardSection';
import BlockDayForm from '@/components/tutor/BlockDayForm';
import DayOffToggle from '@/components/tutor/DayOffToggle';

export const dynamic = 'force-dynamic';

/**
 * The tutor's month calendar (brief section 27).
 *
 * Two views of the same month, because one shape cannot serve both jobs on a
 * phone: a grid for "what does my month look like", and an agenda underneath
 * for "what is actually happening, and let me act on it". The grid is dots and
 * numbers only, which is all that fits in a 45px cell on a 375px screen.
 *
 * Scheduled tests come through the calendar service from the timetable, so
 * the two screens cannot disagree about when a test sits.
 */

const DAY_LABEL = new Intl.DateTimeFormat('en-ZA', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** One colour per state, used by both the dots and the legend. */
const STATUS_STYLE: Record<string, { dot: string; text: string; label: string }> = {
  accepted: { dot: 'bg-brand-blue', text: 'text-brand-blue', label: 'Confirmed' },
  pending: { dot: 'bg-brand-amber', text: 'text-brand-amber-text', label: 'Pending' },
  cancelled: { dot: 'bg-red-400', text: 'text-red-700', label: 'Cancelled' },
  rejected: { dot: 'bg-red-400', text: 'text-red-700', label: 'Cancelled' },
  completed: { dot: 'bg-brand-slate', text: 'text-brand-slate', label: 'Completed' },
};

export default async function TutorCalendarPage(props: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const user = await requireRole(STAFF_ROLES, '/tutor/calendar');

  // searchParams is a Promise in Next 16.
  const params = await props.searchParams;

  const today = nowInSast().isoDate;
  const [todayYear, todayMonth] = today.split('-').map(Number);

  // The service clamps these; parsing loosely here just avoids NaN.
  const year = Number(params.y) || todayYear;
  const month = Number(params.m) || todayMonth;

  const calendar = await getTutorCalendar({ user, year, month });

  // Whole weeks, so chunking by 7 always lands cleanly.
  const weeks: CalendarDay[][] = [];

  for (let index = 0; index < calendar.days.length; index += 7) {
    weeks.push(calendar.days.slice(index, index + 7));
  }

  // The agenda only lists days worth acting on.
  const agenda = calendar.days.filter(
    (day) => day.inMonth && (day.bookings.length > 0 || day.timeOff || day.tests.length > 0)
  );

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div>
          <Link
            href="/tutor/dashboard"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to dashboard
          </Link>

          <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            Calendar
          </h1>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-brand-slate">
            Every lesson booked with you, and the days you are not teaching.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile label="Confirmed" value={calendar.totals.accepted} detail="this month" />
          <StatTile
            label="Pending"
            value={calendar.totals.pending}
            detail="awaiting you"
            highlight={calendar.totals.pending > 0}
          />
          <StatTile label="Completed" value={calendar.totals.completed} detail="taught" />
          <StatTile label="Tests" value={calendar.totals.tests} detail="scheduled" />
          <StatTile label="Days off" value={calendar.totals.daysOff} detail="blocked" />
        </div>

        {/* Month navigation */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-[var(--shadow-soft)]">
          <MonthLink
            year={calendar.previous.year}
            month={calendar.previous.month}
            label="Previous month"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Previous</span>
          </MonthLink>

          <h2 className="text-[18px] font-extrabold text-brand-navy">{calendar.label}</h2>

          <MonthLink year={calendar.next.year} month={calendar.next.month} label="Next month">
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="size-4" aria-hidden="true" />
          </MonthLink>
        </div>

        {/* Month grid */}
        <div className="overflow-x-auto rounded-2xl bg-white p-3 shadow-[var(--shadow-soft)] sm:p-5">
          <div className="min-w-[320px]">
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {WEEKDAYS.map((day) => (
                <div
                  key={day.value}
                  className="pb-1 text-center text-[11px] font-bold tracking-wide text-brand-slate uppercase"
                >
                  <span aria-hidden="true">{day.label.slice(0, 1)}</span>
                  <span className="sr-only">{day.label}</span>
                </div>
              ))}
            </div>

            {weeks.map((week) => (
              <div key={week[0].isoDate} className="mt-1 grid grid-cols-7 gap-1 sm:mt-2 sm:gap-2">
                {week.map((day) => (
                  <DayCell key={day.isoDate} day={day} />
                ))}
              </div>
            ))}
          </div>
        </div>

        <Legend />

        <BlockDayForm minIsoDate={today} />

        {/* Agenda */}
        <section aria-label="Days with activity">
          <h2 className="text-[18px] font-extrabold text-brand-navy">
            {calendar.label} in detail
          </h2>

          {agenda.length === 0 ? (
            <p className="mt-3 rounded-2xl bg-white p-6 text-[15px] text-brand-slate shadow-[var(--shadow-soft)]">
              Nothing booked this month, and no days blocked.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {agenda.map((day) => (
                <li key={day.isoDate}>
                  <AgendaDay day={day} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}

function MonthLink({
  year,
  month,
  label,
  children,
}: {
  year: number;
  month: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={`/tutor/calendar?y=${year}&m=${month}`}
      aria-label={label}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-brand-blue px-4 text-[14px] font-semibold text-brand-blue transition-colors hover:bg-brand-blue-50"
    >
      {children}
    </Link>
  );
}

function DayCell({ day }: { day: CalendarDay }) {
  // At most three dots: beyond that the cell becomes noise, and the agenda
  // below carries the detail anyway.
  const dots = day.bookings.slice(0, 3);
  const extra = day.bookings.length - dots.length;

  const base = 'flex min-h-[52px] flex-col items-center gap-1 rounded-xl p-1.5 sm:min-h-[68px]';

  const tone = !day.inMonth
    ? 'bg-transparent text-brand-slate/40'
    : day.timeOff
      ? 'bg-red-50 text-brand-navy'
      : day.teachesThisWeekday
        ? 'bg-brand-blue-50/60 text-brand-navy'
        : 'bg-brand-cream text-brand-slate';

  return (
    <div
      className={`${base} ${tone} ${day.isToday ? 'ring-2 ring-brand-blue' : ''}`}
      aria-current={day.isToday ? 'date' : undefined}
    >
      <span className={`text-[13px] font-bold ${day.isPast && day.inMonth ? 'opacity-50' : ''}`}>
        {day.dayOfMonth}
      </span>

      {day.inMonth && day.timeOff ? (
        <span className="text-[9px] font-bold tracking-wide text-red-700 uppercase">Off</span>
      ) : null}

      {day.inMonth && day.tests.length > 0 ? (
        <span className="rounded-full bg-brand-navy px-1.5 text-[9px] font-bold text-white">
          {day.tests.length === 1 ? 'TEST' : `${day.tests.length} TESTS`}
        </span>
      ) : null}

      {day.inMonth && dots.length > 0 ? (
        <span className="flex flex-wrap justify-center gap-0.5">
          {dots.map((booking) => (
            <span
              key={booking.bookingId}
              className={`size-1.5 rounded-full ${STATUS_STYLE[booking.status]?.dot ?? 'bg-brand-slate'}`}
            />
          ))}
          {extra > 0 ? <span className="text-[9px] font-bold">+{extra}</span> : null}
        </span>
      ) : null}

      <span className="sr-only">
        {day.bookings.length} lesson{day.bookings.length === 1 ? '' : 's'}
        {day.tests.length > 0
          ? `, ${day.tests.length} test${day.tests.length === 1 ? '' : 's'}`
          : ''}
        {day.timeOff ? ', day blocked' : ''}
      </span>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-2xl bg-white p-4 text-[13px] shadow-[var(--shadow-soft)]">
      {['accepted', 'pending', 'cancelled', 'completed'].map((status) => (
        <span key={status} className="inline-flex items-center gap-1.5">
          <span className={`size-2 rounded-full ${STATUS_STYLE[status].dot}`} aria-hidden="true" />
          <span className="text-brand-slate">{STATUS_STYLE[status].label}</span>
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-brand-navy" aria-hidden="true" />
        <span className="text-brand-slate">Test</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-red-300" aria-hidden="true" />
        <span className="text-brand-slate">Blocked day</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-brand-blue-100" aria-hidden="true" />
        <span className="text-brand-slate">You teach this weekday</span>
      </span>
    </div>
  );
}

function AgendaDay({ day }: { day: CalendarDay }) {
  const label = DAY_LABEL.format(new Date(`${day.isoDate}T00:00:00.000Z`));

  return (
    <article className="rounded-2xl border border-brand-blue-100 bg-white p-4 sm:p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[16px] font-bold text-brand-navy">
          {label}
          {day.isToday ? (
            <span className="ml-2 rounded-full bg-brand-blue px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
              Today
            </span>
          ) : null}
        </h3>

        {day.timeOff ? (
          <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-red-700 uppercase">
            {day.timeOff.reason ?? 'Not teaching'}
          </span>
        ) : null}
      </header>

      {day.tests.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {day.tests.map((test) => (
            <li
              key={test.testId}
              className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl bg-brand-navy/5 p-3"
            >
              <span className="font-mono text-[14px] font-bold text-brand-navy">
                {test.timeLabel}
              </span>
              <span className="rounded-full bg-brand-navy px-2 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
                Test
              </span>
              <span className="text-[14px] font-semibold text-brand-navy">
                {test.gradeName} {test.subjectName}
              </span>
              <span className="text-[14px] text-brand-slate">{test.topic ?? test.title}</span>
              {test.isDraft ? (
                <span className="text-[13px] font-bold text-brand-amber-text">Draft</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {day.bookings.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {day.bookings.map((booking) => (
            <li key={booking.bookingId}>
              <BookingRow booking={booking} />
            </li>
          ))}
        </ul>
      ) : day.tests.length === 0 ? (
        <p className="mt-2 text-[14px] text-brand-slate">No lessons booked.</p>
      ) : null}

      {/* Past days cannot usefully be blocked or reopened. */}
      {!day.isPast ? (
        <div className="mt-3">
          <DayOffToggle isoDate={day.isoDate} isBlocked={Boolean(day.timeOff)} label={label} />
        </div>
      ) : null}
    </article>
  );
}

function BookingRow({ booking }: { booking: CalendarBooking }) {
  const style = STATUS_STYLE[booking.status];

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-xl bg-brand-blue-50/50 p-3">
      <span className="font-mono text-[14px] font-bold text-brand-navy">
        {booking.startTime}&ndash;{booking.endTime}
      </span>
      <span className="text-[14px] font-semibold text-brand-navy">{booking.studentName}</span>
      <span className="text-[14px] text-brand-slate">{booking.subjectName}</span>
      <span className="text-[13px] text-brand-slate">{MODE_LABELS[booking.teachingMode]}</span>
      <span className={`text-[13px] font-bold ${style?.text ?? 'text-brand-slate'}`}>
        {style?.label ?? booking.status}
      </span>
    </div>
  );
}
