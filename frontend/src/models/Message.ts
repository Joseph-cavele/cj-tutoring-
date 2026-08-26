import { Schema, model, models, type Model, type Types } from 'mongoose';

export interface IMessage {
  _id: Types.ObjectId;
  sender: Types.ObjectId;
  recipient: Types.ObjectId;
  // Sorted pair of user ids, so both directions of a chat share one key.
  threadKey: string;
  body: string;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<IMessage>(
  {
    sender: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    threadKey: { type: String, required: true, index: true },
    body: { type: String, required: true },
    readAt: { type: Date },
  },
  { timestamps: true }
);

messageSchema.index({ threadKey: 1, createdAt: -1 });

export const Message: Model<IMessage> =
  models.Message || model<IMessage>('Message', messageSchema);
export default Message;
