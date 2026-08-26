import { Schema, model, models, type Model, type Types } from 'mongoose';
import {
  PAYMENT_PROVIDERS,
  PAYMENT_STATUS,
  type PaymentProvider,
  type PaymentStatus,
} from './types';

export interface IPayment {
  _id: Types.ObjectId;
  student: Types.ObjectId;
  /** The User who paid - `userId` in the brief. */
  paidBy: Types.ObjectId;
  /** Set when this payment buys one lesson rather than a package. */
  booking?: Types.ObjectId;
  package?: Types.ObjectId;
  subscription?: Types.ObjectId;
  provider: PaymentProvider;
  reference: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paidAt?: Date;
  // Raw gateway payload, kept for reconciliation and dispute handling.
  providerResponse?: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true, index: true },
    paidBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', index: true },
    package: { type: Schema.Types.ObjectId, ref: 'Package' },
    subscription: { type: Schema.Types.ObjectId, ref: 'Subscription' },
    provider: { type: String, enum: PAYMENT_PROVIDERS, required: true },
    // Unique so a replayed webhook cannot create a duplicate payment.
    reference: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NGN' },
    status: { type: String, enum: PAYMENT_STATUS, default: 'pending', index: true },
    paidAt: { type: Date },
    providerResponse: { type: Schema.Types.Mixed, select: false },
  },
  { timestamps: true }
);

export const Payment: Model<IPayment> =
  models.Payment || model<IPayment>('Payment', paymentSchema);
export default Payment;
