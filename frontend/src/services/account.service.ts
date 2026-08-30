import bcrypt from 'bcryptjs';

import { connectDB } from '@/lib/mongodb';
import { PasswordToken, User } from '@/models';
import type { SessionUser } from '@/lib/auth/guard';
import { notifyCredentialChange } from '@/services/notification.service';
import type { ChangeEmailInput, ChangePasswordInput } from '@/validations/account';

export class AccountError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'AccountError';
  }
}

const SALT_ROUNDS = 12;

/**
 * Self-service account settings.
 *
 * Everything here acts on the id in the session and nothing else, so there is
 * no way to aim these at another account: a user id in a request body is never
 * read (CLAUDE.md section 25).
 *
 * Both changes re-check the current password first. The session alone is not
 * proof of identity for a change this size - it survives an hour of a laptop
 * being left open, and either change would hand the account to whoever made it.
 */

/** Loads the account with its hash, or refuses. */
async function accountFor(user: SessionUser) {
  await connectDB();

  // passwordHash is select:false on the schema, so ask for it explicitly.
  const account = await User.findById(user.id).select(
    '+passwordHash name email sessionsValidFrom'
  );

  if (!account) throw new AccountError('Your account was not found', 404);

  if (!account.passwordHash) {
    throw new AccountError(
      'This account has no password yet. Use the forgot-password link to set one.',
      409
    );
  }

  return account;
}

/** Confirms the caller knows the current password. */
async function assertCurrentPassword(hash: string, candidate: string) {
  const matches = await bcrypt.compare(candidate, hash);

  if (!matches) throw new AccountError('That is not your current password', 403);
}

export async function changeMyEmail(user: SessionUser, input: ChangeEmailInput) {
  const account = await accountFor(user);

  await assertCurrentPassword(account.passwordHash as string, input.currentPassword);

  const email = input.email.toLowerCase().trim();
  const previousEmail = account.email;

  if (email === previousEmail) {
    throw new AccountError('That is already your email address', 400);
  }

  // Checked before writing rather than relying on the unique index, so the
  // user gets a sentence instead of a duplicate-key error.
  const taken = await User.findOne({ email }).select('_id');

  if (taken) throw new AccountError('Another account already uses that email', 409);

  account.email = email;
  // The new address has not been proved to belong to them, and the old
  // verification certainly does not carry over.
  account.emailVerifiedAt = undefined;
  await account.save();

  // Sent to the OLD address as well: if this change was not the owner's doing,
  // that is the only inbox they still control.
  await notifyCredentialChange({
    to: previousEmail,
    name: account.name,
    change: 'email',
    newEmail: email,
  });

  await notifyCredentialChange({
    to: email,
    name: account.name,
    change: 'email',
    newEmail: email,
  });

  return { email };
}

export async function changeMyPassword(user: SessionUser, input: ChangePasswordInput) {
  const account = await accountFor(user);

  await assertCurrentPassword(account.passwordHash as string, input.currentPassword);

  account.passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  // Every session issued before now stops working at its next request,
  // including the one making this change. A password is changed precisely
  // because it may be known to someone else, and leaving their session alive
  // would defeat the point.
  account.sessionsValidFrom = new Date();
  await account.save();

  // Any outstanding reset or invite link is now stale, and leaving one alive
  // would be a second way into an account whose password was just changed
  // precisely because it may have been known to someone else.
  await PasswordToken.deleteMany({ user: account._id });

  await notifyCredentialChange({
    to: account.email,
    name: account.name,
    change: 'password',
  });

  return { changed: true };
}
