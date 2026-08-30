import { connectDB } from '@/lib/mongodb';
import { Booking, Student, Subject, Tutor, User } from '@/models';
import {
  ACTIVE_BOOKING_STATUSES,
  PAYMENT_SETTLED,
  slotKey,
  type BookingPaymentStatus,
  type BookingStatus,
} from '@/models/Booking';
import type { DeliveryMode } from '@/models/types';
import type { SessionUser } from '@/lib/auth/guard';
import { isStaff } from '@/lib/auth/roles';
import {
  BookingAccessError,
  bookingScopeFor,
  resolveBookingActor,
  studentProfileFor,
  tutorProfileFor,
} from '@/lib/booking/access';
import { validateProposedLesson } from '@/services/availability.service';
import { addMinutes, isInPast, toDateOnly, toIsoDate } from '@/lib/availability/slots';
import { isPaymentConfigured } from '@/lib/payments';
import { cancelMeetingForBooking, createMeetingForBooking } from '@/services/zoom.service';
import { notifyBookingCreated } from '@/services/notification.service';
import type { CreateBookingInput } from '@/validations/lesson-booking';

export class BookingError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'BookingError';
  }
}

/** Both access and booking failures are safe to show the user verbatim. */
function asBookingError(error: unknown): BookingError {
  if (error instanceof BookingError) return error;
  if (error instanceof BookingAccessError) return new BookingError(error.message, error.status);
  throw error;
}

/**
 * A booking as any dashboard needs it.
 *
 * Deliberately flat and free of Mongoose documents so it can cross the server
 * component boundary, and free of anything the viewer may not see - the Zoom
 * host link in particular is added per-role by the Zoom service, never here.
 */
export type BookingView = {
  id: string;
  status: BookingStatus;
  paymentStatus: BookingPaymentStatus;
  student: { id: string; name: string };
  parent: { id: string; name: string } | null;
  tutor: { id: string; name: string };
  subject: { id: string; name: string };
  /** "YYYY-MM-DD" */
  date: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  teachingMode: DeliveryMode;
  notes: string | null;
  amount: number;
  currency: string;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  /** True when the lesson is still in the future. */
  isUpcoming: boolean;
};

type PopulatedBooking = {
  _id: { toString(): string };
  status: BookingStatus;
  paymentStatus: BookingPaymentStatus;
  student?: { _id: { toString(): string }; user?: { name?: string } } | null;
  parent?: { _id: { toString(): string }; user?: { name?: string } } | null;
  tutor?: { _id: { toString(): string }; user?: { name?: string } } | null;
  subject?: { _id: { toString(): string }; name?: string } | null;
  date: Date;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  teachingMode: DeliveryMode;
  notes?: string;
  amount: number;
  currency: string;
  decisionNote?: string | null;
  decidedAt?: Date | null;
  createdAt: Date;
};

/** Every reference a BookingView needs. Student, parent and tutor each hold
 *  the display name on their linked User, hence the nested populate. */
const BOOKING_RELATIONS = [
  { path: 'student', select: 'user', populate: { path: 'user', select: 'name' } },
  { path: 'parent', select: 'user', populate: { path: 'user', select: 'name' } },
  { path: 'tutor', select: 'user', populate: { path: 'user', select: 'name' } },
  { path: 'subject', select: 'name' },
];

function toView(booking: PopulatedBooking, now = new Date()): BookingView {
  const isoDate = toIsoDate(booking.date);

  return {
    id: booking._id.toString(),
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    student: {
      id: booking.student?._id.toString() ?? '',
      name: booking.student?.user?.name ?? 'Student',
    },
    parent: booking.parent
      ? {
          id: booking.parent._id.toString(),
          name: booking.parent.user?.name ?? 'Parent',
        }
      : null,
    tutor: {
      id: booking.tutor?._id.toString() ?? '',
      name: booking.tutor?.user?.name ?? 'Tutor',
    },
    subject: {
      id: booking.subject?._id.toString() ?? '',
      name: booking.subject?.name ?? 'Subject',
    },
    date: isoDate,
    startTime: booking.startTime,
    endTime: booking.endTime,
    durationMinutes: booking.durationMinutes,
    teachingMode: booking.teachingMode,
    notes: booking.notes ?? null,
    amount: booking.amount,
    currency: booking.currency,
    decisionNote: booking.decisionNote ?? null,
    decidedAt: booking.decidedAt ? booking.decidedAt.toISOString() : null,
    createdAt: booking.createdAt.toISOString(),
    isUpcoming: !isInPast(isoDate, booking.startTime, now),
  };
}

