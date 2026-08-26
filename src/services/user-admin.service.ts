import { connectDB } from '@/lib/mongodb';
import { Parent, Student, Tutor, User } from '@/models';
import type { Role } from '@/models/types';
import type { UserQueryInput } from '@/validations/user';

export class UserAdminError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'UserAdminError';
  }
}

/**
 * Admin management of accounts and the links between them.
 *
 * The guards here are the point of the module. A schema can check that a role
 * is one of four strings; it cannot check that changing it would leave the
 * platform with no administrator, or that the person clicking is about to lock
 * themselves out. Those live in this layer, above the database and below the UI.
 */

export type AdminUserProfile =
  | {
      kind: 'student';
      studentId: string;
      gradeName: string;
      parents: { parentId: string; name: string }[];
    }
  | { kind: 'parent'; parentId: string; children: { studentId: string; name: string }[] }
  | { kind: 'tutor'; tutorId: string; isVerified: boolean; isActive: boolean; subjectCount: number }
  | { kind: 'admin' }
  /** A profile document that should exist but does not. */
  | { kind: 'missing'; expected: Role };

export type AdminUserView = {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  profile: AdminUserProfile;
};

/** Escapes a user's search text so it cannot inject regex syntax. */
function literalRegex(value: string): RegExp {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

/**
 * Accounts, with the profile document each role should have.
 *
 * Profiles are fetched in bulk per role rather than per user, so a page of a
 * hundred accounts is a handful of queries rather than a hundred.
 */
export async function listUsersForAdmin(input: UserQueryInput): Promise<AdminUserView[]> {
  await connectDB();

  const filter: Record<string, unknown> = {};

  if (input.role) filter.role = input.role;

  if (input.query) {
    const pattern = literalRegex(input.query);
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const users = await User.find(filter).sort({ createdAt: -1 }).limit(100).lean();

  const userIds = users.map((user) => user._id);

  const [students, parents, tutors] = await Promise.all([
    Student.find({ user: { $in: userIds } })
      .populate<{ grade: { name: string } }>('grade', 'name')
      .select('user grade parents')
      .lean(),
    Parent.find({ user: { $in: userIds } }).select('user students').lean(),
    Tutor.find({ user: { $in: userIds } })
      .select('user subjects isVerified isActive')
      .lean(),
  ]);

  // Names for the linked records on the other side of each relationship.
  const relatedStudentIds = parents.flatMap((parent) => parent.students);
  const relatedParentIds = students.flatMap((student) => student.parents ?? []);

  const [relatedStudents, relatedParents] = await Promise.all([
    Student.find({ _id: { $in: relatedStudentIds } })
      .populate<{ user: { name: string } }>('user', 'name')
      .select('user')
      .lean(),
    Parent.find({ _id: { $in: relatedParentIds } })
      .populate<{ user: { name: string } }>('user', 'name')
      .select('user')
      .lean(),
  ]);

  const studentName = new Map(
    relatedStudents.map((student) => [student._id.toString(), student.user?.name ?? 'Student'])
  );
  const parentName = new Map(
    relatedParents.map((parent) => [parent._id.toString(), parent.user?.name ?? 'Parent'])
  );

  const studentByUser = new Map(students.map((row) => [row.user.toString(), row]));
  const parentByUser = new Map(parents.map((row) => [row.user.toString(), row]));
  const tutorByUser = new Map(tutors.map((row) => [row.user.toString(), row]));

  return users.map((user) => {
    const id = user._id.toString();

    let profile: AdminUserProfile = { kind: 'missing', expected: user.role };

    if (user.role === 'admin') {
      profile = { kind: 'admin' };
    } else if (user.role === 'student') {
      const student = studentByUser.get(id);

      if (student) {
        profile = {
          kind: 'student',
          studentId: student._id.toString(),
          gradeName: student.grade?.name ?? 'Grade not set',
          parents: (student.parents ?? []).map((parentId) => ({
            parentId: parentId.toString(),
            name: parentName.get(parentId.toString()) ?? 'Parent',
          })),
        };
      }
    } else if (user.role === 'parent') {
      const parent = parentByUser.get(id);

      if (parent) {
        profile = {
          kind: 'parent',
          parentId: parent._id.toString(),
          children: parent.students.map((studentId) => ({
            studentId: studentId.toString(),
            name: studentName.get(studentId.toString()) ?? 'Student',
          })),
        };
      }
    } else if (user.role === 'tutor') {
      const tutor = tutorByUser.get(id);

      if (tutor) {
        profile = {
          kind: 'tutor',
          tutorId: tutor._id.toString(),
          isVerified: tutor.isVerified,
          isActive: tutor.isActive,
          subjectCount: (tutor.subjects ?? []).length,
        };
      }
    }

    return {
      userId: id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      profile,
    };
  });
}

/** Every student, for the "link a child" picker. */
export async function listAllStudents() {
  await connectDB();

  const students = await Student.find()
    .populate<{ user: { name: string; email: string } }>('user', 'name email')
    .populate<{ grade: { name: string } }>('grade', 'name')
    .select('user grade')
    .sort({ createdAt: -1 })
    .limit(300)
    .lean();

  return students.map((student) => ({
    studentId: student._id.toString(),
    name: student.user?.name ?? 'Student',
    email: student.user?.email ?? '',
    gradeName: student.grade?.name ?? '',
  }));
}

/**
 * Links a parent to a student.
 *
 * The relationship is stored on both documents - `Parent.students` and
 * `Student.parents` - and every authorization check reads one or the other, so
 * writing only one side would leave a parent who can see a child on one screen
 * and not another. `$addToSet` makes repeating the call harmless.
 */
export async function linkParentToStudent(params: { parentId: string; studentId: string }) {
  await connectDB();

  const [parent, student] = await Promise.all([
    Parent.findById(params.parentId).select('_id'),
    Student.findById(params.studentId).select('_id'),
  ]);

  if (!parent) throw new UserAdminError('That parent was not found', 404);
  if (!student) throw new UserAdminError('That student was not found', 404);

  await Promise.all([
    Parent.updateOne({ _id: parent._id }, { $addToSet: { students: student._id } }),
    Student.updateOne({ _id: student._id }, { $addToSet: { parents: parent._id } }),
  ]);

  return { linked: true };
}

/** Removes the link from both sides. Bookings already made are untouched. */
export async function unlinkParentFromStudent(params: {
  parentId: string;
  studentId: string;
}) {
  await connectDB();

  await Promise.all([
    Parent.updateOne({ _id: params.parentId }, { $pull: { students: params.studentId } }),
    Student.updateOne({ _id: params.studentId }, { $pull: { parents: params.parentId } }),
  ]);

  return { unlinked: true };
}

/** How many administrators could still sign in if this one changed. */
async function otherActiveAdmins(excludingUserId: string): Promise<number> {
  return User.countDocuments({
    role: 'admin',
    isActive: true,
    _id: { $ne: excludingUserId },
  });
}

/**
 * Enables or disables sign-in for an account.
 *
 * Refused for your own account, and refused when it would leave no active
 * administrator - both are ways to lock everyone out of the platform with a
 * single click, and neither has an undo from inside the app.
 */
export async function setUserActive(params: {
  userId: string;
  isActive: boolean;
  actingUserId: string;
}) {
  await connectDB();

  if (params.userId === params.actingUserId) {
    throw new UserAdminError('You cannot deactivate your own account', 400);
  }

  const user = await User.findById(params.userId).select('role isActive');

  if (!user) throw new UserAdminError('That account was not found', 404);

  if (!params.isActive && user.role === 'admin') {
    const remaining = await otherActiveAdmins(params.userId);

    if (remaining === 0) {
      throw new UserAdminError(
        'That is the only active administrator. Promote someone else first.',
        409
      );
    }
  }

  user.isActive = params.isActive;
  await user.save();

  return { userId: params.userId, isActive: params.isActive };
}

/**
 * Changes a user's role, creating the profile the new role needs.
 *
 * Student is the one role this will not create, because a Student requires a
 * grade and guessing one would put a child in the wrong class. Old profile
 * documents are kept rather than deleted: they carry bookings, results and
 * attendance that must stay readable.
 */
export async function changeUserRole(params: {
  userId: string;
  role: Role;
  actingUserId: string;
}) {
  await connectDB();

  if (params.userId === params.actingUserId) {
    throw new UserAdminError('You cannot change your own role', 400);
  }

  const user = await User.findById(params.userId).select('role');

  if (!user) throw new UserAdminError('That account was not found', 404);
  if (user.role === params.role) return { userId: params.userId, role: params.role };

  if (user.role === 'admin') {
    const remaining = await otherActiveAdmins(params.userId);

    if (remaining === 0) {
      throw new UserAdminError(
        'That is the only active administrator. Promote someone else first.',
        409
      );
    }
  }

  if (params.role === 'student') {
    const existing = await Student.findOne({ user: user._id }).select('_id');

    if (!existing) {
      throw new UserAdminError(
        'A student needs a grade, which cannot be guessed. Ask them to register as a student instead.',
        409
      );
    }
  }

  if (params.role === 'parent') {
    await Parent.findOneAndUpdate(
      { user: user._id },
      { $setOnInsert: { user: user._id, students: [] } },
      { upsert: true }
    );
  }

  if (params.role === 'tutor') {
    // Created unverified, exactly as a self-registration would be, so a
    // promotion is not a way around the approval step.
    await Tutor.findOneAndUpdate(
      { user: user._id },
      { $setOnInsert: { user: user._id, isVerified: false, isActive: true } },
      { upsert: true }
    );
  }

  user.role = params.role;
  await user.save();

  return { userId: params.userId, role: params.role };
}
