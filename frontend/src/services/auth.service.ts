import bcrypt from 'bcryptjs';

import { connectDB } from '@/lib/mongodb';
import { Grade, Parent, Student, Tutor, User } from '@/models';
import { notifyAccountCreated } from '@/services/notification.service';
import type { RegisterInput } from '@/validations/auth';

export class RegistrationError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'RegistrationError';
  }
}

const SALT_ROUNDS = 12;

/**
 * Creates the User plus the profile document for their role.
 *
 * Business logic lives here rather than in the route handler (CLAUDE.md
 * section 27). Only student, parent and tutor can be created this way - an
 * admin is made deliberately, never by someone filling in a form.
 */
export async function registerUser(input: RegisterInput) {
  await connectDB();

  const email = input.email.toLowerCase().trim();

  const existing = await User.findOne({ email }).select('_id');

  if (existing) {
    throw new RegistrationError('An account with that email already exists', 409);
  }

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const user = await User.create({
    name: input.name,
    email,
    passwordHash,
    role: input.role,
    phone: input.phone || undefined,
    // Tutors stay inactive until an admin verifies them: an unvetted adult must
    // not reach students, and CLAUDE.md section 3 makes tutor a staff role.
    isActive: input.role !== 'tutor',
  });

  try {
    if (input.role === 'student') {
      const grade = await Grade.findOne({ level: input.grade }).select('_id');

      if (!grade) {
        throw new RegistrationError(
          'That grade is not available yet. Please contact us.',
          400
        );
      }

      await Student.create({ user: user._id, grade: grade._id });
    }

    if (input.role === 'parent') {
      await Parent.create({ user: user._id });
    }

    if (input.role === 'tutor') {
      await Tutor.create({ user: user._id, isVerified: false });
    }
  } catch (error) {
    // Without a profile the account is unusable, so do not leave a half-made
    // user behind for someone to sign in with.
    await User.deleteOne({ _id: user._id });
    throw error;
  }

  // Welcome email (CLAUDE.md section 23). The account already exists, so a
  // mail outage must not turn a successful registration into an error - the
  // notification service swallows and logs its own failures.
  await notifyAccountCreated({ to: email, name: user.name, role: user.role });

  return {
    id: user._id.toString(),
    role: user.role,
    // Tutors cannot sign in yet, so the UI needs to say so rather than send
    // them to a login that will reject them.
    requiresApproval: input.role === 'tutor',
  };
}
