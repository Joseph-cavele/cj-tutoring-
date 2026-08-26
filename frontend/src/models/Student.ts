import { Schema, model, models, type Model, type Types } from 'mongoose';

export interface IStudent {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  grade: Types.ObjectId;
  school?: string;
  dateOfBirth?: Date;
  // student_subjects and parent_students collapse into these arrays.
  subjects: Types.ObjectId[];
  parents: Types.ObjectId[];
  guardianPhone?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const studentSchema = new Schema<IStudent>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    grade: { type: Schema.Types.ObjectId, ref: 'Grade', required: true, index: true },
    school: { type: String, trim: true },
    dateOfBirth: { type: Date },
    subjects: [{ type: Schema.Types.ObjectId, ref: 'Subject', index: true }],
    parents: [{ type: Schema.Types.ObjectId, ref: 'Parent', index: true }],
    guardianPhone: { type: String, trim: true },
    notes: { type: String },
  },
  { timestamps: true }
);

export const Student: Model<IStudent> =
  models.Student || model<IStudent>('Student', studentSchema);
export default Student;
