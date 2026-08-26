import { Schema, model, models, type Model, type Types } from 'mongoose';

export interface IParent {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  // Replaces the parent_students join table.
  students: Types.ObjectId[];
  relationship?: string;
  createdAt: Date;
  updatedAt: Date;
}

const parentSchema = new Schema<IParent>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    students: [{ type: Schema.Types.ObjectId, ref: 'Student', index: true }],
    relationship: { type: String, trim: true },
  },
  { timestamps: true }
);

export const Parent: Model<IParent> = models.Parent || model<IParent>('Parent', parentSchema);
export default Parent;
