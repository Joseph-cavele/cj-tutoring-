import { Schema, model, models, type Model, type Types } from 'mongoose';

import {
  ATTEMPT_STATUSES,
  MARK_SOURCES,
  type AttemptStatus,
  type MarkSource,
} from '@/lib/assessment/constants';

export {
  ATTEMPT_STATUSES,
  MARK_SOURCES,
  type AttemptStatus,
  type MarkSource,
} from '@/lib/assessment/constants';

/**
 * One student's answer to one question, with how it was marked.
 *
 * An answer has no meaning outside its attempt and is always read with it, so
 * a subdocument avoids a second query and keeps the attempt atomic.
 */
export interface IAnswer {
  question: Types.ObjectId;
  response: string;
  isCorrect?: boolean;
  marksAwarded?: number;
  /** Capped at the question's marks when written, never taken from the AI. */
  maxMarks?: number;
  /** Which mechanism produced the mark - deterministic, AI, or a tutor. */
  markedBy?: MarkSource;
  /** Student-facing comment. For AI marking this is its summary, not its prompt. */
  feedback?: string;
}

export interface ITestAttempt {
  _id: Types.ObjectId;
  test: Types.ObjectId;
  student: Types.ObjectId;
  attemptNumber: number;
  answers: IAnswer[];
  status: AttemptStatus;
  startedAt: Date;
  /** When the timer runs out, computed on the server at start. */
  expiresAt?: Date;
  submittedAt?: Date;
  /** True when the server submitted it because time ran out. */
  autoSubmitted: boolean;
  score?: number;
  totalMarks?: number;
  percentage?: number;
  isPassed?: boolean;
  /** Overall comment shown to the student. */
  feedback?: string;
  /** Topics the marking flagged as weak, used by the performance view. */
  weakAreas: string[];
  markedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const answerSchema = new Schema<IAnswer>(
  {
    question: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    response: { type: String, default: '' },
    isCorrect: { type: Boolean },
    marksAwarded: { type: Number, min: 0 },
    maxMarks: { type: Number, min: 0 },
    markedBy: { type: String, enum: MARK_SOURCES },
    feedback: { type: String },
  },
  { _id: false }
);

const testAttemptSchema = new Schema<ITestAttempt>(
  {
    test: { type: Schema.Types.ObjectId, ref: 'Test', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    attemptNumber: { type: Number, default: 1, min: 1 },
    answers: [answerSchema],
    status: { type: String, enum: ATTEMPT_STATUSES, default: 'in_progress', index: true },
    startedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date },
    submittedAt: { type: Date },
    autoSubmitted: { type: Boolean, default: false },
    score: { type: Number, min: 0 },
    totalMarks: { type: Number, min: 0 },
    percentage: { type: Number, min: 0, max: 100 },
    isPassed: { type: Boolean },
    feedback: { type: String },
    weakAreas: { type: [String], default: [] },
    markedAt: { type: Date },
  },
  { timestamps: true }
);

// Enforces attemptsAllowed at the database level rather than by a read-then-write.
testAttemptSchema.index({ test: 1, student: 1, attemptNumber: 1 }, { unique: true });

export const TestAttempt: Model<ITestAttempt> =
  models.TestAttempt || model<ITestAttempt>('TestAttempt', testAttemptSchema);
export default TestAttempt;
