import { Schema, model, models, type Model, type Types } from 'mongoose';

export interface IAiConversation {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  subject?: Types.ObjectId;
  topic?: Types.ObjectId;
  title: string;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const aiConversationSchema = new Schema<IAiConversation>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: 'Subject' },
    topic: { type: Schema.Types.ObjectId, ref: 'Topic' },
    title: { type: String, default: 'New conversation' },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

aiConversationSchema.index({ user: 1, lastMessageAt: -1 });

export const AiConversation: Model<IAiConversation> =
  models.AiConversation || model<IAiConversation>('AiConversation', aiConversationSchema);
export default AiConversation;
