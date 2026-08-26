import { Schema, model, models, type Model, type Types } from 'mongoose';

// A published, student-visible outcome. Kept separate from TestAttempt so a
// tutor can moderate marks before releasing them.
export interface IResult {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  subject: Types.ObjectId;
  test?: Types.ObjectId;
  /** The attempt this result was published from. */
  attempt?: Types.ObjectId;
  assignment?: Types.ObjectId;
  score: number;
  maxScore: number;
  percentage: number;
  grade?: string;
  term?: string;
  /** Topic labels the marking flagged as weak, for the performance view. */
  weakAreas: string[];
  remarks?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const resultSchema = new Schema<IResult>(
  {
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    test: { type: Schema.Types.ObjectId, ref: 'Test' },
    attempt: { type: Schema.Types.ObjectId, ref: 'TestAttempt', index: true },
    assignment: { type: Schema.Types.ObjectId, ref: 'Assignment' },
    score: { type: Number, required: true, min: 0 },
    maxScore: { type: Number, required: true, min: 0 },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    grade: { type: String },
    term: { type: String, index: true },
    weakAreas: { type: [String], default: [] },
    remarks: { type: String },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

resultSchema.index({ student: 1, subject: 1, createdAt: -1 });

export const Result: Model<IResult> = models.Result || model<IResult>('Result', resultSchema);
export default Result;
