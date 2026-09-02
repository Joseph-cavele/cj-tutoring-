import { connectDB } from '@/lib/mongodb';
import { Attendance, Booking, Lesson } from '@/models';
import type { SessionUser } from '@/lib/auth/guard';
import { isStaff } from '@/lib/auth/roles';
import { bookingScopeFor } from '@/lib/booking/access';
import { ATTENDANCE_ALLOWED } from '@/lib/booking/constants';
import type { RecordLessonInput } from '@/validations/lesson';

export class LessonError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'LessonError';
  }
}

/**
 * Writes up a taught lesson.
 *
 * Only the tutor may call this. Students and parents read lessons; nobody but
 * the owner writes them, which is the rule in section 31 of the brief and in
 * CLAUDE.md section 25.
 *
 * Two records come out of one form:
 *   - Lesson      the teaching record (notes, homework, progress)
 *   - Attendance  the status, in the collection that already owns it
 *
 * Both are idempotent upserts keyed on the booking, so submitting twice
 * updates rather than duplicates, and a retry after a half-finished write
 * converges on the same state. That is why this does not open a transaction:
 * the failure mode a transaction would protect against - one record written,
 * the other not - is repaired by the tutor pressing save again, and the
 * partial state in between is a lesson with attendance but no notes, which is
 * exactly what a draft looks like anyway.
 */
export async function recordLesson(params: {
  user: SessionUser;
  input: RecordLessonInput;
}): Promise<{ lessonId: string }> {
  const { user, input } = params;

  if (!isStaff(user.role)) {
    throw new LessonError('Only the tutor can record a lesson', 403);
  }

  await connectDB();

  // The booking is the source of truth for who and what. Nothing is taken
  // from the request body except the booking id and the tutor's own words.
  const booking = await Booking.findById(input.bookingId)
    .select('student tutor subject date durationMinutes status paymentStatus')
    .lean();

  if (!booking) {
    throw new LessonError('Booking not found', 404);
  }

  // A lesson that was never going to happen has nothing to write up. Leaving
  // this out would let a rejected booking acquire attendance and skew the
  // percentage a parent sees.
  if (booking.status === 'cancelled' || booking.status === 'rejected') {
    throw new LessonError(`A ${booking.status} booking cannot be written up`, 409);
  }

  if (booking.status === 'pending') {
    throw new LessonError('Accept the booking before recording the lesson', 409);
  }

  /**
   * A lesson nobody paid for cannot be marked as attended.
   *
   * The gate is here as well as on the joining link because attendance is what
   * feeds the percentage a parent sees and the record a dispute is settled
   * from - marking a student present at a lesson they were never entitled to
   * sit would put the wrong answer in the one place people trust.
   *
   * `covered` passes: a monthly plan already paid for this hour.
   */
  if (!ATTENDANCE_ALLOWED.includes(booking.paymentStatus)) {
    throw new LessonError(
      'That lesson has not been paid for, so attendance cannot be recorded',
      409
    );
  }

  const lesson = await Lesson.findOneAndUpdate(
    { booking: booking._id },
    {
      $set: {
        student: booking.student,
        tutor: booking.tutor,
        subject: booking.subject,
        date: booking.date,
        durationMinutes: booking.durationMinutes,
        notes: input.notes,
        homework: input.homework,
        progress: input.progress,
        completed: input.completed,
        recordedBy: user.id,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Straight to the collection that owns attendance, so the tutor's decision
  // and the Zoom webhook's write land in the same row rather than two.
  await Attendance.updateOne(
    { booking: booking._id, student: booking.student },
    { $set: { status: input.attendance, markedBy: user.id } },
    { upsert: true }
  );

  // Finishing the write-up is what completes the booking. Left as a separate
  // write because a draft must not close the booking.
  if (input.completed && booking.status !== 'completed') {
    await Booking.updateOne({ _id: booking._id }, { $set: { status: 'completed' } });
  }

  return { lessonId: lesson._id.toString() };
}

/**
 * Accepted bookings in the past that still have no finished write-up.
 *
 * This is the tutor's actual to-do list. Drafts stay on it, because a draft is
 * an unfinished job, and only `completed` lessons drop off.
 */
export async function listBookingsAwaitingWriteUp(user: SessionUser) {
  if (!isStaff(user.role)) {
    throw new LessonError('Only the tutor can see the write-up queue', 403);
  }

  await connectDB();

  // Only lessons whose day has arrived: writing up a future booking would be
  // recording attendance for a lesson that has not happened.
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  const written = await Lesson.find({ completed: true }).select('booking').lean();

  return Booking.find({
    status: 'accepted',
    date: { $lte: endOfToday },
    _id: { $nin: written.map((lesson) => lesson.booking) },
  })
    .sort({ date: -1 })
    .limit(50)
    .populate('subject', 'name')
    .populate({ path: 'student', select: 'user grade', populate: { path: 'user', select: 'name' } })
    .lean();
}

/**
 * Lessons this user is allowed to see, newest first.
 *
 * The scope comes from `bookingScopeFor`, the same helper the bookings screens
 * use: the tutor sees everything, a student only their own rows, a parent only
 * their linked children's. A user with no profile matches nothing rather than
 * everything.
 */
export async function listLessonsFor(params: {
  user: SessionUser;
  studentId?: string;
  limit?: number;
}) {
  const { user, studentId, limit = 50 } = params;

  await connectDB();

  const scope = await bookingScopeFor(user);

  // A studentId from the client narrows the scope, it never widens it: the
  // scope filter is applied on top, so asking for someone else's child
  // produces an empty list rather than their records.
  const filter = studentId ? { ...scope, student: studentId } : scope;

  return Lesson.find(filter)
    .sort({ date: -1 })
    .limit(Math.min(limit, 200))
    .populate('subject', 'name')
    .populate('student', 'grade')
    .lean();
}
