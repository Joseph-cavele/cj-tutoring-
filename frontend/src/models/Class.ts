import { Schema, model, models, type Model, type Types } from 'mongoose';
import { CLASS_STATUS, DELIVERY_MODES, type ClassStatus, type DeliveryMode } from './types';

export interface IClass {
  _id: Types.ObjectId;
  title: string;
  subject: Types.ObjectId;
  grade: Types.ObjectId;
  topic?: Types.ObjectId;
  // class_tutors and class_students collapse into these arrays.
  tutors: Types.ObjectId[];
  students: Types.ObjectId[];
  startsAt: Date;
  endsAt: Date;
  mode: DeliveryMode;
  status: ClassStatus;
  zoomMeeting?: Types.ObjectId;
  capacity?: number;
  createdAt: Date;
  updatedAt: Date;
}

const classSchema = new Schema<IClass>(
  {
    title: { type: String, required: true, trim: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    grade: { type: Schema.Types.ObjectId, ref: 'Grade', required: true, index: true },
    topic: { type: Schema.Types.ObjectId, ref: 'Topic' },
    tutors: [{ type: Schema.Types.ObjectId, ref: 'Tutor', index: true }],
    students: [{ type: Schema.Types.ObjectId, ref: 'Student', index: true }],
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    mode: { type: String, enum: DELIVERY_MODES, default: 'online' },
    status: { type: String, enum: CLASS_STATUS, default: 'scheduled', index: true },
    zoomMeeting: { type: Schema.Types.ObjectId, ref: 'ZoomMeeting' },
    capacity: { type: Number, min: 1 },
  },
  { timestamps: true }
);

// "My upcoming classes" is the most common query in every dashboard.
classSchema.index({ students: 1, startsAt: 1 });
classSchema.index({ tutors: 1, startsAt: 1 });

export const Class: Model<IClass> = models.Class || model<IClass>('Class', classSchema);
export default Class;
