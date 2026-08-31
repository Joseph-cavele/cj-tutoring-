import { connectDB } from '@/lib/mongodb';
import { Availability, Booking, TimeOff } from '@/models';
import { isStaff } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/guard';
import { tutorProfileFor } from '@/lib/booking/access';
import { nowInSast, toIsoDate } from '@/lib/availability/slots';
import { getSittingsByDate, type TimetableEntry } from '@/services/timetable.service';
import type { BookingStatus } from '@/lib/booking/constants';
import type { DeliveryMode } from '@/models/types';

export class CalendarError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'CalendarError';
  }
}

/**
 * The tutor's month view (brief section 27).
 *
 * Everything is scoped to the signed-in tutor's own profile, resolved from
 * their user id - no tutor id is accepted from the client, and the month is
 * clamped so a crafted query cannot ask for ten thousand years of bookings.
 *
 * Tests come from the timetable service rather than being queried again here,
 * so "what is on the calendar" and "what is on the timetable" cannot disagree.
 */

export type CalendarBooking = {
  bookingId: string;
  startTime: string;
  endTime: string;
  studentName: string;
  subjectName: string;
  status: BookingStatus;
  teachingMode: DeliveryMode;
};

export type CalendarDay = {
  /** "YYYY-MM-DD" */
  isoDate: string;
  dayOfMonth: number;
  /** False for the leading and trailing days that pad the grid to whole weeks. */
  inMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  bookings: CalendarBooking[];
  /** Tests sitting on this day, from the timetable. */
  tests: TimetableEntry[];
  /** The tutor teaches on this weekday, per the recurring pattern. */
  teachesThisWeekday: boolean;
  timeOff: { timeOffId: string; reason: string | null } | null;
};

export type CalendarMonth = {
  year: number;
  /** 1-12, not the JavaScript 0-11, because it comes from a URL. */
  month: number;
  label: string;
  /** Whole weeks, Sunday first, so the grid is always a clean 7 x n. */
  days: CalendarDay[];
  previous: { year: number; month: number };
  next: { year: number; month: number };
  totals: {
    pending: number;
    accepted: number;
    cancelled: number;
    completed: number;
    daysOff: number;
    tests: number;
  };
};

const MONTH_LABEL = new Intl.DateTimeFormat('en-ZA', { month: 'long', year: 'numeric' });

/** Shifts a year/month pair by whole months, rolling the year over. */
function shiftMonth(year: number, month: number, by: number) {
  const zeroBased = month - 1 + by;
  return {
    year: year + Math.floor(zeroBased / 12),
    month: ((zeroBased % 12) + 12) % 12 + 1,
  };
}

/**
 * The grid bounds for a month: back to the Sunday on or before the 1st, and
 * forward to the Saturday on or after the last day.
 *
 * Built in UTC throughout. Every date in this app is stored at midnight UTC,
 * and doing the arithmetic in the server's local zone would slide the whole
 * grid by a day whenever the host is not on UTC.
 */
function gridRange(year: number, month: number) {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const lastOfMonth = new Date(Date.UTC(year, month, 0));

  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());

  const gridEnd = new Date(lastOfMonth);
  gridEnd.setUTCDate(gridEnd.getUTCDate() + (6 - gridEnd.getUTCDay()));

  return { firstOfMonth, lastOfMonth, gridStart, gridEnd };
}

