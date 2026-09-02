import { Schema, model, models, type Model, type Types } from 'mongoose';

import { DELIVERY_MODES, type DeliveryMode } from './types';

export interface ITutor {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  subjects: Types.ObjectId[];
  grades: Types.ObjectId[];
  bio?: string;
  qualifications?: string[];
  /**
   * Fallback hourly rate, used when no mode-specific rate is set.
   *
   * Kept because tutors created before per-mode pricing existed have only this
   * one number, and their lessons must keep pricing correctly.
   */
  hourlyRate?: number;
  /**
   * Hourly rate per delivery mode, in Rand.
   *
   * In-person costs more than online - travel and venue - so one rate cannot
   * price both. Stored per tutor rather than as a constant because pricing is
   * database driven (CLAUDE.md section 5) and the owner changes it without a
   * deploy. `hybrid` is absent on purpose: it describes what a tutor will
   * teach, never how a particular lesson is delivered, so every bookable
   * lesson resolves to online or in-person and prices from one of these.
   */
  hourlyRates?: {
    online?: number;
    in_person?: number;
  };
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
    hourlyRates: {
      online: { type: Number, min: 0 },
      in_person: { type: Number, min: 0 },
    },
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
