import { Schema, model, models, type Model, type Types } from 'mongoose';

import { DELIVERY_MODES, type DeliveryMode } from './types';

// WEEKDAYS lives in lib so client components can label days without
// importing this module, which pulls in Mongoose.
export { WEEKDAYS } from '@/lib/booking/constants';

/**
 * A recurring weekly window in which a tutor will teach.
 *
 * One document per day per window, so a tutor can offer 09:00-12:00 and
 * 14:00-17:00 on the same day without modelling gaps inside a single row.
 */
export interface IAvailability {
  _id: Types.ObjectId;
  tutor: Types.ObjectId;
  /** 0-6, Sunday first. */
  dayOfWeek: number;
  /** 24-hour "HH:mm", local South African time. */
  startTime: string;
  endTime: string;
  /** Length of one lesson in this window; slots are cut to this size. */
  slotMinutes: number;
  teachingMode: DeliveryMode;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const availabilitySchema = new Schema<IAvailability>(
  {
    tutor: { type: Schema.Types.ObjectId, ref: 'Tutor', required: true, index: true },
    dayOfWeek: { type: Number, required: true, min: 0, max: 6 },
    startTime: { type: String, required: true, match: TIME_PATTERN },
    // endTime must be after startTime. Enforced in validations/availability.ts
    // rather than here: a Mongoose validator cannot read a sibling field
    // reliably across both document and query validation.
    endTime: { type: String, required: true, match: TIME_PATTERN },
    slotMinutes: { type: Number, default: 60, min: 15, max: 240 },
    teachingMode: { type: String, enum: DELIVERY_MODES, default: 'online' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

availabilitySchema.index({ tutor: 1, dayOfWeek: 1, startTime: 1 });

export const Availability: Model<IAvailability> =
  models.Availability || model<IAvailability>('Availability', availabilitySchema);
export default Availability;
