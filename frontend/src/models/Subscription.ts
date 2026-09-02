import { Schema, model, models, type Model, type Types } from 'mongoose';
import {
  DELIVERY_MODES,
  SUBSCRIPTION_STATUS,
  type DeliveryMode,
  type SubscriptionStatus,
} from './types';

export interface ISubscription {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  package: Types.ObjectId;
  status: SubscriptionStatus;
  /**
   * The mode this month was bought for.
   *
   * Online and in-person months cost different amounts, so a plan bought for
   * online lessons must not silently cover in-person ones. Copied from the
   * package at purchase, so a later change to the package cannot retroactively
   * widen what an already-sold month covers.
   */
  mode: DeliveryMode;
  sessionsTotal: number;
  sessionsUsed: number;
  startsAt: Date;
  expiresAt: Date;
  payment?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    package: { type: Schema.Types.ObjectId, ref: 'Package', required: true },
    status: { type: String, enum: SUBSCRIPTION_STATUS, default: 'pending', index: true },
    mode: { type: String, enum: DELIVERY_MODES, default: 'online', index: true },
    sessionsTotal: { type: Number, required: true, min: 0 },
    sessionsUsed: { type: Number, default: 0, min: 0 },
    startsAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true, index: true },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment' },
  },
  { timestamps: true }
);

subscriptionSchema.virtual('sessionsRemaining').get(function () {
  return Math.max(0, this.sessionsTotal - this.sessionsUsed);
});

// "Does this student have a month running right now" is the hot question:
// asked on every booking, on the attendance gate and on both dashboards.
subscriptionSchema.index({ student: 1, status: 1, expiresAt: -1 });

subscriptionSchema.set('toJSON', { virtuals: true });
subscriptionSchema.set('toObject', { virtuals: true });

export const Subscription: Model<ISubscription> =
  models.Subscription || model<ISubscription>('Subscription', subscriptionSchema);
export default Subscription;
