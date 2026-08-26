import { Schema, model, models, type Model, type Types } from 'mongoose';

import { DELIVERY_MODES, type DeliveryMode } from './types';

export const BOOKING_STATUS = ['new', 'contacted', 'scheduled', 'declined'] as const;
export type BookingStatus = (typeof BOOKING_STATUS)[number];

/**
 * A trial-lesson request from the public booking form.
 *
 * Deliberately not a Class: nothing is scheduled until a human confirms it
 * (CLAUDE.md section 7 has the admin or tutor create the actual lesson).
 */
export interface IBookingRequest {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone?: string;
  subjectSlug: string;
  grade: number;
  mode: DeliveryMode;
  preferredDate: Date;
  preferredTime: string;
  notes?: string;
  status: BookingStatus;
  createdAt: Date;
  updatedAt: Date;
}

const bookingRequestSchema = new Schema<IBookingRequest>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    phone: { type: String, trim: true },
    subjectSlug: { type: String, required: true },
    grade: { type: Number, required: true, min: 8, max: 12 },
    mode: { type: String, enum: DELIVERY_MODES, required: true },
    preferredDate: { type: Date, required: true },
    preferredTime: { type: String, required: true },
    notes: { type: String },
    status: { type: String, enum: BOOKING_STATUS, default: 'new', index: true },
  },
  { timestamps: true }
);

// The admin queue: newest unhandled requests first.
bookingRequestSchema.index({ status: 1, createdAt: -1 });

export const BookingRequest: Model<IBookingRequest> =
  models.BookingRequest || model<IBookingRequest>('BookingRequest', bookingRequestSchema);
export default BookingRequest;
