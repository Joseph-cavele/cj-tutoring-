import { Schema, model, models, type Model, type Types } from 'mongoose';

import { ZOOM_MEETING_STATUS, type ZoomMeetingStatus } from './types';

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
  /** Set from verified Zoom webhook events, never from the app. */
  status: ZoomMeetingStatus;
  /** When the lesson actually started and ended, as opposed to when it was booked. */
  actualStartedAt?: Date;
  actualEndedAt?: Date;
  /** Who was in the room, built up from participant_joined / participant_left. */
  participants: {
    zoomUserId?: string;
    name?: string;
    email?: string;
    joinedAt?: Date;
    leftAt?: Date;
    minutes?: number;
  }[];
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
    status: {
      type: String,
      enum: ZOOM_MEETING_STATUS,
      default: 'scheduled',
      required: true,
      index: true,
    },
    actualStartedAt: { type: Date },
    actualEndedAt: { type: Date },
    // _id: false - these are plain sub-documents, not things to address on
    // their own, and an id per participant would only add noise.
    participants: {
      type: [
        new Schema(
          {
            zoomUserId: { type: String },
            name: { type: String },
            email: { type: String },
            joinedAt: { type: Date },
            leftAt: { type: Date },
            minutes: { type: Number, min: 0 },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export const ZoomMeeting: Model<IZoomMeeting> =
  models.ZoomMeeting || model<IZoomMeeting>('ZoomMeeting', zoomMeetingSchema);
export default ZoomMeeting;
