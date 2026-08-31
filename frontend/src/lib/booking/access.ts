import { connectDB } from '@/lib/mongodb';
import { Parent, Student, Tutor } from '@/models';
import type { SessionUser } from '@/lib/auth/guard';
import { isStaff } from '@/lib/auth/roles';

/**
 * Who the signed-in user is allowed to act for.
 *
 * The session carries a user id and a role and nothing else, so every
 * "which student is this" question is answered from the database using that
 * id. A studentId arriving in a request body is only ever checked against
 * this set - it is never used to look up a student directly
 * (CLAUDE.md section 25).
 */

export class BookingAccessError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'BookingAccessError';
  }
}

/** The student profile belonging to a student account. */
export async function studentProfileFor(userId: string) {
  await connectDB();
  return Student.findOne({ user: userId }).select('_id grade').lean();
}

/** The parent profile belonging to a parent account. */
export async function parentProfileFor(userId: string) {
  await connectDB();
  return Parent.findOne({ user: userId }).select('_id students').lean();
}

/** The tutor profile belonging to a tutor account. */
export async function tutorProfileFor(userId: string) {
  await connectDB();
  return Tutor.findOne({ user: userId }).select('_id subjects teachingModes isActive isVerified hourlyRate').lean();
}

export type BookingActor = {
  /** Student the lesson is for. */
  studentId: string;
  /** Parent placing the booking, when one is. */
  parentId: string | null;
};

/**
 * Resolves the student a booking may be created for.
 *
 * - A student may only book for themselves; any studentId they send is ignored.
 * - A parent may only book for a child already linked to their account.
 * - The tutor, as owner, may book for any student, but must name one - which
 *   is how a lesson agreed over the phone gets into the system.
 *
 * Every branch ends at a student id this user is provably entitled to. The
 * `requestedStudentId` from the request body is never used as a lookup key on
 * its own (CLAUDE.md section 25).
 */
export async function resolveBookingActor(
  user: SessionUser,
  requestedStudentId?: string
): Promise<BookingActor> {
  if (user.role === 'student') {
    const student = await studentProfileFor(user.id);

    if (!student) {
      throw new BookingAccessError('Your student profile is not set up yet', 409);
    }

    return { studentId: student._id.toString(), parentId: null };
  }

  if (user.role === 'parent') {
    const parent = await parentProfileFor(user.id);

    if (!parent) {
      throw new BookingAccessError('Your parent profile is not set up yet', 409);
    }

    if (!requestedStudentId) {
      throw new BookingAccessError('Choose which child this lesson is for', 400);
    }

    const isLinked = parent.students.some(
      (studentId) => studentId.toString() === requestedStudentId
    );

    // Not "not found": a parent must not be able to probe which ids exist.
    if (!isLinked) {
      throw new BookingAccessError('That student is not linked to your account', 403);
    }

    return { studentId: requestedStudentId, parentId: parent._id.toString() };
  }

  if (isStaff(user.role)) {
    if (!requestedStudentId) {
      throw new BookingAccessError('Choose which student this lesson is for', 400);
    }

    const student = await Student.findById(requestedStudentId).select('_id').lean();

    if (!student) throw new BookingAccessError('That student does not exist', 404);

    return { studentId: student._id.toString(), parentId: null };
  }

  // Unreachable while Role is student | parent | tutor, but a new role must
  // fail closed here rather than fall through with no student.
  throw new BookingAccessError('Your account cannot create bookings', 403);
}

/**
 * The Mongo filter that limits a booking query to what this user may read
 * (booking rules 8 and 9).
 *
 * Returning a filter rather than post-filtering means an unauthorized row is
 * never loaded in the first place.
 */
export async function bookingScopeFor(user: SessionUser): Promise<Record<string, unknown>> {
  // The owner reads every booking; nobody else gets an unfiltered query.
  if (isStaff(user.role)) return {};

  if (user.role === 'student') {
    const student = await studentProfileFor(user.id);
    // An impossible filter, so a user with no profile reads nothing rather
    // than everything.
    return student ? { student: student._id } : { _id: null };
  }

  if (user.role === 'parent') {
    const parent = await parentProfileFor(user.id);
    return parent ? { student: { $in: parent.students } } : { _id: null };
  }

  const tutor = await tutorProfileFor(user.id);
  return tutor ? { tutor: tutor._id } : { _id: null };
}
