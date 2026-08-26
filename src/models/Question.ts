import { Schema, model, models, type Model, type Types } from 'mongoose';

import { QUESTION_TYPES, type QuestionType } from '@/lib/assessment/constants';

export { QUESTION_TYPES, type QuestionType } from '@/lib/assessment/constants';

/**
 * One question on a test.
 *
 * `correctAnswer`, `explanation` and `rubric` are all `select: false`. A query
 * that forgets to exclude them cannot leak the answer key to a student
 * mid-test; the marking service asks for them explicitly.
 */
export interface IQuestion {
  _id: Types.ObjectId;
  test: Types.ObjectId;
  type: QuestionType;
  prompt: string;
  options: { key: string; text: string }[];
  correctAnswer: string;
  explanation?: string;
  /**
   * How marks are split on a written answer, one entry per mark
   * (brief section 8). Empty for anything marked deterministically.
   */
  rubric: { marks: number; criterion: string }[];
  marks: number;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const questionSchema = new Schema<IQuestion>(
  {
    test: { type: Schema.Types.ObjectId, ref: 'Test', required: true, index: true },
    type: { type: String, enum: QUESTION_TYPES, required: true },
    prompt: { type: String, required: true },
    options: [{ key: { type: String, required: true }, text: { type: String, required: true } }],
    // select: false so the answer key is never returned to a student by accident.
    correctAnswer: { type: String, required: true, select: false },
    explanation: { type: String, select: false },
    rubric: {
      type: [{ marks: { type: Number, required: true }, criterion: { type: String, required: true } }],
      default: [],
      select: false,
    },
    marks: { type: Number, default: 1, min: 0 },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

questionSchema.index({ test: 1, order: 1 });

export const Question: Model<IQuestion> =
  models.Question || model<IQuestion>('Question', questionSchema);
export default Question;
