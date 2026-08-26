import { Schema, model, models, type Model, type Types } from 'mongoose';

import {
  DIFFICULTIES,
  TEST_STATUSES,
  type Difficulty,
  type TestStatus,
} from '@/lib/assessment/constants';

export {
  DIFFICULTIES,
  TEST_STATUSES,
  type Difficulty,
  type TestStatus,
} from '@/lib/assessment/constants';

/**
 * A test a tutor sets for their students.
 *
 * Questions live in their own collection rather than embedded here, because
 * the answer key has to be withheld from students. `Question.correctAnswer` is
 * `select: false`, which cannot be expressed on an embedded array without the
 * risk of a stray query returning the whole document - and "do not reveal
 * correct answers before submission" is the one thing this model must never
 * get wrong.
 */
export interface ITest {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  subject: Types.ObjectId;
  grade: Types.ObjectId;
  /** Free text, so a tutor can set a test on a topic nobody has catalogued. */
  topic?: string;
  difficulty: Difficulty;
  createdBy: Types.ObjectId;
  durationMinutes: number;
  totalMarks: number;
  passMark?: number;
  attemptsAllowed: number;
  availableFrom?: Date;
  availableUntil?: Date;
  status: TestStatus;
  /** True when the questions came from the AI, for the tutor's own record. */
  isAiGenerated: boolean;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const testSchema = new Schema<ITest>(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, maxlength: 1000 },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    grade: { type: Schema.Types.ObjectId, ref: 'Grade', required: true, index: true },
    topic: { type: String, trim: true, index: true },
    difficulty: { type: String, enum: DIFFICULTIES, default: 'medium' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    durationMinutes: { type: Number, required: true, min: 1 },
    totalMarks: { type: Number, default: 0, min: 0 },
    passMark: { type: Number, min: 0 },
    attemptsAllowed: { type: Number, default: 1, min: 1 },
    availableFrom: { type: Date },
    availableUntil: { type: Date },
    // Drafts are invisible to students. An AI-generated test starts here and
    // only a tutor can move it on (brief section 3).
    status: { type: String, enum: TEST_STATUSES, default: 'draft', index: true },
    isAiGenerated: { type: Boolean, default: false },
    publishedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// The student's "available tests" query, and the tutor's own list.
testSchema.index({ status: 1, grade: 1, subject: 1 });
testSchema.index({ createdBy: 1, status: 1, updatedAt: -1 });

export const Test: Model<ITest> = models.Test || model<ITest>('Test', testSchema);
export default Test;
