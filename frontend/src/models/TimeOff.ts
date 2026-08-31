import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * A single date the tutor is not teaching (brief section 27, "unavailable").
 *
 * `Availability` is a recurring weekly pattern - "Mondays, 14:00 to 17:00" -
 * and it has no way to say "but not this Monday". Without that, a public
 * holiday or a week away means deleting the weekly windows and remembering to
 * put them back, and a student can book straight through anything forgotten.
 *
 * One document per tutor per date. The date is stored at midnight UTC so it is
 * one stable key, matching `Booking.date` and `toDateOnly` in the slot library.
 *
 * Marking a day off does NOT cancel lessons already booked on it. A confirmed
 * lesson is an agreement with a family, and silently dropping it because the
 * tutor blocked the day would be the wrong default - the action reports the
 * clash instead and leaves the decision to a human.
 */
export interface ITimeOff {
  _id: Types.ObjectId;
  tutor: Types.ObjectId;
  /** Local calendar day at midnight UTC. */
  date: Date;
  /** Shown on the calendar, e.g. "Public holiday". */
  reason?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const timeOffSchema = new Schema<ITimeOff>(
  {
    tutor: { type: Schema.Types.ObjectId, ref: 'Tutor', required: true, index: true },
    date: { type: Date, required: true },
    reason: { type: String, trim: true, maxlength: 120 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

/**
 * One entry per tutor per day. Unique so marking the same day twice - a double
 * click, or two tabs - cannot produce duplicates the calendar would render on
 * top of each other.
 */
timeOffSchema.index({ tutor: 1, date: 1 }, { unique: true });

export const TimeOff: Model<ITimeOff> =
  models.TimeOff || model<ITimeOff>('TimeOff', timeOffSchema);
export default TimeOff;
