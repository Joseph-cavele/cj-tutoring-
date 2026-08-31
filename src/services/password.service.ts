import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

import { connectDB } from '@/lib/mongodb';
import { PasswordToken, User } from '@/models';
import type { TokenPurpose } from '@/models/PasswordToken';
import { EmailNotConfiguredError, sendMail } from '@/lib/email/mailer';

export class PasswordError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'PasswordError';
  }
}

const SALT_ROUNDS = 12;

/**
 * Token Time-To-Live.
 *
 * One-time password setup tokens (for tutor, student, parent account creation)
 * and invite tokens expire in 2 hours. Password reset tokens expire in 1 hour.
 */
const TTL_MS: Record<TokenPurpose, number> = {
  setup: 2 * 60 * 60 * 1000,
  reset: 60 * 60 * 1000,
  invite: 2 * 60 * 60 * 1000,
};

/** The emailed value: 32 random bytes, URL-safe. */
function makeToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/** Only the hash is ever stored or compared. */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Base site URL for email links.
 */
function resolveOrigin(origin?: string): string {
  const base = origin || process.env.NEXTAUTH_URL || 'https://cjprivatetutoring.co.za';
  return base.replace(/\/$/, '');
}

export function createPasswordLink(token: string, origin?: string): string {
  return `${resolveOrigin(origin)}/create-password?token=${encodeURIComponent(token)}`;
}

export function resetPasswordLink(token: string, origin?: string): string {
  return `${resolveOrigin(origin)}/reset-password?token=${encodeURIComponent(token)}`;
}

/**
 * Issues a one-time link and returns the plain token.
 *
 * Any outstanding token for the same user and purpose is deleted first, so a
 * password can only ever be set through the most recent link - an old email
 * forwarded to someone else stops working the moment a new one is requested.
 */
export async function issuePasswordToken(params: {
  userId: string;
  purpose: TokenPurpose;
}): Promise<string> {
  await connectDB();

  await PasswordToken.deleteMany({ user: params.userId, purpose: params.purpose });

  const token = makeToken();

  await PasswordToken.create({
    user: params.userId,
    tokenHash: hashToken(token),
    purpose: params.purpose,
    expiresAt: new Date(Date.now() + TTL_MS[params.purpose]),
  });

  return token;
}

/**
 * Sends a professional password setup email for newly created accounts
 * (tutors, students, and parents).
 */
export async function sendPasswordSetupEmail(params: {
  to: string;
  name: string;
  token: string;
  origin?: string;
  role?: string;
}) {
  const link = createPasswordLink(params.token, params.origin);
  const roleDisplay = params.role
    ? params.role.charAt(0).toUpperCase() + params.role.slice(1)
    : 'User';

  try {
    await sendMail({
      to: params.to,
      subject: 'Create your tutoring platform password',
      text: [
        `Hi ${params.name},`,
        '',
        'Your account has been created on the CJ Private Tutoring platform.',
        'Please click the link below to choose your password and activate your account:',
        '',
        link,
        '',
        'This link is valid for 2 hours and can only be used once.',
        '',
        'If you did not request this account, please ignore this email.',
        'Never share this link with anyone.',
        '',
        '--',
        'CJ Private Tutoring',
        'cjprivatetutoring.co.za',
      ].join('\n'),
    });
  } catch (error) {
    if (!(error instanceof EmailNotConfiguredError)) {
      console.error('[password] setup email failed', error);
    }
  }
}

/** The "you have been added" email for an account that never had a password. */
export async function sendInviteEmail(params: {
  to: string;
  name: string;
  token: string;
  origin?: string;
  invitedByName: string;
}) {
  const link = createPasswordLink(params.token, params.origin);

  try {
    await sendMail({
      to: params.to,
      subject: 'Create your tutoring platform password',
      text: [
        `Hi ${params.name},`,
        '',
        `${params.invitedByName} has added you to CJ Private Tutoring.`,
        '',
        'Choose a password to activate your account:',
        link,
        '',
        'This link works once and expires in 2 hours.',
        '',
        'If you were not expecting this, you can ignore this email.',
      ].join('\n'),
    });
  } catch (error) {
    if (!(error instanceof EmailNotConfiguredError)) {
      console.error('[password] invite email failed', error);
    }
  }
}

