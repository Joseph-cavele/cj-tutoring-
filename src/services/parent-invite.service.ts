import { connectDB } from '@/lib/mongodb';
import { Parent, ParentInvite, Student } from '@/models';
import { isStaff } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/guard';
import {
  formatInviteCode,
  generateInviteCode,
  hashInviteCode,
  inviteExpiryFrom,
  normaliseInviteCode,
} from '@/lib/parent-invite/code';

export class ParentInviteError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ParentInviteError';
  }
}

/**
 * Issuing and redeeming parent invitation codes (brief section 2).
 *
 * The point is to give a parent a way to reach their own child WITHOUT
 * accepting a student id from the browser. Nothing here looks a student up by
 * an id the client sent:
 *
 *   - issuing:   the tutor names the student, and the tutor is staff
 *   - redeeming: the student is read OFF THE INVITE, never off the request
 *
 * That second line is the security property. A parent redeeming a code cannot
 * influence which child they get: they get the one the tutor bound to that
 * code when it was issued.
 */

export type InviteView = {
  inviteId: string;
  studentId: string;
  studentName: string;
  createdAt: string;
  expiresAt: string;
  status: 'active' | 'used' | 'expired' | 'revoked';
  /** Who redeemed it, when somebody has. */
  usedByName: string | null;
};

function statusOf(invite: {
  usedAt?: Date | null;
  revokedAt?: Date | null;
  expiresAt: Date;
}): InviteView['status'] {
  if (invite.usedAt) return 'used';
  if (invite.revokedAt) return 'revoked';
  if (invite.expiresAt.getTime() <= Date.now()) return 'expired';
  return 'active';
}

/**
 * The tutor issues a code for one student.
 *
 * Returns the plain code EXACTLY ONCE. It is never stored and can never be
 * shown again, so the UI has to make the tutor copy it there and then - the
 * same contract as an API key. Losing it costs nothing: issue another.
 */
export async function createParentInvite(params: {
  user: SessionUser;
  studentId: string;
}): Promise<{ inviteId: string; code: string; expiresAt: Date; studentName: string }> {
  await connectDB();

  // Re-checked here, not only at the action, because a service is reachable
  // from anywhere (CLAUDE.md section 25).
  if (!isStaff(params.user.role)) {
    throw new ParentInviteError('Only the tutor can invite a parent', 403);
  }

  const student = await Student.findById(params.studentId)
    .populate<{ user: { name: string } }>('user', 'name')
    .select('user')
    .lean();

  if (!student) throw new ParentInviteError('That student was not found', 404);

  const code = generateInviteCode();

  const invite = await ParentInvite.create({
    student: student._id,
    codeHash: hashInviteCode(code),
    createdBy: params.user.id,
    expiresAt: inviteExpiryFrom(),
  });

  return {
    inviteId: invite._id.toString(),
    code: formatInviteCode(code),
    expiresAt: invite.expiresAt,
    studentName: student.user?.name ?? 'Student',
  };
}

