import { Schema, model, models, type Model, type Types } from 'mongoose';
import { APPROVAL_STATUS, ROLES, type ApprovalStatus, type Role } from './types';

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash?: string;
  role: Role;
  phone?: string;
  avatar?: { url: string; publicId: string };
  emailVerifiedAt?: Date;
  /** Where this account stands with the tutor. See APPROVAL_STATUS. */
  approvalStatus: ApprovalStatus;
  approvedAt?: Date;
  approvedBy?: Types.ObjectId;
  /** Why the tutor accepted or declined, shown to the applicant. */
  decisionNote?: string;
  isActive: boolean;
  /**
   * Sessions issued before this instant are refused at the next request.
   * Set when the password changes, so changing it signs out every device.
   */
  sessionsValidFrom?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    // Optional so OAuth accounts can exist without a password.
    passwordHash: { type: String, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'student', index: true },
    phone: { type: String, trim: true },
    avatar: { url: String, publicId: String },
    emailVerifiedAt: { type: Date },
    // Defaults to approved, not pending: documents written before this field
    // existed have no value for it, and they must keep signing in. Only
    // registerUser sets `pending`, explicitly.
    approvalStatus: {
      type: String,
      enum: APPROVAL_STATUS,
      default: 'approved',
      required: true,
      index: true,
    },
    approvedAt: { type: Date },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decisionNote: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    sessionsValidFrom: { type: Date },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

// Never leak the hash, even if a query forgets to deselect it.
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete (ret as { passwordHash?: string }).passwordHash;
    return ret;
  },
});

// `models.User ||` prevents OverwriteModelError when Next.js hot reload
// re-executes this module.
export const User: Model<IUser> = models.User || model<IUser>('User', userSchema);
export default User;
