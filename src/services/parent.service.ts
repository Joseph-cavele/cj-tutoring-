import { connectDB } from '@/lib/mongodb';
import {
  Attendance,
  Class,
  Grade,
  Invoice,
  Parent,
  Result,
  Student,
  Subscription,
  User,
} from '@/models';
import { EmailNotConfiguredError } from '@/lib/email/mailer';
import { issuePasswordToken, sendInviteEmail } from '@/services/password.service';
import type { AddChildInput } from '@/validations/lesson-booking';

export class ParentError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ParentError';
  }
}

/**
 * Read-only view of a linked child, for the parent dashboard.
 *
 * CLAUDE.md section 3: parents view attendance, performance, results, upcoming
 * lessons and payment information, and reach no administrative function.
 */
export type ChildOverview = {
  studentId: string;
  name: string;
  gradeName: string;
  attendance: {
    attended: number;
    total: number;
    /** Null when no lessons have been recorded yet. */
    percentage: number | null;
  };
  performance: {
    averagePercentage: number | null;
    resultCount: number;
  };
  balance: {
    /** Rand still owed on issued invoices. */
    outstanding: number;
    currency: string;
    unpaidInvoices: number;
  };
  subscription: {
    packageName: string;
    sessionsRemaining: number;
    expiresAt: Date;
  } | null;
  nextLesson: {
    title: string;
    startsAt: Date;
  } | null;
};

/**
 * Everything the signed-in parent may see.
 *
 * Every query is scoped by the parent record found from their own user id, so
 * a parent can only ever read their own children (CLAUDE.md section 25). No id
 * is accepted from the client.
 */
export async function getParentOverview(userId: string): Promise<ChildOverview[]> {
  await connectDB();

  const parent = await Parent.findOne({ user: userId }).select('students').lean();

  if (!parent || parent.students.length === 0) return [];

  const students = await Student.find({ _id: { $in: parent.students } })
    .populate<{ user: { name: string } }>('user', 'name')
    .populate<{ grade: { name: string } }>('grade', 'name')
    .lean();

  const overviews: ChildOverview[] = [];

  for (const student of students) {
    const [attendanceRows, results, invoices, subscription, nextClass] = await Promise.all([
      Attendance.find({ student: student._id }).select('status').lean(),
      Result.find({ student: student._id, publishedAt: { $ne: null } })
        .select('percentage')
        .lean(),
      Invoice.find({ student: student._id, paidAt: { $exists: false } })
        .select('total currency')
        .lean(),
      Subscription.findOne({ student: student._id, status: 'active' })
        .populate<{ package: { name: string } }>('package', 'name')
        .sort({ expiresAt: -1 })
        .lean(),
      Class.findOne({ students: student._id, startsAt: { $gte: new Date() } })
        .select('title startsAt')
        .sort({ startsAt: 1 })
        .lean(),
    ]);

    // Late still counts as attended: the student was in the lesson.
    const attended = attendanceRows.filter(
      (row) => row.status === 'present' || row.status === 'late'
    ).length;
    const total = attendanceRows.length;

    const averagePercentage =
      results.length > 0
        ? Math.round(results.reduce((sum, row) => sum + row.percentage, 0) / results.length)
        : null;

    const outstanding = invoices.reduce((sum, invoice) => sum + invoice.total, 0);

    overviews.push({
      studentId: student._id.toString(),
      name: student.user?.name ?? 'Student',
      gradeName: student.grade?.name ?? 'Grade not set',
      attendance: {
        attended,
        total,
        percentage: total > 0 ? Math.round((attended / total) * 100) : null,
      },
      performance: { averagePercentage, resultCount: results.length },
      balance: {
        outstanding,
        currency: invoices[0]?.currency ?? 'ZAR',
        unpaidInvoices: invoices.length,
      },
      subscription: subscription
        ? {
            packageName: subscription.package?.name ?? 'Package',
            sessionsRemaining: Math.max(
              0,
              subscription.sessionsTotal - subscription.sessionsUsed
            ),
            expiresAt: subscription.expiresAt,
          }
        : null,
      nextLesson: nextClass
        ? { title: nextClass.title, startsAt: nextClass.startsAt }
        : null,
    });
  }

  return overviews;
}

/** True when the parent account exists but no child has been linked yet. */
export async function parentHasNoChildren(userId: string): Promise<boolean> {
  await connectDB();
  const parent = await Parent.findOne({ user: userId }).select('students').lean();
  return !parent || parent.students.length === 0;
}

/** Used by the empty state so a parent knows who to contact. */
export async function getParentName(userId: string): Promise<string> {
  await connectDB();
  const user = await User.findById(userId).select('name').lean();
  return user?.name ?? '';
}

/**
 * A parent adds a child to their own account (brief section 4).
 *
 * The child gets a real account they own: created without a password and
 * unable to sign in, then emailed a one-time invite link where they choose
 * their own. The parent never sets or learns their child's credentials.
 *
 * The parent can book for them immediately, because booking authorization
 * reads the parent-student link rather than the child's sign-in state.
 */
export async function addChildForParent(params: {
  userId: string;
  input: AddChildInput;
  origin: string;
}) {
  await connectDB();

  const parent = await Parent.findOne({ user: params.userId }).select('_id');

  if (!parent) throw new ParentError('Your parent profile is not set up yet', 409);

  const email = params.input.email.toLowerCase().trim();

  const existing = await User.findOne({ email }).select('_id');

  if (existing) {
    // Deliberately refused rather than linked. Linking an existing account by
    // email alone would let anyone claim any student whose address they know.
    throw new ParentError(
      'That email already has an account. Ask the office to link it to you.',
      409
    );
  }

  const grade = await Grade.findOne({ level: params.input.gradeLevel }).select('_id');

  if (!grade) throw new ParentError('That grade is not available yet', 400);

  const parentUser = await User.findById(params.userId).select('name');

  const childUser = await User.create({
    name: params.input.name,
    email,
    role: 'student',
    phone: params.input.phone || undefined,
    // No password, and cannot sign in until the invite is accepted.
    isActive: false,
  });

  let student;

  try {
    student = await Student.create({ user: childUser._id, grade: grade._id });
  } catch (error) {
    // Without a Student record the account is unusable, so do not leave a
    // half-made user behind.
    await User.deleteOne({ _id: childUser._id });
    throw error;
  }

  // Both sides of the link, because different checks read different sides.
  await Promise.all([
    Parent.updateOne({ _id: parent._id }, { $addToSet: { students: student._id } }),
    Student.updateOne({ _id: student._id }, { $addToSet: { parents: parent._id } }),
  ]);

  let invited = false;

  try {
    const token = await issuePasswordToken({
      userId: childUser._id.toString(),
      purpose: 'invite',
    });

    await sendInviteEmail({
      to: email,
      name: params.input.name,
      token,
      origin: params.origin,
      invitedByName: parentUser?.name ?? 'Your parent',
    });

    invited = true;
  } catch (error) {
    if (!(error instanceof EmailNotConfiguredError)) {
      console.error('[parent] invite email failed', error);
    }
    // The child is added and bookable either way; the caller is told the
    // invitation did not go out so they can ask for it to be resent.
  }

  return {
    studentId: student._id.toString(),
    name: params.input.name,
    invited,
  };
}
