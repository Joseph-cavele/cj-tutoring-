import { Schema, model, models, type Model, type Types } from 'mongoose';
import { ROLES, type Role } from './types';

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash?: string;
  role: Role;
  phone?: string;
  avatar?: { url: string; publicId: string };
  emailVerifiedAt?: Date;
  isActive: boolean;
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
    isActive: { type: Boolean, default: true },
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
