import { connectDB } from '@/lib/mongodb';
import type { DeliveryMode } from '@/models/types';
import { Availability, Booking, Subject, TimeOff, Tutor } from '@/models';
import { ACTIVE_BOOKING_STATUSES } from '@/models/Booking';
import {
  coveredSlots,
  generateSlots,
  normaliseSlots,
  removePast,
  removeTaken,
  toDateOnly,
  toMinutes,
  type Slot,
} from '@/lib/availability/slots';

export type TutorCard = {
  tutorId: string;
  name: string;
  bio?: string;
  hourlyRate?: number;
  profileImage?: string;
  teachingModes: DeliveryMode[];
};

/**
 * Tutors who teach a subject and are open for bookings.
 *
 * Brief section 6: when a student picks a subject, only tutors who teach it
 * are shown. Inactive or unverified tutors are excluded here rather than
 * hidden in the UI, so the list cannot be widened from the browser.
 */
export async function getTutorsForSubject(subjectId: string): Promise<TutorCard[]> {
  await connectDB();

  const tutors = await Tutor.find({
    subjects: subjectId,
    isActive: true,
    isVerified: true,
  })
    .populate<{ user: { name: string } }>('user', 'name')
    .lean();

  return tutors.map((tutor) => ({
    tutorId: tutor._id.toString(),
    name: tutor.user?.name ?? 'Tutor',
    bio: tutor.bio,
    hourlyRate: tutor.hourlyRate,
    profileImage: tutor.profileImage,
    teachingModes: (tutor.teachingModes ?? ['online']) as DeliveryMode[],
  }));
}

/**
 * True when a window can serve the requested mode.
 *
 * A hybrid window serves both, and a request for "either" is served by any
 * window, so this is deliberately not an equality check.
 */
function windowServesMode(windowMode: DeliveryMode, requested?: DeliveryMode): boolean {
  if (!requested) return true;
  if (windowMode === 'hybrid' || requested === 'hybrid') return true;
  return windowMode === requested;
}

/**
 * Every slot a tutor offers on a date, before bookings are subtracted.
 *
 * Shared by the picker and by booking creation so that "shown as available"
 * and "accepted as valid" can never diverge (booking rule 4).
 */
export async function getOfferedSlots(params: {
  tutorId: string;
  isoDate: string;
  teachingMode?: DeliveryMode;
}): Promise<Slot[]> {
  await connectDB();

  const date = toDateOnly(params.isoDate);

  /**
   * A day the tutor has blocked offers nothing, whatever the weekly pattern
   * says. Checked HERE rather than in the picker because this function is
   * also what `validateProposedLesson` calls on submit - putting it anywhere
   * else would let a client that skips the picker book straight through a
   * blocked day.
   */
  const blocked = await TimeOff.findOne({ tutor: params.tutorId, date })
    .select('_id')
    .lean();

  if (blocked) return [];

  const windows = await Availability.find({
    tutor: params.tutorId,
    dayOfWeek: date.getUTCDay(),
    isActive: true,
  }).lean();

  const offered = windows
    .filter((window) => windowServesMode(window.teachingMode, params.teachingMode))
    .flatMap((window) =>
      generateSlots(window.startTime, window.endTime, window.slotMinutes)
    );

  return normaliseSlots(offered);
}

/** Slot sizes this tutor offers on a date, so the form can offer real lengths. */
export async function getSlotMinutesForDate(params: {
  tutorId: string;
  isoDate: string;
  teachingMode?: DeliveryMode;
}): Promise<number[]> {
  await connectDB();

  const date = toDateOnly(params.isoDate);

  const windows = await Availability.find({
    tutor: params.tutorId,
    dayOfWeek: date.getUTCDay(),
    isActive: true,
  })
    .select('slotMinutes teachingMode')
    .lean();

  const sizes = windows
    .filter((window) => windowServesMode(window.teachingMode, params.teachingMode))
    .map((window) => window.slotMinutes);

  return [...new Set(sizes)].sort((a, b) => a - b);
}

