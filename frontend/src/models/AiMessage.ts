import { Schema, model, models, type Model, type Types } from 'mongoose';

// Kept as its own collection rather than embedded: conversations grow
// unbounded and would eventually hit the 16MB document limit.
export interface IAiMessage {
  _id: Types.ObjectId;
  conversation: Types.ObjectId;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokens?: number;
  createdAt: Date;
  updatedAt: Date;
}

const aiMessageSchema = new Schema<IAiMessage>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'AiConversation',
      required: true,
      index: true,
    },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true },
    tokens: { type: Number, min: 0 },
  },
  { timestamps: true }
);

aiMessageSchema.index({ conversation: 1, createdAt: 1 });

export const AiMessage: Model<IAiMessage> =
  models.AiMessage || model<IAiMessage>('AiMessage', aiMessageSchema);
export default AiMessage;
