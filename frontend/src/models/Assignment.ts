import { Schema, model, models, type Model, type Types } from 'mongoose';
import { cloudinaryFileFields } from './types';

export interface IAssignment {
  _id: Types.ObjectId;
  title: string;
  instructions?: string;
  subject: Types.ObjectId;
  grade: Types.ObjectId;
  topic?: Types.ObjectId;
  class?: Types.ObjectId;
  createdBy: Types.ObjectId;
  assignedTo: Types.ObjectId[];
  attachments: { url: string; publicId: string; fileName?: string }[];
  dueAt: Date;
  maxScore: number;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const assignmentSchema = new Schema<IAssignment>(
  {
    title: { type: String, required: true, trim: true },
    instructions: { type: String },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    grade: { type: Schema.Types.ObjectId, ref: 'Grade', required: true, index: true },
    topic: { type: Schema.Types.ObjectId, ref: 'Topic' },
    class: { type: Schema.Types.ObjectId, ref: 'Class', index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: [{ type: Schema.Types.ObjectId, ref: 'Student', index: true }],
    attachments: [cloudinaryFileFields],
    dueAt: { type: Date, required: true, index: true },
    maxScore: { type: Number, default: 100, min: 0 },
    isPublished: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Assignment: Model<IAssignment> =
  models.Assignment || model<IAssignment>('Assignment', assignmentSchema);
export default Assignment;