/** Rand owed for a lesson, from the tutor's stored rate (never from the client). */
function priceFor(hourlyRate: number, durationMinutes: number): number {
  return Math.round(((hourlyRate * durationMinutes) / 60) * 100) / 100;
}

/**
 * Creates a booking.
 *
 * Every rule in brief section 14 is enforced here, on the server, using data
 * read from the database rather than anything the browser supplied. The
 * caller's role decides who the lesson may be for; the tutor's record decides
 * the subject, the mode and the price; the availability tables decide the
 * time.
 */
export async function createBooking(user: SessionUser, input: CreateBookingInput) {
  await connectDB();

  try {
    // Rule 8: who is this booking allowed to be for.
    const actor = await resolveBookingActor(user, input.studentId);

    const tutor = await Tutor.findById(input.tutorId)
      .select('subjects teachingModes isActive isVerified hourlyRate user')
      .lean();

    if (!tutor || !tutor.isActive || !tutor.isVerified) {
      throw new BookingError('That tutor is not taking bookings', 404);
    }

    const subject = await Subject.findOne({ _id: input.subjectId, isActive: true })
      .select('name')
      .lean();

    if (!subject) throw new BookingError('That subject is not available', 404);

    // Rule 3: a tutor only receives bookings for subjects they teach.
    const teachesSubject = tutor.subjects?.some(
      (subjectId) => subjectId.toString() === input.subjectId
    );

    if (!teachesSubject) {
      throw new BookingError('That tutor does not teach that subject', 409);
    }

    const modes = (tutor.teachingModes ?? []) as DeliveryMode[];
    const servesMode =
      modes.includes(input.teachingMode) ||
      modes.includes('hybrid') ||
      input.teachingMode === 'hybrid';

    if (!servesMode) {
      throw new BookingError('That tutor does not teach in that format', 409);
    }

    if (typeof tutor.hourlyRate !== 'number' || tutor.hourlyRate <= 0) {
      // Pricing is database-driven (CLAUDE.md section 5), so a missing rate is
      // a configuration problem, not something to paper over with a default.
      throw new BookingError('That tutor has no rate set yet. Please contact us.', 409);
    }

    // Rules 1, 2, 4 and 5, all re-checked server-side.
    const check = await validateProposedLesson({
      tutorId: input.tutorId,
      studentId: actor.studentId,
      isoDate: input.date,
      startTime: input.startTime,
      durationMinutes: input.durationMinutes,
      teachingMode: input.teachingMode,
    });

    if (!check.ok) throw new BookingError(check.reason, 409);

    const amount = priceFor(tutor.hourlyRate, input.durationMinutes);

    // When no gateway is configured the lesson is simply not gated on payment,
    // rather than being silently marked as paid.
    const paymentStatus: BookingPaymentStatus = isPaymentConfigured()
      ? 'pending'
      : 'not_required';

    try {
      const booking = await Booking.create({
        student: actor.studentId,
        parent: actor.parentId,
        tutor: input.tutorId,
        subject: input.subjectId,
        date: toDateOnly(input.date),
        startTime: input.startTime,
        endTime: addMinutes(input.startTime, input.durationMinutes),
        durationMinutes: input.durationMinutes,
        teachingMode: input.teachingMode,
        notes: input.notes || undefined,
        // Rule 6. Never taken from the request.
        status: 'pending',
        amount,
        currency: 'ZAR',
        paymentStatus,
        // Rules 1 and 2, enforced by the unique indexes rather than by the
        // read above, which two callers can pass simultaneously.
        tutorSlotKeys: check.slots.map((slot) =>
          slotKey(input.tutorId, input.date, slot.startTime)
        ),
        studentSlotKeys: check.slots.map((slot) =>
          slotKey(actor.studentId, input.date, slot.startTime)
        ),
      });

      // Confirmation to the booker, notice to the tutor and to the office.
      // Never throws: the lesson is already reserved, and it is better to
      // hold a slot with no email sent than to lose the slot.
      await notifyBookingCreated(booking._id.toString());

      return {
        bookingId: booking._id.toString(),
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        amount: booking.amount,
        currency: booking.currency,
        requiresPayment: paymentStatus === 'pending',
      };
    } catch (error) {
      // E11000: another request took one of these slots between the check and
      // the write. This is the race the indexes exist to lose safely.
      if (
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: number }).code === 11000
      ) {
        throw new BookingError('That time was just booked. Please pick another.', 409);
      }

      throw error;
    }
  } catch (error) {
    throw asBookingError(error);
  }
}

