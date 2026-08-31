import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * A one-time code that links a parent to one specific child.
 *
 * This exists because of a rule in the brief: a parent must NOT be able to
 * reach a student by entering a student id. Ids are guessable, sequential-ish
 * and get shared; possession of one is not consent. An invite is the opposite
 * on every count - the tutor issues it deliberately, for one named student, it
 * expires, and it works exactly once.
 *
 * Only the SHA-256 of the code is stored, never the code, so a stolen database
 * cannot be used to claim other people's children. See `@/lib/parent-invite/code`.
 *
 * The `Parent.students` / `Student.parents` arrays remain the source of truth
 * for who may see whom. This model is the audit trail of how a link came to
 * exist, which is why a spent invite is kept rather than deleted.
 */
export interface IParentInvite {
  _id: Types.ObjectId;
  /** The child this code grants access to. Fixed at issue time. */
  student: Types.ObjectId;
  /** SHA-256 of the code that was handed over. Never the code itself. */
  codeHash: string;
  /** The tutor who issued it. */
  createdBy: Types.ObjectId;
  expiresAt: Date;
  /** Set the moment it is redeemed; its presence is what spends the code. */
  usedAt?: Date | null;
  /** The Parent profile that redeemed it. */
  usedBy?: Types.ObjectId | null;
  /** Withdrawn by the tutor before use. */
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const parentInviteSchema = new Schema<IParentInvite>(
  {
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    codeHash: { type: String, required: true, unique: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    usedBy: { type: Schema.Types.ObjectId, ref: 'Parent', default: null },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/**
 * Spent and expired invites are swept 30 days after they expire, not at
 * expiry: the record is the only evidence of how a parent came to be linked to
 * a child, and that is worth keeping for a while after the code stops working.
 *
 * The sweep is periodic, so `redeemParentInvite` still checks `expiresAt` on
 * every attempt rather than trusting the index to have run.
 */
parentInviteSchema.index(
  { expiresAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

/** The tutor's list for one student, newest first. */
parentInviteSchema.index({ student: 1, createdAt: -1 });

export const ParentInvite: Model<IParentInvite> =
  models.ParentInvite || model<IParentInvite>('ParentInvite', parentInviteSchema);
export default ParentInvite;
