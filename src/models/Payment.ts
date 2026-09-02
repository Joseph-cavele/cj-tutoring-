import { Schema, model, models, type Model, type Types } from 'mongoose';
import {
  PAYMENT_METHODS,
  PAYMENT_PLANS,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUS,
  type PaymentMethod,
  type PaymentPlan,
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
  /**
   * Which plan this money bought: one lesson, or a month of them.
   *
   * Stored rather than inferred from whether `booking` or `package` is set,
   * because the owner filters and totals by plan and an inferred column cannot
   * be indexed. Existing rows have neither field changed, so the default keeps
   * every historical single-lesson payment reading correctly.
   */
  plan: PaymentPlan;
  /**
   * How the money arrived.
   *
   * `provider` stays as the gateway that processed it, which only means
   * anything for `paystack`. Cash and EFT have no provider at all - they are
   * recorded by the tutor from a bank statement or a handful of notes.
   */
  method: PaymentMethod;
  provider?: PaymentProvider;
  /** The staff user who entered a cash or EFT payment. Never set online. */
  recordedBy?: Types.ObjectId;
  /** Free text for a manual payment: a bank reference, "paid at the door". */
  note?: string;
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
    plan: { type: String, enum: PAYMENT_PLANS, default: 'per_lesson', index: true },
    method: { type: String, enum: PAYMENT_METHODS, default: 'paystack', index: true },
    // Required only for a gateway payment. A cash payment has no provider, and
    // forcing one would mean writing 'paystack' on money Paystack never saw.
    provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      required: function (this: { method?: PaymentMethod }) {
        return this.method === 'paystack';
      },
    },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, maxlength: 500 },
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

// The owner's payment table filters by status and sorts by date; the student's
// history reads their own rows newest first.
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ student: 1, createdAt: -1 });

export const Payment: Model<IPayment> =
  models.Payment || model<IPayment>('Payment', paymentSchema);
export default Payment;