export type BookingFilter = {
  status?: BookingStatus | BookingStatus[];
  /** Only lessons from today onward, or only those before today. */
  when?: 'upcoming' | 'past';
  /** Restricts to bookings the tutor may act on (paid and pending). */
  awaitingDecision?: boolean;
  limit?: number;
};

/**
 * Bookings this user is allowed to see (rules 8 and 9).
 *
 * The scope filter comes from the session, so a caller cannot widen it by
 * sending ids of their own.
 */
export async function listBookings(
  user: SessionUser,
  filter: BookingFilter = {}
): Promise<BookingView[]> {
  await connectDB();

  const scope = await bookingScopeFor(user);
  const today = toDateOnly(toIsoDate(new Date(Date.now() + 2 * 60 * 60 * 1000)));

  const query: Record<string, unknown> = { ...scope };

  if (filter.status) {
    query.status = Array.isArray(filter.status) ? { $in: filter.status } : filter.status;
  }

  if (filter.when === 'upcoming') query.date = { $gte: today };
  if (filter.when === 'past') query.date = { $lt: today };

  if (filter.awaitingDecision) {
    query.status = 'pending';
    // Only paid lessons reach the tutor's queue.
    query.paymentStatus = { $in: PAYMENT_SETTLED };
  }

  const bookings = await Booking.find(query)
    .sort(filter.when === 'past' ? { date: -1 } : { date: 1, startTime: 1 })
    .populate(BOOKING_RELATIONS)
    .limit(filter.limit ?? 100)
    .lean();

  return (bookings as unknown as PopulatedBooking[]).map((booking) => toView(booking));
}

/** One booking, or null when this user may not see it. */
export async function getBooking(
  user: SessionUser,
  bookingId: string
): Promise<BookingView | null> {
  await connectDB();

  const scope = await bookingScopeFor(user);

  const booking = await Booking.findOne({ _id: bookingId, ...scope })
    .populate(BOOKING_RELATIONS)
    .lean();

  if (!booking) return null;

  return toView(booking as unknown as PopulatedBooking);
}

/**
 * Tutor accepts or rejects a request (rule 7).
 *
 * The tutor is identified from the session, and the booking must already
 * belong to them: an id in the request body cannot make someone else's
 * booking theirs.
 */
export async function decideBooking(
  user: SessionUser,
  input: { bookingId: string; decision: 'accepted' | 'rejected'; note?: string }
) {
  await connectDB();

  try {
    if (user.role !== 'tutor') {
      throw new BookingError('Only the assigned tutor can answer a request', 403);
    }

    const tutor = await tutorProfileFor(user.id);

    if (!tutor) throw new BookingError('Your tutor profile is not set up yet', 409);

    const booking = await Booking.findOne({ _id: input.bookingId, tutor: tutor._id });

    if (!booking) throw new BookingError('That booking was not found', 404);

    if (booking.status !== 'pending') {
      throw new BookingError(`That booking is already ${booking.status}`, 409);
    }

    if (!PAYMENT_SETTLED.includes(booking.paymentStatus)) {
      throw new BookingError('That lesson has not been paid for yet', 409);
    }

    booking.status = input.decision;
    booking.decidedBy = user.id as unknown as typeof booking.decidedBy;
    booking.decidedAt = new Date();
    booking.decisionNote = input.note ?? null;

    // Rule 10: a rejected lesson frees the time immediately.
    if (input.decision === 'rejected') {
      booking.set('tutorSlotKeys', undefined);
      booking.set('studentSlotKeys', undefined);
    }

    await booking.save();

    // An accepted online lesson needs somewhere to happen. This never throws:
    // the decision is already saved, and a Zoom outage must not undo it.
    if (input.decision === 'accepted') {
      await createMeetingForBooking(booking._id.toString());
    }

    return { bookingId: booking._id.toString(), status: booking.status };
  } catch (error) {
    throw asBookingError(error);
  }
}

