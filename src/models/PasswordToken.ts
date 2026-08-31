import { Schema, model, models, type Model, type Types } from 'mongoose';

export const TOKEN_PURPOSES = ['setup', 'reset', 'invite'] as const;
export type TokenPurpose = (typeof TOKEN_PURPOSES)[number];

/**
 * A one-time link for setting a password.
 *
 * Three uses, one mechanism:
 * - `setup` for newly created accounts (tutor, student, parent) choosing their first password.
 * - `reset` for someone who forgot theirs.
 * - `invite` for an account created on someone else's behalf.
 *
 * Only a SHA-256 hash of the token is stored. The plain value exists in the
 * emailed URL and nowhere else, so a leaked database cannot be used to seize
 * accounts - which is the whole point of storing it this way rather than as
 * plain text.
 */
export interface IPasswordToken {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  /** SHA-256 of the token that was emailed. Never the token itself. */
  tokenHash: string;
  purpose: TokenPurpose;
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const passwordTokenSchema = new Schema<IPasswordToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    purpose: { type: String, enum: TOKEN_PURPOSES, required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/**
 * Mongo removes the document once it expires, so spent links do not accumulate
 * forever. The sweep is periodic rather than instant, which is why the service
 * still checks `expiresAt` on every use rather than trusting the index.
 */
passwordTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordToken: Model<IPasswordToken> =
  models.PasswordToken || model<IPasswordToken>('PasswordToken', passwordTokenSchema);
export default PasswordToken;
