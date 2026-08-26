import { Schema, model, models, type Model, type Types } from 'mongoose';

export interface INotification {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: string;
  title: string;
  body?: string;
  link?: string;
  channels: ('in_app' | 'email' | 'whatsapp')[];
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String },
    link: { type: String },
    channels: [{ type: String, enum: ['in_app', 'email', 'whatsapp'], default: 'in_app' }],
    readAt: { type: Date },
  },
  { timestamps: true }
);

// Unread badge and notification list both hit this.
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });

export const Notification: Model<INotification> =
  models.Notification || model<INotification>('Notification', notificationSchema);
export default Notification;
