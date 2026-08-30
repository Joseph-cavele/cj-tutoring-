import { Schema, model, models, type Model, type Types } from 'mongoose';
import { LESSON_PROGRESS, type LessonProgress } from '@/lib/lessons/constants';

export { LESSON_PROGRESS, type LessonProgress };

/**
 * What happened in a lesson, written up by the tutor afterwards.
 *
 * The booking is the source of truth for *scheduling* - when, who, which
 * subject, online or in person. This model is the record of the teaching:
 * what was covered, what was set as homework, how the student did.
 *
 * Attendance is deliberately NOT a field here. It lives in the `Attendance`
 * collection, keyed by (booking, student) with a unique partial index, and the
 * Zoom webhook upserts into it during the lesson. Storing a second copy on the
 * lesson would give attendance two homes that disagree the moment the tutor
 * edits one of them. The post-lesson form writes both records in one action
 * instead - see `recordLesson` in `lesson.service`.
 */
export interface ILesson {
  _id: Types.ObjectId;
  /** The booking this lesson fulfils. One lesson record per booking. */
  booking: Types.ObjectId;
  /**
   * Copied from the booking at write time.
   *
   * Denormalised so "every lesson for this student in September" is a single
   * indexed query rather than a join through bookings. Bookings never change
   * hands once taught, so these cannot drift.
   */
  student: Types.ObjectId;
  tutor: Types.ObjectId;
  subject: Types.ObjectId;
  /** Local calendar day of the lesson, midnight UTC, mirroring Booking.date. */
  date: Date;
  durationMinutes: number;
  /** What was covered. Shown to the student and to a linked parent. */
  notes?: string;
  /** What was set. Shown to the student and to a linked parent. */
  homework?: string;
  progress?: LessonProgress;
  /**
   * Whether the tutor considers the write-up finished.
   *
   * A lesson can be saved half-written - a tutor typing notes between lessons
   * should not lose them - so this is what reports count, not mere existence.
   */
  completed: boolean;
  /** The tutor who wrote it up, kept for audit alongside AuditLog. */
  recordedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const lessonSchema = new Schema<ILesson>(
  {
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    tutor: { type: Schema.Types.ObjectId, ref: 'Tutor', required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    date: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 1 },
    notes: { type: String, trim: true, maxlength: 5000 },
    homework: { type: String, trim: true, maxlength: 5000 },
    progress: { type: String, enum: LESSON_PROGRESS },
    completed: { type: Boolean, default: false, index: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

/**
 * The two queries the app actually makes: a student's lesson history newest
 * first, and the tutor's own write-up backlog. Both sort descending on date,
 * so the index carries the sort and Mongo never has to hold the set in memory.
 */
lessonSchema.index({ student: 1, date: -1 });
lessonSchema.index({ tutor: 1, date: -1 });

export const Lesson: Model<ILesson> = models.Lesson || model<ILesson>('Lesson', lessonSchema);
export default Lesson;
