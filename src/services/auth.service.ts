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
 *
 * Every self-registration is an application, not an account. It is written
 * `pending` and inactive, and the tutor decides (see application.service).
 * A tutoring business takes on minors, so who gets through the door is the
 * tutor's call rather than whoever completes a form.
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
    // Nobody signs in on the strength of filling in a form. isActive is what
    // src/auth.ts actually checks at login; approvalStatus is why.
    approvalStatus: 'pending',
    isActive: false,
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
    // Nobody can sign in yet, so the form must say so rather than send them to
    // a login that would reject them with no explanation.
    requiresApproval: true,
  };
}
