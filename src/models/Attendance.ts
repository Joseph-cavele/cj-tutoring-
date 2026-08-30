import { Schema, model, models, type Model, type Types } from 'mongoose';
import { ATTENDANCE_STATUS, type AttendanceStatus } from './types';

export interface IAttendance {
  _id: Types.ObjectId;
  /**
   * The lesson this record is for. Exactly one of `class` or `booking` is set:
   * `class` for a scheduled group class, `booking` for a one-to-one lesson.
   * Bookings are how lessons are actually created now, and without this field
   * a booked lesson could never be attended.
   */
  class?: Types.ObjectId | null;
  booking?: Types.ObjectId | null;
  student: Types.ObjectId;
  status: AttendanceStatus;
  joinedAt?: Date;
  leftAt?: Date;
  minutesAttended?: number;
  markedBy?: Types.ObjectId;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    class: { type: Schema.Types.ObjectId, ref: 'Class', default: null, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', default: null, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    status: { type: String, enum: ATTENDANCE_STATUS, required: true },
    joinedAt: { type: Date },
    leftAt: { type: Date },
    minutesAttended: { type: Number, min: 0 },
    markedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String },
  },
  { timestamps: true }
);

/**
 * One attendance record per student per lesson, whichever kind of lesson.
 *
 * Both are partial indexes. A plain unique index would treat every row whose
 * `class` is null as a duplicate of every other, so the moment two booking
 * records existed for one student the second would be rejected. Restricting
 * each index to rows where that field is actually set keeps the guarantee
 * where it means something and stays out of the way where it does not.
 */
attendanceSchema.index(
  { class: 1, student: 1 },
  { unique: true, partialFilterExpression: { class: { $type: 'objectId' } } }
);

attendanceSchema.index(
  { booking: 1, student: 1 },
  { unique: true, partialFilterExpression: { booking: { $type: 'objectId' } } }
);

/**
 * A record must belong to exactly one lesson, or attendance percentages start
 * counting rows attached to nothing.
 *
 * Document validation only, so it guards `create` and `save`. The webhook
 * writes through `updateOne` with an upsert, which skips this by design - it
 * sets both fields explicitly and needs to stay a single atomic write.
 */
attendanceSchema.pre('validate', function attachedToOneLesson() {
  const hasClass = Boolean(this.class);
  const hasBooking = Boolean(this.booking);

  if (hasClass === hasBooking) {
    throw new Error('Attendance must reference exactly one of class or booking');
  }
});

export const Attendance: Model<IAttendance> =
  models.Attendance || model<IAttendance>('Attendance', attendanceSchema);
export default Attendance;
