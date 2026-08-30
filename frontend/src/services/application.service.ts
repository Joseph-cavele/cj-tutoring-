import { connectDB } from '@/lib/mongodb';
import { Parent, Student, Tutor, User } from '@/models';
import type { ApprovalStatus, Role } from '@/models/types';
import { notifyApplicationDecision } from '@/services/notification.service';

export class ApplicationError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}

/**
 * Applications to join the platform (the tutor's front door).
 *
 * Registration writes a User that is `pending` and inactive. Nothing here
 * trusts anything the applicant sent: the decision is keyed on a user id the
 * tutor picked off their own list, and the acting tutor's id comes from the
 * session, never the request body (CLAUDE.md section 25).
 *
 * Approving is what actually lets somebody sign in, so it is the only place
 * outside the admin account switch that sets `isActive` to true.
 */

/** Roles that can apply. An admin is made deliberately, never by a form. */
const APPLICANT_ROLES: Role[] = ['student', 'parent', 'tutor'];

export type ApplicationView = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: ApprovalStatus;
  appliedAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  /** One line of role-specific context, so the tutor can decide from the list. */
  detail: string;
};

/**
 * Pending applications, oldest first.
 *
 * Oldest first on purpose: somebody who signed up on Monday should not sit
 * behind everyone who signed up since. Profile documents are fetched in bulk
 * per role rather than per applicant, so a busy week is a handful of queries.
 */
export async function listApplications(
  status: ApprovalStatus = 'pending'
): Promise<ApplicationView[]> {
  await connectDB();

  const users = await User.find({ role: { $in: APPLICANT_ROLES }, approvalStatus: status })
    .sort({ createdAt: status === 'pending' ? 1 : -1 })
    .limit(100)
    .lean();

  if (users.length === 0) return [];

  const userIds = users.map((user) => user._id);

  const [students, parents, tutors] = await Promise.all([
    Student.find({ user: { $in: userIds } })
      .populate<{ grade: { name: string } }>('grade', 'name')
      .select('user grade school')
      .lean(),
    Parent.find({ user: { $in: userIds } }).select('user students').lean(),
    Tutor.find({ user: { $in: userIds } }).select('user subjects hourlyRate').lean(),
  ]);

  const studentByUser = new Map(students.map((row) => [row.user.toString(), row]));
  const parentByUser = new Map(parents.map((row) => [row.user.toString(), row]));
  const tutorByUser = new Map(tutors.map((row) => [row.user.toString(), row]));

  return users.map((user) => {
    const id = user._id.toString();

    let detail = 'Profile not set up';

    if (user.role === 'student') {
      const student = studentByUser.get(id);

      detail = student
        ? [student.grade?.name ?? 'Grade not set', student.school].filter(Boolean).join(' · ')
        : 'Student profile missing';
    } else if (user.role === 'parent') {
      const parent = parentByUser.get(id);
      const linked = parent?.students.length ?? 0;

      detail = parent
        ? linked === 0
          ? 'No children linked yet'
          : `${linked} child${linked === 1 ? '' : 'ren'} linked`
        : 'Parent profile missing';
    } else if (user.role === 'tutor') {
      const tutor = tutorByUser.get(id);
      const subjectCount = tutor?.subjects.length ?? 0;

      detail = tutor
        ? `${subjectCount} subject${subjectCount === 1 ? '' : 's'} chosen`
        : 'Tutor profile missing';
    }

    return {
      userId: id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      role: user.role,
      status: user.approvalStatus,
      appliedAt: user.createdAt.toISOString(),
      decidedAt: user.approvedAt?.toISOString() ?? null,
      decisionNote: user.decisionNote ?? null,
      detail,
    };
  });
}

/** How many people are waiting, for the dashboard badge. */
export async function countPendingApplications(): Promise<number> {
  await connectDB();

  return User.countDocuments({ role: { $in: APPLICANT_ROLES }, approvalStatus: 'pending' });
}

/**
 * The tutor accepts or declines an applicant.
 *
 * Accepting activates the account, which is the moment they can first sign in.
 * Declining leaves it closed rather than deleting it: the email address stays
 * taken, so a rejected applicant cannot simply register again and land back in
 * the queue, and there is a record of the decision.
 *
 * Safe to repeat only in one direction - a decision already made is refused,
 * so two clicks cannot send two contradicting emails.
 */
export async function decideApplication(params: {
  userId: string;
  decision: 'approved' | 'rejected';
  note?: string;
  actingUserId: string;
}) {
  await connectDB();

  const user = await User.findById(params.userId).select(
    'name email role approvalStatus isActive'
  );

  if (!user) throw new ApplicationError('That application was not found', 404);

  if (!APPLICANT_ROLES.includes(user.role)) {
    throw new ApplicationError('That account is not an application', 400);
  }

  if (user.approvalStatus === params.decision) {
    throw new ApplicationError(`That application is already ${params.decision}`, 409);
  }

  user.approvalStatus = params.decision;
  user.approvedAt = new Date();
  user.approvedBy = params.actingUserId as unknown as typeof user.approvedBy;
  user.decisionNote = params.note?.trim() || undefined;
  // Approval is what opens the door; a decline keeps it shut.
  user.isActive = params.decision === 'approved';

  await user.save();

  // A tutor is bookable only once verified, and being accepted here is that
  // verification - otherwise an approved tutor would still be invisible.
  if (user.role === 'tutor') {
    await Tutor.updateOne(
      { user: user._id },
      { $set: { isVerified: params.decision === 'approved' } }
    );
  }

  // Best effort, like every other notification: the decision is already saved
  // and a mail outage must not undo it.
  await notifyApplicationDecision({
    to: user.email,
    name: user.name,
    role: user.role,
    approved: params.decision === 'approved',
    note: params.note?.trim(),
  });

  return { userId: user._id.toString(), status: user.approvalStatus };
}