export async function getTutorCalendar(params: {
  user: SessionUser;
  year: number;
  month: number;
  now?: Date;
}): Promise<CalendarMonth> {
  await connectDB();

  if (!isStaff(params.user.role)) {
    throw new CalendarError('Only the tutor can see the calendar', 403);
  }

  const profile = await tutorProfileFor(params.user.id);

  if (!profile) {
    throw new CalendarError('Your tutor profile is not set up yet', 409);
  }

  // Clamped, because year and month arrive from the query string.
  const year = Math.min(Math.max(Math.trunc(params.year), 2000), 2100);
  const month = Math.min(Math.max(Math.trunc(params.month), 1), 12);

  const { gridStart, gridEnd } = gridRange(year, month);

  const [bookings, windows, daysOff, sittings] = await Promise.all([
    Booking.find({
      tutor: profile._id,
      date: { $gte: gridStart, $lte: gridEnd },
    })
      .populate<{ student: { user: { name: string } } }>({
        path: 'student',
        select: 'user',
        populate: { path: 'user', select: 'name' },
      })
      .populate<{ subject: { name: string } }>('subject', 'name')
      .select('date startTime endTime status teachingMode student subject')
      .sort({ date: 1, startTime: 1 })
      .lean(),

    Availability.find({ tutor: profile._id, isActive: true })
      .select('dayOfWeek')
      .lean(),

    TimeOff.find({ tutor: profile._id, date: { $gte: gridStart, $lte: gridEnd } })
      .select('date reason')
      .lean(),

    getSittingsByDate({
      user: params.user,
      fromIsoDate: toIsoDate(gridStart),
      toIsoDate: toIsoDate(gridEnd),
    }),
  ]);

  // Bucket by day once, rather than filtering the whole list per cell.
  const bookingsByDate = new Map<string, CalendarBooking[]>();

  for (const booking of bookings) {
    const key = toIsoDate(booking.date);
    const bucket = bookingsByDate.get(key) ?? [];

    bucket.push({
      bookingId: booking._id.toString(),
      startTime: booking.startTime,
      endTime: booking.endTime,
      studentName: booking.student?.user?.name ?? 'Student',
      subjectName: booking.subject?.name ?? 'Lesson',
      status: booking.status,
      teachingMode: booking.teachingMode,
    });

    bookingsByDate.set(key, bucket);
  }

  const timeOffByDate = new Map(
    daysOff.map((entry) => [
      toIsoDate(entry.date),
      { timeOffId: entry._id.toString(), reason: entry.reason ?? null },
    ])
  );

  const teachingWeekdays = new Set(windows.map((window) => window.dayOfWeek));

  const today = nowInSast(params.now ?? new Date()).isoDate;

  const days: CalendarDay[] = [];

  for (
    const cursor = new Date(gridStart);
    cursor <= gridEnd;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const isoDate = toIsoDate(cursor);

    days.push({
      isoDate,
      dayOfMonth: cursor.getUTCDate(),
      inMonth: cursor.getUTCMonth() === month - 1 && cursor.getUTCFullYear() === year,
      isToday: isoDate === today,
      isPast: isoDate < today,
      bookings: bookingsByDate.get(isoDate) ?? [],
      tests: sittings.get(isoDate) ?? [],
      teachesThisWeekday: teachingWeekdays.has(cursor.getUTCDay()),
      timeOff: timeOffByDate.get(isoDate) ?? null,
    });
  }

  // Totals count the month itself, not the padding days borrowed from the
  // months either side - otherwise the header contradicts the grid.
  const inMonth = days.filter((day) => day.inMonth);

  const countStatus = (status: BookingStatus) =>
    inMonth.reduce(
      (sum, day) => sum + day.bookings.filter((entry) => entry.status === status).length,
      0
    );

  return {
    year,
    month,
    label: MONTH_LABEL.format(new Date(Date.UTC(year, month - 1, 1))),
    days,
    previous: shiftMonth(year, month, -1),
    next: shiftMonth(year, month, 1),
    totals: {
      pending: countStatus('pending'),
      accepted: countStatus('accepted'),
      cancelled: countStatus('cancelled') + countStatus('rejected'),
      completed: countStatus('completed'),
      daysOff: inMonth.filter((day) => day.timeOff).length,
      tests: inMonth.reduce((sum, day) => sum + day.tests.length, 0),
    },
  };
}

/**
 * Marks a date as not teaching.
 *
 * Deliberately does NOT cancel lessons already booked that day. A confirmed
 * lesson is an agreement with a family; dropping it because a checkbox was
 * ticked would be the wrong default. The clash is reported back instead, and
 * the tutor decides what to do about it.
 */
export async function addTimeOff(params: {
  user: SessionUser;
  isoDate: string;
  reason?: string;
}): Promise<{ isoDate: string; clashingBookings: number }> {
  await connectDB();

  if (!isStaff(params.user.role)) {
    throw new CalendarError('Only the tutor can block a day', 403);
  }

  const profile = await tutorProfileFor(params.user.id);

  if (!profile) throw new CalendarError('Your tutor profile is not set up yet', 409);

  const date = new Date(`${params.isoDate}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new CalendarError('That is not a valid date', 400);
  }

  // Upsert, so a double click or a second tab cannot create a duplicate and
  // trip the unique index with a 500.
  await TimeOff.updateOne(
    { tutor: profile._id, date },
    {
      $set: { reason: params.reason?.trim() || undefined },
      $setOnInsert: { tutor: profile._id, date, createdBy: params.user.id },
    },
    { upsert: true }
  );

  const clashingBookings = await Booking.countDocuments({
    tutor: profile._id,
    date,
    status: { $in: ['pending', 'accepted'] },
  });

  return { isoDate: params.isoDate, clashingBookings };
}

/** Reopens a blocked day. */
export async function removeTimeOff(params: {
  user: SessionUser;
  isoDate: string;
}): Promise<{ isoDate: string }> {
  await connectDB();

  if (!isStaff(params.user.role)) {
    throw new CalendarError('Only the tutor can reopen a day', 403);
  }

  const profile = await tutorProfileFor(params.user.id);

  if (!profile) throw new CalendarError('Your tutor profile is not set up yet', 409);

  await TimeOff.deleteOne({
    tutor: profile._id,
    date: new Date(`${params.isoDate}T00:00:00.000Z`),
  });

  return { isoDate: params.isoDate };
}
