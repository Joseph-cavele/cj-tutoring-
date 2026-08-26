import { Schema, model, models, type Model, type Types } from 'mongoose';

export interface IGrade {
  _id: Types.ObjectId;
  name: string;
  level: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const gradeSchema = new Schema<IGrade>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    level: { type: Number, required: true, unique: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const Grade: Model<IGrade> = models.Grade || model<IGrade>('Grade', gradeSchema);
export default Grade;
