import { Schema, model, models, type Model, type Types } from 'mongoose';
import { ATTENDANCE_STATUS, type AttendanceStatus } from './types';

export interface IAttendance {
  _id: Types.ObjectId;
  class: Types.ObjectId;
  student: Types.ObjectId;
  status: AttendanceStatus;
  joinedAt?: Date;
  leftAt?: Date;
  minutesAttended?: number;
  markedBy?: Types.ObjectId;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    class: { type: Schema.Types.ObjectId, ref: 'Class', required: true, index: true },
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    status: { type: String, enum: ATTENDANCE_STATUS, required: true },
    joinedAt: { type: Date },
    leftAt: { type: Date },
    minutesAttended: { type: Number, min: 0 },
    markedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String },
  },
  { timestamps: true }
);

// One attendance record per student per class.
attendanceSchema.index({ class: 1, student: 1 }, { unique: true });

export const Attendance: Model<IAttendance> =
  models.Attendance || model<IAttendance>('Attendance', attendanceSchema);
export default Attendance;
