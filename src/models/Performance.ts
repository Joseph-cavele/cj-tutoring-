import { Schema, model, models, type Model, type Types } from 'mongoose';

// Rolled-up metrics per student per subject per period. Recomputed from
// results and attendance rather than written directly by a request.
export interface IPerformance {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  subject: Types.ObjectId;
  period: string;
  averageScore: number;
  attendanceRate: number;
  assignmentsCompleted: number;
  assignmentsTotal: number;
  testsTaken: number;
  trend?: 'improving' | 'declining' | 'steady';
  strengths: string[];
  weaknesses: string[];
  computedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const performanceSchema = new Schema<IPerformance>(
  {
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    period: { type: String, required: true },
    averageScore: { type: Number, default: 0, min: 0, max: 100 },
    attendanceRate: { type: Number, default: 0, min: 0, max: 100 },
    assignmentsCompleted: { type: Number, default: 0, min: 0 },
    assignmentsTotal: { type: Number, default: 0, min: 0 },
    testsTaken: { type: Number, default: 0, min: 0 },
    trend: { type: String, enum: ['improving', 'declining', 'steady'] },
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    computedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

performanceSchema.index({ student: 1, subject: 1, period: 1 }, { unique: true });

export const Performance: Model<IPerformance> =
  models.Performance || model<IPerformance>('Performance', performanceSchema);
export default Performance;