/** Every invite issued for a student, for the tutor list. Never any codes. */
export async function listParentInvites(params: {
  user: SessionUser;
  studentId: string;
}): Promise<InviteView[]> {
  await connectDB();

  if (!isStaff(params.user.role)) {
    throw new ParentInviteError('Only the tutor can see invitations', 403);
  }

  const invites = await ParentInvite.find({ student: params.studentId })
    .populate<{ student: { user: { name: string } } }>({
      path: 'student',
      select: 'user',
      populate: { path: 'user', select: 'name' },
    })
    .populate<{ usedBy: { user: { name: string } } | null }>({
      path: 'usedBy',
      select: 'user',
      populate: { path: 'user', select: 'name' },
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return invites.map((invite) => ({
    inviteId: invite._id.toString(),
    studentId: params.studentId,
    studentName: invite.student?.user?.name ?? 'Student',
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
    status: statusOf(invite),
    usedByName: invite.usedBy?.user?.name ?? null,
  }));
}

/** Withdraws an unused code. A code already redeemed cannot be un-redeemed. */
export async function revokeParentInvite(params: {
  user: SessionUser;
  inviteId: string;
}): Promise<{ revoked: boolean }> {
  await connectDB();

  if (!isStaff(params.user.role)) {
    throw new ParentInviteError('Only the tutor can withdraw an invitation', 403);
  }

  const result = await ParentInvite.updateOne(
    { _id: params.inviteId, usedAt: null, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  if (result.matchedCount === 0) {
    throw new ParentInviteError('That invitation is already used or withdrawn', 409);
  }

  return { revoked: true };
}

export type RedeemOutcome = {
  studentId: string;
  studentName: string;
  /** True when the link already existed, so no code was spent. */
  alreadyLinked: boolean;
};

/**
 * A parent redeems a code, linking themselves to the child it names.
 *
 * Reads as a sequence of refusals on purpose. Each one is a different failure
 * a real parent can hit, and each gets its own message: an honest parent whose
 * code expired needs to be told that, not handed a blank "invalid".
 *
 * That is safe here BECAUSE the code carries 50 bits of entropy and redemption
 * is rate limited at the action. There is no enumeration attack for the
 * messages to leak anything to. If the code were short or sequential, these
 * would have to collapse into one vague error.
 */
export async function redeemParentInvite(params: {
  user: SessionUser;
  code: string;
}): Promise<RedeemOutcome> {
  await connectDB();

  if (params.user.role !== 'parent') {
    throw new ParentInviteError('Only a parent account can use an invitation code', 403);
  }

  const canonical = normaliseInviteCode(params.code);

  if (!canonical) {
    throw new ParentInviteError(
      'That does not look like an invitation code. It is 10 characters, like ABCDE-FGHJK.',
      400
    );
  }

  const parent = await Parent.findOne({ user: params.user.id }).select('_id students');

  if (!parent) throw new ParentInviteError('Your parent profile is not set up yet', 409);

  const invite = await ParentInvite.findOne({ codeHash: hashInviteCode(canonical) });

  if (!invite) {
    throw new ParentInviteError(
      'We do not recognise that code. Please check it with your tutor.',
      404
    );
  }

  if (invite.revokedAt) {
    throw new ParentInviteError(
      'That invitation was withdrawn. Ask your tutor for a new one.',
      409
    );
  }

  if (invite.usedAt) {
    throw new ParentInviteError('That code has already been used.', 409);
  }

  if (invite.expiresAt.getTime() <= Date.now()) {
    throw new ParentInviteError('That code has expired. Ask your tutor for a new one.', 409);
  }

  const student = await Student.findById(invite.student)
    .populate<{ user: { name: string } }>('user', 'name')
    .select('user')
    .lean();

  const studentName = student?.user?.name ?? 'your child';

  // Already linked - by an earlier code, or by the tutor doing it by hand.
  // Answered as success and WITHOUT spending the code, so a parent who clicks
  // twice does not burn an invitation they may still need.
  const alreadyLinked = parent.students.some(
    (studentId) => studentId.toString() === invite.student.toString()
  );

  if (alreadyLinked) {
    return { studentId: invite.student.toString(), studentName, alreadyLinked: true };
  }

  /**
   * Claim the code atomically.
   *
   * The checks above are for MESSAGES; this is for CORRECTNESS. Two parents
   * racing on one code both pass those checks, so the `usedAt: null` condition
   * inside the update is what makes exactly one of them win. Mongo matches and
   * writes in a single operation, leaving no window between deciding and
   * spending.
   */
  const claimed = await ParentInvite.findOneAndUpdate(
    { _id: invite._id, usedAt: null, revokedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date(), usedBy: parent._id } },
    { returnDocument: 'after' }
  );

  if (!claimed) {
    throw new ParentInviteError(
      'That code has just been used. Ask your tutor for a new one.',
      409
    );
  }

  /**
   * Both sides of the link, because different authorization checks read
   * different sides - `bookingScopeFor` reads Parent.students, the account
   * screens read Student.parents. Writing one only would produce a parent who
   * can see a child on one page and not another.
   */
  await Promise.all([
    Parent.updateOne({ _id: parent._id }, { $addToSet: { students: invite.student } }),
    Student.updateOne({ _id: invite.student }, { $addToSet: { parents: parent._id } }),
  ]);

  return { studentId: invite.student.toString(), studentName, alreadyLinked: false };
}

/** Students the tutor can issue an invitation for, newest first. */
export async function listStudentsForInvite(user: SessionUser) {
  await connectDB();

  if (!isStaff(user.role)) {
    throw new ParentInviteError('Only the tutor can invite a parent', 403);
  }

  const students = await Student.find()
    .populate<{ user: { name: string } }>('user', 'name')
    .populate<{ grade: { name: string } }>('grade', 'name')
    .select('user grade parents')
    .sort({ createdAt: -1 })
    .limit(300)
    .lean();

  return students.map((student) => ({
    studentId: student._id.toString(),
    name: student.user?.name ?? 'Student',
    gradeName: student.grade?.name ?? '',
    linkedParents: (student.parents ?? []).length,
  }));
}
