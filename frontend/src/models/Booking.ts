import { Schema, model, models, type Model, type Types } from 'mongoose';

import { DELIVERY_MODES, type DeliveryMode } from './types';
import {
  BOOKING_PAYMENT_STATUSES,
  BOOKING_STATUSES,
  type BookingPaymentStatus,
  type BookingStatus,
} from '@/lib/booking/constants';

/**
 * The enums live in `@/lib/booking/constants` because client components need
 * them and this module imports Mongoose. Re-exported here so server code can
 * keep importing them alongside the model.
 */
export {
  ACTIVE_BOOKING_STATUSES,
  ATTENDANCE_ALLOWED,
  BOOKING_PAYMENT_STATUSES,
  BOOKING_STATUSES,
  PAYMENT_SETTLED,
  slotKey,
  type BookingPaymentStatus,
  type BookingStatus,
} from '@/lib/booking/constants';

export interface IBooking {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  /** Null when a student booked for themselves. */
  parent?: Types.ObjectId | null;
  tutor: Types.ObjectId;
  subject: Types.ObjectId;
  /** Local calendar day, stored at midnight UTC. */
  date: Date;
  /** 24-hour "HH:mm" in South African local time. */
  startTime: string;
  endTime: string;
  durationMinutes: number;
  teachingMode: DeliveryMode;
  notes?: string;
  status: BookingStatus;
  /** Rand, copied from the tutor's rate at booking time so a later rate change
   *  does not rewrite the price of a lesson already sold. */
  amount: number;
  currency: string;
  paymentStatus: BookingPaymentStatus;
  payment?: Types.ObjectId | null;
  /**
   * The monthly plan this lesson was drawn from, when it was.
   *
   * Set together with `paymentStatus: 'covered'`. Keeping the link means a
   * cancelled lesson can hand its credit back to the right plan, and the owner
   * can show which four lessons a month actually bought.
   */
  subscription?: Types.ObjectId | null;
  zoomMeeting?: Types.ObjectId | null;
  /** Who changed the status last, and when - kept for disputes. */
  decidedBy?: Types.ObjectId | null;
  decidedAt?: Date | null;
  /** Tutor's reason, shown to the student on a rejection. */
  decisionNote?: string | null;
  /**
   * Reservation keys, one per slot the lesson covers.
   *
   * Unique multikey indexes: MongoDB rejects a second document that shares
   * ANY element with an existing one, so two concurrent requests cannot both
   * take the same slot even when they pass the availability read together
   * (booking rules 1 and 2). Unset - not emptied - when the booking is
   * cancelled or rejected, because a sparse index still indexes an empty
   * array and every released booking would then collide on it.
   */
  tutorSlotKeys?: string[];
  studentSlotKeys?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<IBooking>(
  {
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    parent: { type: Schema.Types.ObjectId, ref: 'Parent', default: null, index: true },
    tutor: { type: Schema.Types.ObjectId, ref: 'Tutor', required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    date: { type: Date, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    durationMinutes: { type: Number, required: true, min: 15 },
    teachingMode: { type: String, enum: DELIVERY_MODES, required: true },
    notes: { type: String, maxlength: 1000 },
    // Always pending on creation (booking rule 6). The status is never
    // accepted from the client.
    status: { type: String, enum: BOOKING_STATUSES, default: 'pending', index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'ZAR' },
    paymentStatus: {
      type: String,
      enum: BOOKING_PAYMENT_STATUSES,
      default: 'pending',
      index: true,
    },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', default: null },
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription', default: null },
    zoomMeeting: { type: Schema.Types.ObjectId, ref: 'ZoomMeeting', default: null },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    decidedAt: { type: Date, default: null },
    decisionNote: { type: String, maxlength: 500, default: null },
    tutorSlotKeys: { type: [String], default: undefined },
    studentSlotKeys: { type: [String], default: undefined },
  },
  { timestamps: true }
);

bookingSchema.index({ tutorSlotKeys: 1 }, { unique: true, sparse: true });
bookingSchema.index({ studentSlotKeys: 1 }, { unique: true, sparse: true });

// Dashboard queries: a tutor's day, a student's upcoming lessons, the queue.
bookingSchema.index({ tutor: 1, date: 1, startTime: 1 });
bookingSchema.index({ student: 1, date: -1 });
bookingSchema.index({ tutor: 1, status: 1, date: 1 });

export const Booking: Model<IBooking> =
  models.Booking || model<IBooking>('Booking', bookingSchema);
export default Booking;
