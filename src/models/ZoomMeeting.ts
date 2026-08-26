import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * A Zoom meeting backing one lesson.
 *
 * Zoom runs the classroom (CLAUDE.md section 8); this record only stores what
 * is needed to join it. The host link and the passcode are `select: false` so
 * an ordinary query cannot return them by accident - handing a student the
 * start URL would let them take control of the meeting.
 */
export interface IZoomMeeting {
  _id: Types.ObjectId;
  /** The lesson this meeting is for. */
  booking?: Types.ObjectId | null;
  /** Legacy link to a scheduled group Class, kept for existing records. */
  class?: Types.ObjectId | null;
  meetingId: string;
  joinUrl: string;
  startUrl?: string;
  password?: string;
  hostEmail?: string;
  startsAt: Date;
  durationMinutes: number;
  recordingUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const zoomMeetingSchema = new Schema<IZoomMeeting>(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', default: null, index: true },
    class: { type: Schema.Types.ObjectId, ref: 'Class', default: null, index: true },
    meetingId: { type: String, required: true, unique: true, index: true },
    joinUrl: { type: String, required: true },
    // Host link grants control of the meeting, so it is never sent to students.
    startUrl: { type: String, select: false },
    password: { type: String, select: false },
    hostEmail: { type: String },
    startsAt: { type: Date, required: true },
    durationMinutes: { type: Number, default: 60, min: 1 },
    recordingUrl: { type: String },
  },
  { timestamps: true }
);

export const ZoomMeeting: Model<IZoomMeeting> =
  models.ZoomMeeting || model<IZoomMeeting>('ZoomMeeting', zoomMeetingSchema);
export default ZoomMeeting;