/** Slots already spoken for, for one tutor or one student, on one date. */
async function busySlots(
  field: 'tutor' | 'student',
  ownerId: string,
  isoDate: string
): Promise<Slot[]> {
  const rows = await Booking.find({
    [field]: ownerId,
    date: toDateOnly(isoDate),
    status: { $in: ACTIVE_BOOKING_STATUSES },
  })
    .select('startTime endTime')
    .lean();

  return rows.map((row) => ({ startTime: row.startTime, endTime: row.endTime }));
}

/**
 * Free slots for one tutor on one date.
 *
 * This is the single source of truth for "can this be booked", used by the
 * booking form to display options AND by the booking service to re-check on
 * submit. The client is never trusted to tell us a slot was free.
 */
export async function getAvailableSlots(params: {
  tutorId: string;
  isoDate: string;
  teachingMode?: DeliveryMode;
  /** Excludes slots this student is already busy in (booking rule 2). */
  studentId?: string;
  now?: Date;
}): Promise<Slot[]> {
  await connectDB();

  const offered = await getOfferedSlots(params);

  if (offered.length === 0) return [];

  const taken = await busySlots('tutor', params.tutorId, params.isoDate);

  const studentBusy = params.studentId
    ? await busySlots('student', params.studentId, params.isoDate)
    : [];

  const free = removeTaken(offered, [...taken, ...studentBusy]);

  return removePast(free, params.isoDate, params.now ?? new Date());
}

/**
 * Checks a proposed lesson against everything that could block it.
 *
 * Returns the slots it would occupy, or a reason it cannot go ahead. The
 * booking service calls this on submit; passing here is necessary but not
 * sufficient, because two callers can pass at the same moment - the unique
 * index on Booking settles that race.
 */
export async function validateProposedLesson(params: {
  tutorId: string;
  studentId: string;
  isoDate: string;
  startTime: string;
  durationMinutes: number;
  teachingMode: DeliveryMode;
  now?: Date;
}): Promise<{ ok: true; slots: Slot[] } | { ok: false; reason: string }> {
  const offered = await getOfferedSlots({
    tutorId: params.tutorId,
    isoDate: params.isoDate,
    teachingMode: params.teachingMode,
  });

  if (offered.length === 0) {
    return { ok: false, reason: 'That tutor is not available on that day' };
  }

  const covered = coveredSlots(offered, params.startTime, params.durationMinutes);

  if (!covered) {
    return {
      ok: false,
      reason: 'That time falls outside the hours this tutor teaches',
    };
  }

  // Rule 5, re-checked here rather than trusting the picker.
  const stillFuture = removePast(covered, params.isoDate, params.now ?? new Date());

  if (stillFuture.length !== covered.length) {
    return { ok: false, reason: 'That time has already passed' };
  }

  const tutorBusy = await busySlots('tutor', params.tutorId, params.isoDate);

  if (removeTaken(covered, tutorBusy).length !== covered.length) {
    return { ok: false, reason: 'That tutor is already booked at that time' };
  }

  const studentBusy = await busySlots('student', params.studentId, params.isoDate);

  if (removeTaken(covered, studentBusy).length !== covered.length) {
    return { ok: false, reason: 'That student already has a lesson at that time' };
  }

  return { ok: true, slots: covered };
}

/** Subjects offered for booking, for step 2 of the wizard. */
export async function getBookableSubjects() {
  await connectDB();

  const subjects = await Subject.find({ isActive: true }).sort({ name: 1 }).lean();

  return subjects.map((subject) => ({
    subjectId: subject._id.toString(),
    name: subject.name,
    slug: subject.slug,
    defaultDurationMinutes: subject.defaultDurationMinutes ?? 60,
  }));
}

