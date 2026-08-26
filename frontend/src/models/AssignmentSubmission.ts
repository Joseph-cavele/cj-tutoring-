import { Schema, model, models, type Model, type Types } from 'mongoose';
import { SUBMISSION_STATUS, cloudinaryFileFields, type SubmissionStatus } from './types';

export interface IAssignmentSubmission {
  _id: Types.ObjectId;
  assignment: Types.ObjectId;
  student: Types.ObjectId;
  status: SubmissionStatus;
  text?: string;
  files: { url: string; publicId: string; fileName?: string }[];
  submittedAt?: Date;
  score?: number;
  feedback?: string;
  gradedBy?: Types.ObjectId;
  gradedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const submissionSchema = new Schema<IAssignmentSubmission>(
  {
    assignment: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    status: { type: String, enum: SUBMISSION_STATUS, default: 'pending', index: true },
    text: { type: String },
    files: [cloudinaryFileFields],
    submittedAt: { type: Date },
    score: { type: Number, min: 0 },
    feedback: { type: String },
    gradedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    gradedAt: { type: Date },
  },
  { timestamps: true }
);

// One submission per student per assignment.
submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });

export const AssignmentSubmission: Model<IAssignmentSubmission> =
  models.AssignmentSubmission ||
  model<IAssignmentSubmission>('AssignmentSubmission', submissionSchema);
export default AssignmentSubmission;
