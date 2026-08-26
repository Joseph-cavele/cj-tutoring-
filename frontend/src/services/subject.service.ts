import { connectDB } from '@/lib/mongodb';
import { Booking, Subject, Tutor } from '@/models';
import { ACTIVE_BOOKING_STATUSES } from '@/models/Booking';
import { slugify, type SubjectInput } from '@/validations/subject';

export class SubjectError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'SubjectError';
  }
}

export type SubjectAdminView = {
  subjectId: string;
  name: string;
  slug: string;
  description: string | null;
  defaultDurationMinutes: number;
  isActive: boolean;
  tutorCount: number;
  activeBookingCount: number;
};

/**
 * Subjects with the counts an admin needs before changing one.
 *
 * Removing a subject that tutors teach or that has lessons booked against it
 * would orphan those records, so the counts are shown next to the delete
 * control rather than discovered afterwards.
 */
export async function listSubjectsForAdmin(): Promise<SubjectAdminView[]> {
  await connectDB();

  const subjects = await Subject.find().sort({ name: 1 }).lean();

  return Promise.all(
    subjects.map(async (subject) => {
      const [tutorCount, activeBookingCount] = await Promise.all([
        Tutor.countDocuments({ subjects: subject._id }),
        Booking.countDocuments({
          subject: subject._id,
          status: { $in: ACTIVE_BOOKING_STATUSES },
        }),
      ]);

      return {
        subjectId: subject._id.toString(),
        name: subject.name,
        slug: subject.slug,
        description: subject.description ?? null,
        defaultDurationMinutes: subject.defaultDurationMinutes ?? 60,
        isActive: subject.isActive,
        tutorCount,
        activeBookingCount,
      };
    })
  );
}

export async function createSubject(input: SubjectInput) {
  await connectDB();

  const slug = slugify(input.name);

  if (!slug) throw new SubjectError('That name cannot be used', 400);

  const existing = await Subject.findOne({ slug }).select('_id');

  if (existing) throw new SubjectError('A subject with that name already exists', 409);

  const subject = await Subject.create({
    name: input.name,
    slug,
    description: input.description || undefined,
    defaultDurationMinutes: input.defaultDurationMinutes,
    isActive: input.isActive,
  });

  return { subjectId: subject._id.toString() };
}

export async function updateSubject(subjectId: string, input: SubjectInput) {
  await connectDB();

  const subject = await Subject.findById(subjectId);

  if (!subject) throw new SubjectError('That subject was not found', 404);

  const slug = slugify(input.name);

  // A rename must not collide with a different subject's slug.
  const clash = await Subject.findOne({ slug, _id: { $ne: subject._id } }).select('_id');

  if (clash) throw new SubjectError('A subject with that name already exists', 409);

  subject.name = input.name;
  subject.slug = slug;
  subject.description = input.description || undefined;
  subject.defaultDurationMinutes = input.defaultDurationMinutes;
  subject.isActive = input.isActive;

  await subject.save();

  return { subjectId: subject._id.toString() };
}

/**
 * Removes a subject, but only when nothing depends on it.
 *
 * Deactivating is the usual answer: it takes the subject off the booking form
 * while leaving past lessons and results readable. A hard delete is refused
 * when tutors or live bookings still reference it.
 */
export async function deleteSubject(subjectId: string) {
  await connectDB();

  const subject = await Subject.findById(subjectId).select('_id name');

  if (!subject) throw new SubjectError('That subject was not found', 404);

  const [tutorCount, bookingCount] = await Promise.all([
    Tutor.countDocuments({ subjects: subject._id }),
    Booking.countDocuments({ subject: subject._id }),
  ]);

  if (tutorCount > 0 || bookingCount > 0) {
    throw new SubjectError(
      'That subject is in use by tutors or bookings. Deactivate it instead of deleting it.',
      409
    );
  }

  await Subject.deleteOne({ _id: subject._id });

  return { deleted: true };
}
