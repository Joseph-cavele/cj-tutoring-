import { connectDB } from '@/lib/mongodb';
import { Availability, Booking, Grade, Subject, Tutor, User } from '@/models';
import { ACTIVE_BOOKING_STATUSES } from '@/models/Booking';
import type { DeliveryMode } from '@/models/types';
import type { SessionUser } from '@/lib/auth/guard';
import type { TutorProfileInput } from '@/validations/tutor';

export class TutorError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'TutorError';
  }
}

export type TutorProfileView = {
  tutorId: string;
  name: string;
  email: string;
  bio: string;
  qualifications: string[];
  hourlyRate: number | null;
  subjectIds: string[];
  gradeIds: string[];
  teachingModes: DeliveryMode[];
  profileImage: string;
  isVerified: boolean;
  isActive: boolean;
  /** Whether the User account may sign in at all. */
  accountActive: boolean;
};

/**
 * The signed-in tutor's own profile.
 *
 * Resolved from the session, so this can only ever load the caller's own
 * record - there is no id parameter to tamper with.
 */
export async function getMyTutorProfile(user: SessionUser): Promise<TutorProfileView | null> {
  await connectDB();

  const tutor = await Tutor.findOne({ user: user.id })
    .populate<{ user: { name: string; email: string; isActive: boolean } }>(
      'user',
      'name email isActive'
    )
    .lean();

  if (!tutor) return null;

  return {
    tutorId: tutor._id.toString(),
    name: tutor.user?.name ?? '',
    email: tutor.user?.email ?? '',
    bio: tutor.bio ?? '',
    qualifications: tutor.qualifications ?? [],
    hourlyRate: tutor.hourlyRate ?? null,
    subjectIds: (tutor.subjects ?? []).map((id) => id.toString()),
    gradeIds: (tutor.grades ?? []).map((id) => id.toString()),
    teachingModes: (tutor.teachingModes ?? []) as DeliveryMode[],
    profileImage: tutor.profileImage ?? '',
    isVerified: tutor.isVerified,
    isActive: tutor.isActive,
    accountActive: tutor.user?.isActive ?? false,
  };
}

/**
 * A tutor updates their own profile.
 *
 * Only the fields in TutorProfileInput are written. `isVerified` and
 * `isActive` are never touched here, so a tutor cannot approve themselves or
 * undo an admin's suspension by saving their bio.
 */
export async function updateMyTutorProfile(user: SessionUser, input: TutorProfileInput) {
  await connectDB();

  const tutor = await Tutor.findOne({ user: user.id });

  if (!tutor) throw new TutorError('Your tutor profile is not set up yet', 409);

  // Subjects must exist and be active, so a tutor cannot attach themselves to
  // a subject that was removed or that they invented.
  const subjects = await Subject.find({
    _id: { $in: input.subjectIds },
    isActive: true,
  })
    .select('_id')
    .lean();

  if (subjects.length === 0) {
    throw new TutorError('Choose at least one subject that is currently offered', 400);
  }

  const grades = input.gradeIds.length
    ? await Grade.find({ _id: { $in: input.gradeIds } }).select('_id').lean()
    : [];

  tutor.bio = input.bio || undefined;
  tutor.qualifications = input.qualifications;
  tutor.hourlyRate = input.hourlyRate;
  tutor.subjects = subjects.map((subject) => subject._id);
  tutor.grades = grades.map((grade) => grade._id);
  tutor.teachingModes = input.teachingModes;
  tutor.profileImage = input.profileImage || undefined;

  await tutor.save();

  return { tutorId: tutor._id.toString() };
}

export type AdminTutorView = TutorProfileView & {
  subjectNames: string[];
  /** Bookings still live against this tutor, shown before deactivating. */
  activeBookings: number;
  joinedAt: string;
};

