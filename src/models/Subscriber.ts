import { Schema, model, models, type Model, type Types } from 'mongoose';

/**
 * Newsletter signup from the footer.
 *
 * POPIA treats a marketing list as personal information, so the record keeps
 * proof of when consent was given and an unsubscribe token, rather than just
 * an address.
 */
export interface ISubscriber {
  _id: Types.ObjectId;
  email: string;
  source: string;
  isActive: boolean;
  unsubscribeToken: string;
  unsubscribedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const subscriberSchema = new Schema<ISubscriber>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    source: { type: String, default: 'footer' },
    isActive: { type: Boolean, default: true },
    unsubscribeToken: { type: String, required: true },
    unsubscribedAt: { type: Date },
  },
  { timestamps: true }
);

export const Subscriber: Model<ISubscriber> =
  models.Subscriber || model<ISubscriber>('Subscriber', subscriberSchema);
export default Subscriber;
