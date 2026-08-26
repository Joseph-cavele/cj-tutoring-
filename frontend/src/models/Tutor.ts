import { Schema, model, models, type Model, type Types } from 'mongoose';

import { DELIVERY_MODES, type DeliveryMode } from './types';

export interface ITutor {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  subjects: Types.ObjectId[];
  grades: Types.ObjectId[];
  bio?: string;
  qualifications?: string[];
  hourlyRate?: number;
  profileImage?: string;
  /** Modes this tutor will teach in. */
  teachingModes: DeliveryMode[];
  /** Admin switch: an inactive tutor takes no new bookings. */
  isActive: boolean;
  isVerified: boolean;
  rating?: number;
  createdAt: Date;
  updatedAt: Date;
}

const tutorSchema = new Schema<ITutor>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    subjects: [{ type: Schema.Types.ObjectId, ref: 'Subject', index: true }],
    grades: [{ type: Schema.Types.ObjectId, ref: 'Grade' }],
    bio: { type: String },
    qualifications: [{ type: String }],
    hourlyRate: { type: Number, min: 0 },
    profileImage: { type: String },
    teachingModes: [{ type: String, enum: DELIVERY_MODES, default: 'online' }],
    isActive: { type: Boolean, default: true, index: true },
    isVerified: { type: Boolean, default: false },
    rating: { type: Number, min: 0, max: 5 },
  },
  { timestamps: true }
);

export const Tutor: Model<ITutor> = models.Tutor || model<ITutor>('Tutor', tutorSchema);
export default Tutor;
