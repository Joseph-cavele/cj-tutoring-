import { Schema, model, models, type Model, type Types } from 'mongoose';
import { cloudinaryFileFields } from './types';

export interface IStudyMaterial {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  grade: Types.ObjectId;
  subject: Types.ObjectId;
  topic?: Types.ObjectId;
  file: { url: string; publicId: string; fileName?: string; fileType?: string; bytes?: number };
  uploadedBy: Types.ObjectId;
  isPublished: boolean;
  downloads: number;
  createdAt: Date;
  updatedAt: Date;
}

const studyMaterialSchema = new Schema<IStudyMaterial>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    grade: { type: Schema.Types.ObjectId, ref: 'Grade', required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    topic: { type: Schema.Types.ObjectId, ref: 'Topic', index: true },
    file: { type: cloudinaryFileFields, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    isPublished: { type: Boolean, default: false },
    downloads: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Materials are browsed grade to subject to topic, per spec section 16.
studyMaterialSchema.index({ grade: 1, subject: 1, topic: 1 });

export const StudyMaterial: Model<IStudyMaterial> =
  models.StudyMaterial || model<IStudyMaterial>('StudyMaterial', studyMaterialSchema);
export default StudyMaterial;
