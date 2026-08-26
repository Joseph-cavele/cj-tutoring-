import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * One counter per key per fixed window.
 *
 * Stored in MongoDB rather than process memory because serverless spawns many
 * instances: an in-memory counter would let a caller multiply their quota by
 * the number of running instances.
 */
export interface IRateLimit {
  _id: Types.ObjectId;
  key: string;
  windowStart: Date;
  count: number;
  expiresAt: Date;
}

const rateLimitSchema = new Schema<IRateLimit>(
  {
    key: { type: String, required: true },
    windowStart: { type: Date, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false, versionKey: false }
);

// One counter per key per window, and the uniqueness makes the upsert atomic.
rateLimitSchema.index({ key: 1, windowStart: 1 }, { unique: true });

// MongoDB removes expired counters on its own, so the collection stays small.
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimit: Model<IRateLimit> =
  models.RateLimit || model<IRateLimit>('RateLimit', rateLimitSchema);
export default RateLimit;
