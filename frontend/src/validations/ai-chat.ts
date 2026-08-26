import { z } from 'zod';

/** Mongo ObjectId as it arrives over the wire. */
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

/**
 * Body of POST /api/ai/chat. All API input is validated before it reaches
 * the service (CLAUDE.md section 27).
 */
export const chatRequestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message is too long'),
  // Omitted on the first message of a new conversation.
  conversationId: objectId.optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