/** Every tutor, for the admin approval queue. */
export async function listTutorsForAdmin(): Promise<AdminTutorView[]> {
  await connectDB();

  const tutors = await Tutor.find()
    .populate<{ user: { name: string; email: string; isActive: boolean } }>(
      'user',
      'name email isActive'
    )
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  const subjects = await Subject.find().select('name').lean();
  const subjectName = new Map(subjects.map((subject) => [subject._id.toString(), subject.name]));

  return Promise.all(
    tutors.map(async (tutor) => {
      const activeBookings = await Booking.countDocuments({
        tutor: tutor._id,
        status: { $in: ACTIVE_BOOKING_STATUSES },
      });

      const subjectIds = (tutor.subjects ?? []).map((id) => id.toString());

      return {
        tutorId: tutor._id.toString(),
        name: tutor.user?.name ?? 'Tutor',
        email: tutor.user?.email ?? '',
        bio: tutor.bio ?? '',
        qualifications: tutor.qualifications ?? [],
        hourlyRate: tutor.hourlyRate ?? null,
        subjectIds,
        gradeIds: (tutor.grades ?? []).map((id) => id.toString()),
        teachingModes: (tutor.teachingModes ?? []) as DeliveryMode[],
        profileImage: tutor.profileImage ?? '',
        isVerified: tutor.isVerified,
        isActive: tutor.isActive,
        accountActive: tutor.user?.isActive ?? false,
        subjectNames: subjectIds
          .map((id) => subjectName.get(id))
          .filter((name): name is string => Boolean(name)),
        activeBookings,
        joinedAt: tutor.createdAt.toISOString(),
      };
    })
  );
}

/**
 * Approves or suspends a tutor (brief section 12).
 *
 * Two separate flags have to move together, which is the whole reason this is
 * one function rather than a checkbox each:
 *
 * - `User.isActive` decides whether the account can sign in at all. Tutor
 *   registrations create it as false, so an unvetted adult cannot reach the
 *   platform before anyone has looked at them.
 * - `Tutor.isVerified` decides whether they appear in the booking flow.
 *
 * Approving sets both. Suspending clears `isActive` on the tutor record but
 * deliberately leaves the account able to sign in, so a suspended tutor can
 * still see and finish lessons already on their books.
 */
export async function setTutorApproval(params: {
  tutorId: string;
  isVerified: boolean;
  isActive: boolean;
}) {
  await connectDB();

  const tutor = await Tutor.findById(params.tutorId).select('user isVerified isActive');

  if (!tutor) throw new TutorError('That tutor was not found', 404);

  tutor.isVerified = params.isVerified;
  tutor.isActive = params.isActive;
  await tutor.save();

  // Verifying is what lets them sign in for the first time.
  if (params.isVerified) {
    await User.updateOne({ _id: tutor.user }, { $set: { isActive: true } });
  }

  return { tutorId: tutor._id.toString() };
}

/**
 * Admin sets a tutor's commercial details.
 *
 * Needed because a tutor cannot be booked without an hourly rate and at least
 * one subject, and the admin should be able to get someone live without
 * waiting for them to fill in their own profile.
 */
export async function adminUpdateTutor(params: {
  tutorId: string;
  hourlyRate: number;
  subjectIds: string[];
  teachingModes: DeliveryMode[];
}) {
  await connectDB();

  const tutor = await Tutor.findById(params.tutorId);

  if (!tutor) throw new TutorError('That tutor was not found', 404);

  const subjects = await Subject.find({ _id: { $in: params.subjectIds } })
    .select('_id')
    .lean();

  tutor.hourlyRate = params.hourlyRate;
  tutor.subjects = subjects.map((subject) => subject._id);

  if (params.teachingModes.length > 0) {
    tutor.teachingModes = params.teachingModes;
  }

  await tutor.save();

  return { tutorId: tutor._id.toString() };
}

/**
 * What still stops this tutor being bookable.
 *
 * Shown on both the tutor's own profile and the admin list, because "I am
 * approved but nobody can book me" is otherwise a confusing dead end.
 */
export function bookabilityBlockers(tutor: {
  isVerified: boolean;
  isActive: boolean;
  hourlyRate: number | null;
  subjectIds: string[];
  teachingModes: DeliveryMode[];
}): string[] {
  const blockers: string[] = [];

  if (!tutor.isVerified) blockers.push('Not yet approved by an administrator');
  if (!tutor.isActive) blockers.push('Marked inactive, so taking no new bookings');
  if (!tutor.hourlyRate) blockers.push('No hourly rate set');
  if (tutor.subjectIds.length === 0) blockers.push('No subjects selected');
  if (tutor.teachingModes.length === 0) blockers.push('No teaching format selected');

  return blockers;
}

/** Whether a tutor currently has any availability windows to book into. */
export async function hasAvailability(tutorId: string): Promise<boolean> {
  await connectDB();

  const count = await Availability.countDocuments({ tutor: tutorId, isActive: true });

  return count > 0;
}
