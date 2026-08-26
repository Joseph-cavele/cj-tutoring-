import { Schema, model, models, type Model, type Types } from 'mongoose';
import { SUBSCRIPTION_STATUS, type SubscriptionStatus } from './types';

export interface ISubscription {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  package: Types.ObjectId;
  status: SubscriptionStatus;
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

subscriptionSchema.set('toJSON', { virtuals: true });
subscriptionSchema.set('toObject', { virtuals: true });

export const Subscription: Model<ISubscription> =
  models.Subscription || model<ISubscription>('Subscription', subscriptionSchema);
export default Subscription;