/**
 * Cancels a booking and releases the slot (rule 10).
 *
 * A student or the parent who owns it may cancel while it is still pending or
 * accepted and has not yet started; a tutor may withdraw from one they have
 * accepted; an admin may cancel any.
 */
export async function cancelBooking(
  user: SessionUser,
  input: { bookingId: string; reason?: string }
) {
  await connectDB();

  try {
    const scope = await bookingScopeFor(user);
    const booking = await Booking.findOne({ _id: input.bookingId, ...scope });

    if (!booking) throw new BookingError('That booking was not found', 404);

    if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
      throw new BookingError(`That booking is already ${booking.status}`, 409);
    }

    if (booking.status === 'completed') {
      throw new BookingError('A completed lesson cannot be cancelled', 409);
    }

    if (
      user.role !== 'admin' &&
      isInPast(toIsoDate(booking.date), booking.startTime)
    ) {
      throw new BookingError('That lesson has already started', 409);
    }

    booking.status = 'cancelled';
    booking.decidedBy = user.id as unknown as typeof booking.decidedBy;
    booking.decidedAt = new Date();
    booking.decisionNote = input.reason ?? null;
    booking.set('tutorSlotKeys', undefined);
    booking.set('studentSlotKeys', undefined);

    await booking.save();

    // A cancelled lesson should not leave a live meeting room behind.
    await cancelMeetingForBooking(booking._id.toString());

    return { bookingId: booking._id.toString(), status: booking.status };
  } catch (error) {
    throw asBookingError(error);
  }
}

/**
 * Staff override (rule 9).
 *
 * Kept separate from cancelBooking so the broad power to set any status is
 * reachable only through a function that checks the caller is staff first.
 * The tutor who owns the business holds this power alongside an admin.
 */
export async function adminSetBookingStatus(
  user: SessionUser,
  input: { bookingId: string; status: BookingStatus; note?: string }
) {
  await connectDB();

  if (!isStaff(user.role)) {
    throw new BookingError('Only the tutor or an admin can change a booking status', 403);
  }

  const booking = await Booking.findById(input.bookingId);

  if (!booking) throw new BookingError('That booking was not found', 404);

  booking.status = input.status;
  booking.decidedBy = user.id as unknown as typeof booking.decidedBy;
  booking.decidedAt = new Date();
  booking.decisionNote = input.note ?? null;

  // Releasing or re-reserving the slot has to follow the status, or the
  // calendar and the bookings drift apart.
  if (input.status === 'cancelled' || input.status === 'rejected') {
    booking.set('tutorSlotKeys', undefined);
    booking.set('studentSlotKeys', undefined);
  }

  await booking.save();

  if (input.status === 'cancelled' || input.status === 'rejected') {
    await cancelMeetingForBooking(booking._id.toString());
  }

  if (input.status === 'accepted') {
    await createMeetingForBooking(booking._id.toString());
  }

  return { bookingId: booking._id.toString(), status: booking.status };
}

/** Students a parent may book for, for step 1 of the wizard. */
export async function getBookableStudents(user: SessionUser) {
  await connectDB();

  if (user.role === 'student') {
    const student = await studentProfileFor(user.id);
    if (!student) return [];

    const account = await User.findById(user.id).select('name').lean();

    return [{ studentId: student._id.toString(), name: account?.name ?? 'You' }];
  }

  const scope = await bookingScopeFor(user);
  const studentFilter = (scope as { student?: unknown }).student;

  // Admins see everyone; a parent sees only the ids their scope allows.
  const students = await Student.find(
    user.role === 'admin' ? {} : studentFilter ? { _id: studentFilter } : { _id: null }
  )
    .populate<{ user: { name: string } }>('user', 'name')
    .select('user')
    .limit(user.role === 'admin' ? 200 : 50)
    .lean();

  return students.map((student) => ({
    studentId: student._id.toString(),
    name: student.user?.name ?? 'Student',
  }));
}
