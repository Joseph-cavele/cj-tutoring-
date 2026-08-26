import type { SessionUser } from '@/lib/auth/guard';
import { nowInSast } from '@/lib/availability/slots';
import { listBookings, type BookingView } from '@/services/lesson-booking.service';

/**
 * Dashboard read models.
 *
 * Each function asks listBookings, which applies the caller's scope, so none
 * of these can widen what a role sees. They only slice and count what that
 * user was already entitled to read.
 */

/** Splits a set of bookings into the buckets a dashboard shows. */
function bucket(bookings: BookingView[], today: string) {
  return {
    today: bookings.filter(
      (booking) => booking.date === today && booking.status === 'accepted'
    ),
    upcoming: bookings.filter(
      (booking) => booking.date > today && booking.status === 'accepted'
    ),
  };
}

export type TutorDashboard = {
  pending: BookingView[];
  today: BookingView[];
  upcoming: BookingView[];
  stats: {
    pendingCount: number;
    todayCount: number;
    upcomingCount: number;
    studentCount: number;
  };
};

/**
 * The tutor's day (brief section 9).
 *
 * Pending requests are fetched with `awaitingDecision`, which also filters out
 * anything not yet paid for - an unpaid request is not the tutor's to answer.
 */
export async function getTutorDashboard(user: SessionUser): Promise<TutorDashboard> {
  const today = nowInSast().isoDate;

  const [pending, accepted] = await Promise.all([
    listBookings(user, { awaitingDecision: true }),
    listBookings(user, { status: 'accepted', when: 'upcoming' }),
  ]);

  const { today: todayLessons, upcoming } = bucket(accepted, today);

  // Distinct students across everything currently on the tutor's books.
  const studentIds = new Set(
    [...pending, ...accepted].map((booking) => booking.student.id)
  );

  return {
    pending,
    today: todayLessons,
    upcoming,
    stats: {
      pendingCount: pending.length,
      todayCount: todayLessons.length,
      upcomingCount: upcoming.length,
      studentCount: studentIds.size,
    },
  };
}

export type LearnerDashboard = {
  /** Anything still to come, whatever its status - a student needs to see a
   *  pending request and a rejection, not only confirmed lessons. */
  upcoming: BookingView[];
  past: BookingView[];
  awaitingPayment: BookingView[];
  stats: {
    upcomingCount: number;
    pendingCount: number;
    completedCount: number;
  };
};

/**
 * The student's or parent's view.
 *
 * Identical logic for both roles: the difference is entirely in the scope
 * filter, which limits a parent to their linked children and a student to
 * themselves.
 */
export async function getLearnerDashboard(user: SessionUser): Promise<LearnerDashboard> {
  const [upcoming, past] = await Promise.all([
    listBookings(user, { when: 'upcoming' }),
    listBookings(user, { when: 'past', limit: 20 }),
  ]);

  const live = upcoming.filter(
    (booking) => booking.status === 'pending' || booking.status === 'accepted'
  );

  return {
    upcoming: live,
    past,
    awaitingPayment: live.filter((booking) => booking.paymentStatus === 'pending'),
    stats: {
      upcomingCount: live.filter((booking) => booking.status === 'accepted').length,
      pendingCount: live.filter((booking) => booking.status === 'pending').length,
      completedCount: past.filter((booking) => booking.status === 'completed').length,
    },
  };
}