/**
 * Emails a reset link, if the address belongs to an account.
 *
 * Always resolves the same way whether or not the account exists. Telling a
 * caller "no such user" would turn this into a way to discover who has an
 * account here, so the difference is invisible from outside.
 */
export async function requestPasswordReset(params: { email: string; origin?: string }) {
  await connectDB();

  const email = params.email.toLowerCase().trim();
  const user = await User.findOne({ email }).select('_id name email isActive');

  // Silent no-op for unknown addresses, and for accounts an admin has
  // deactivated - a reset must not be a way back in past a suspension.
  if (!user || !user.isActive) return { sent: true };

  const token = await issuePasswordToken({
    userId: user._id.toString(),
    purpose: 'reset',
  });

  const link = resetPasswordLink(token, params.origin);

  try {
    await sendMail({
      to: user.email,
      subject: 'Reset your CJ Private Tutoring password',
      text: [
        `Hi ${user.name},`,
        '',
        'Someone asked to reset the password on your account. If that was you,',
        'choose a new one here:',
        link,
        '',
        'This link works once and expires in 1 hour.',
        '',
        'If it was not you, ignore this email. Your password has not changed.',
      ].join('\n'),
    });
  } catch (error) {
    if (!(error instanceof EmailNotConfiguredError)) {
      console.error('[password] reset email failed', error);
    }
  }

  return { sent: true };
}

export type TokenCheck = {
  valid: boolean;
  purpose: TokenPurpose | null;
  name: string | null;
};

/**
 * Whether a token can still be used, for rendering the form.
 *
 * Deliberately returns no user id: this is only enough to decide between "set
 * your password" and "this link has expired".
 */
export async function checkPasswordToken(token: string): Promise<TokenCheck> {
  await connectDB();

  if (!token) return { valid: false, purpose: null, name: null };

  const record = await PasswordToken.findOne({ tokenHash: hashToken(token) })
    .populate<{ user: { name: string } }>('user', 'name')
    .lean();

  if (!record) return { valid: false, purpose: null, name: null };

  // The TTL index sweeps periodically rather than instantly, so expiry is
  // checked here too.
  if (record.usedAt || record.expiresAt.getTime() < Date.now()) {
    return { valid: false, purpose: null, name: null };
  }

  return {
    valid: true,
    purpose: record.purpose,
    name: record.user?.name ?? null,
  };
}

/**
 * Sets a password from a valid token.
 *
 * The token identifies the account; no email or user id is accepted from the
 * request, so possessing a link for one account cannot change another's. The
 * token is consumed in the same operation, and sets passwordSet to true.
 */
export async function setPasswordWithToken(params: {
  token: string;
  password: string;
}) {
  await connectDB();

  const record = await PasswordToken.findOne({ tokenHash: hashToken(params.token) });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw new PasswordError(
      'Your password setup link is invalid or has expired. Please request a new link.',
      400
    );
  }

  const user = await User.findById(record.user).select('_id isActive approvalStatus passwordSet');

  if (!user) throw new PasswordError('That account no longer exists', 404);

  // Holding a link is not the same as being let in. This used to activate the
  // account and approve a pending one, which handed the applicant the decision
  // that belongs to the tutor, and let an outstanding reset link issued before
  // a suspension re-open the account. Only decideApplication opens a door.
  if (user.approvalStatus !== 'approved' || !user.isActive) {
    throw new PasswordError(
      'That account is not open yet, so its password cannot be set. Please contact us.',
      403
    );
  }

  const passwordHash = await bcrypt.hash(params.password, SALT_ROUNDS);

  user.passwordHash = passwordHash;
  user.passwordSet = true;
  user.sessionsValidFrom = new Date();

  await user.save();

  // Consumed, so the same link cannot be replayed.
  record.usedAt = new Date();
  await record.save();

  // Any other outstanding link for this account is now stale.
  await PasswordToken.deleteMany({ user: user._id, _id: { $ne: record._id } });

  return { purpose: record.purpose };
}