/** A tutor's own weekly windows, for the availability editor. */
export async function getTutorAvailability(tutorId: string) {
  await connectDB();

  const windows = await Availability.find({ tutor: tutorId })
    .sort({ dayOfWeek: 1, startTime: 1 })
    .lean();

  return windows.map((window) => ({
    id: window._id.toString(),
    dayOfWeek: window.dayOfWeek,
    startTime: window.startTime,
    endTime: window.endTime,
    slotMinutes: window.slotMinutes,
    teachingMode: window.teachingMode as DeliveryMode,
    isActive: window.isActive,
  }));
}

/**
 * Replaces a tutor's weekly availability in one go.
 *
 * The editor sends the whole week, so this is a replace rather than a merge -
 * a window the tutor deleted must actually disappear. Existing bookings are
 * untouched: withdrawing a window stops new bookings, it does not cancel
 * lessons already agreed.
 */
export async function replaceTutorAvailability(
  tutorId: string,
  windows: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotMinutes: number;
    teachingMode: DeliveryMode;
    isActive: boolean;
  }[]
) {
  await connectDB();

  await Availability.deleteMany({ tutor: tutorId });

  if (windows.length === 0) return;

  await Availability.insertMany(windows.map((window) => ({ ...window, tutor: tutorId })));
}

export type TutorWeek = {
  tutorId: string;
  name: string;
  isVerified: boolean;
  isActive: boolean;
  /** Windows grouped by weekday, Sunday first. */
  days: { dayOfWeek: number; windows: {
    startTime: string;
    endTime: string;
    slotMinutes: number;
    teachingMode: DeliveryMode;
    isActive: boolean;
  }[] }[];
  totalHours: number;
  bookedSlots: number;
};

/**
 * Every tutor's week, for the admin overview.
 *
 * Read-only: a tutor owns their own diary, so this exists to spot gaps -
 * nobody available on a Saturday, an approved tutor who never set any hours -
 * not to edit on their behalf.
 */
export async function getAllTutorWeeks(): Promise<TutorWeek[]> {
  await connectDB();

  const tutors = await Tutor.find()
    .populate<{ user: { name: string } }>('user', 'name')
    .select('user isVerified isActive')
    .lean();

  const windows = await Availability.find({
    tutor: { $in: tutors.map((tutor) => tutor._id) },
  })
    .sort({ dayOfWeek: 1, startTime: 1 })
    .lean();

  // Upcoming commitments, so a tutor with hours but no bookings is visible.
  const upcoming = await Booking.aggregate<{ _id: unknown; count: number }>([
    {
      $match: {
        date: { $gte: new Date() },
        status: { $in: ACTIVE_BOOKING_STATUSES },
      },
    },
    { $group: { _id: '$tutor', count: { $sum: 1 } } },
  ]);

  const bookedByTutor = new Map(upcoming.map((row) => [String(row._id), row.count]));

  return tutors
    .map((tutor) => {
      const mine = windows.filter(
        (window) => window.tutor.toString() === tutor._id.toString()
      );

      const days = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
        dayOfWeek,
        windows: mine
          .filter((window) => window.dayOfWeek === dayOfWeek)
          .map((window) => ({
            startTime: window.startTime,
            endTime: window.endTime,
            slotMinutes: window.slotMinutes,
            teachingMode: window.teachingMode as DeliveryMode,
            isActive: window.isActive,
          })),
      }));

      const totalMinutes = mine
        .filter((window) => window.isActive)
        .reduce(
          (sum, window) =>
            sum + (toMinutes(window.endTime) - toMinutes(window.startTime)),
          0
        );

      return {
        tutorId: tutor._id.toString(),
        name: tutor.user?.name ?? 'Tutor',
        isVerified: tutor.isVerified,
        isActive: tutor.isActive,
        days,
        totalHours: Math.round((totalMinutes / 60) * 10) / 10,
        bookedSlots: bookedByTutor.get(tutor._id.toString()) ?? 0,
      };
    })
    .sort((a, b) => a.totalHours - b.totalHours);
}
