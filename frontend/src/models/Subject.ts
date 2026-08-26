import { Schema, model, models, type Model, type Types } from 'mongoose';

export interface ISubject {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  /** Empty for subjects that are not tied to a school grade. */
  grades: Types.ObjectId[];
  /** Shown to tutors and on the booking form. */
  defaultDurationMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const subjectSchema = new Schema<ISubject>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String },
    grades: [{ type: Schema.Types.ObjectId, ref: 'Grade' }],
    defaultDurationMinutes: { type: Number, default: 60, min: 15 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const Subject: Model<ISubject> =
  models.Subject || model<ISubject>('Subject', subjectSchema);
export default Subject;
