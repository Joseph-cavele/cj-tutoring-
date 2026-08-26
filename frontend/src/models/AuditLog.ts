import { Schema, model, models, type Model, type Types } from 'mongoose';

export interface IAuditLog {
  _id: Types.ObjectId;
  actor?: Types.ObjectId;
  action: string;
  entity: string;
  entityId?: Types.ObjectId;
  changes?: unknown;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    // Optional: failed logins have no authenticated actor.
    actor: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId },
    changes: { type: Schema.Types.Mixed },
    ip: { type: String },
    userAgent: { type: String },
  },
  { timestamps: true }
);

auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

export const AuditLog: Model<IAuditLog> =
  models.AuditLog || model<IAuditLog>('AuditLog', auditLogSchema);
export default AuditLog;
