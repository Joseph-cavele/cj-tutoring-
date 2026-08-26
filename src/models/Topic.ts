import { Schema, model, models, type Model, type Types } from 'mongoose';

export interface ITopic {
  _id: Types.ObjectId;
  name: string;
  subject: Types.ObjectId;
  grade: Types.ObjectId;
  order: number;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const topicSchema = new Schema<ITopic>(
  {
    name: { type: String, required: true, trim: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    grade: { type: Schema.Types.ObjectId, ref: 'Grade', required: true, index: true },
    order: { type: Number, default: 0 },
    description: { type: String },
  },
  { timestamps: true }
);

// Materials and tests are browsed grade -> subject -> topic.
topicSchema.index({ grade: 1, subject: 1, order: 1 });

export const Topic: Model<ITopic> = models.Topic || model<ITopic>('Topic', topicSchema);
export default Topic;
