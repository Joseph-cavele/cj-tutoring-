import { Types } from 'mongoose';

import { connectDB } from '@/lib/mongodb';
import { AiConversation, AiMessage } from '@/models';
import { AI_MODEL, SYSTEM_INSTRUCTION, getGeminiClient } from '@/lib/ai/gemini';

/** How much prior turn-taking to replay as context. */
const HISTORY_LIMIT = 20;

/**
 * One turn against the model.
 *
 * Shared by the signed-in and signed-out paths so both get the same system
 * instruction and the same error handling - an assistant that behaved
 * differently depending on whether you were logged in would be two products.
 */
async function askModel(
  // `system` is in the stored role union; Gemini has no system turn in
  // `contents`, so it folds into `user` exactly as it did before, with the
  // real system instruction passed separately in config.
  history: { role: 'user' | 'assistant' | 'system'; content: string }[],
  message: string
): Promise<string> {
  const contents = [
    ...history.map((entry) => ({
      role: entry.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: entry.content }],
    })),
    { role: 'user' as const, parts: [{ text: message }] },
  ];

  let reply: string;

  try {
    const response = await getGeminiClient().models.generateContent({
      model: AI_MODEL,
      contents,
      config: { systemInstruction: SYSTEM_INSTRUCTION },
    });

    reply = response.text?.trim() ?? '';
  } catch (error) {
    // Provider errors can carry quota and account detail, so they stay in the
    // server log.
    console.error('[ai-chat] provider request failed', error);
    throw new AiChatError('The assistant is unavailable right now. Please try again.', 502);
  }

  if (!reply) {
    // Safety filters and token limits can both produce an empty candidate.
    throw new AiChatError('The assistant returned an empty response. Try rephrasing.', 502);
  }

  return reply;
}

export class AiChatError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'AiChatError';
  }
}

type SendMessageInput = {
  /** null for a signed-out visitor, whose turn is never stored. */
  userId: string | null;
  message: string;
  conversationId?: string;
};

type SendMessageResult = {
  /** null for a signed-out visitor - there is no thread to come back to. */
  conversationId: string | null;
  reply: string;
};

/**
 * Runs one turn of the AI Study Assistant (CLAUDE.md section 17).
 *
 * Business logic lives here rather than in the route handler or the UI
 * (section 27), and every query is scoped by userId so one student can never
 * read another conversation (section 25).
 *
 * A signed-out visitor gets a single-turn answer: nothing is written, and no
 * history is replayed. There is no account to file the conversation under, and
 * storing anonymous transcripts would collect personal detail from minors that
 * nobody asked for and nobody could later delete on request.
 */
export async function sendChatMessage({
  userId,
  message,
  conversationId,
}: SendMessageInput): Promise<SendMessageResult> {
  if (!userId) {
    // No conversation, no history, no writes.
    return { conversationId: null, reply: await askModel([], message) };
  }

  await connectDB();

  const conversation = conversationId
    ? // Scoping by user here is the authorization check.
      await AiConversation.findOne({ _id: conversationId, user: userId })
    : await AiConversation.create({
        user: userId,
        // First message doubles as the conversation title in the sidebar.
        title: message.slice(0, 60),
      });

  if (!conversation) {
    throw new AiChatError('Conversation not found', 404);
  }

  const history = await AiMessage.find({ conversation: conversation._id })
    .sort({ createdAt: -1 })
    .limit(HISTORY_LIMIT)
    .lean();

  // Newest-first for the limit, oldest-first for the model.
  const orderedHistory = history.reverse();

  await AiMessage.create({
    conversation: conversation._id,
    role: 'user',
    content: message,
  });

  const reply = await askModel(
    orderedHistory.map((entry) => ({ role: entry.role, content: entry.content })),
    message
  );

  await AiMessage.create({
    conversation: conversation._id,
    role: 'assistant',
    content: reply,
  });

  conversation.lastMessageAt = new Date();
  await conversation.save();

  return {
    conversationId: (conversation._id as Types.ObjectId).toString(),
    reply,
  };
}
