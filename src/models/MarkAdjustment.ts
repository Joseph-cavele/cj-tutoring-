import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * A record of a tutor overriding a mark (brief section 12).
 *
 * Append-only and never edited: the point is to be able to answer "who changed
 * this mark, from what, to what, and why" long after the fact, which a field
 * on the attempt that simply gets overwritten could not do.
 */
export interface IMarkAdjustment {
  _id: Types.ObjectId;
  attempt: Types.ObjectId;
  /** Null when the whole attempt's total was adjusted rather than one answer. */
  question?: Types.ObjectId | null;
  originalMarks: number;
  newMarks: number;
  changedBy: Types.ObjectId;
  reason: string;
  createdAt: Date;
  updatedAt: Date;
}

const markAdjustmentSchema = new Schema<IMarkAdjustment>(
  {
    attempt: { type: Schema.Types.ObjectId, ref: 'TestAttempt', required: true, index: true },
    question: { type: Schema.Types.ObjectId, ref: 'Question', default: null },
    originalMarks: { type: Number, required: true, min: 0 },
    newMarks: { type: Number, required: true, min: 0 },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reason: { type: String, required: true, maxlength: 500 },
  },
  { timestamps: true }
);

markAdjustmentSchema.index({ attempt: 1, createdAt: -1 });

export const MarkAdjustment: Model<IMarkAdjustment> =
  models.MarkAdjustment || model<IMarkAdjustment>('MarkAdjustment', markAdjustmentSchema);
export default MarkAdjustment;
