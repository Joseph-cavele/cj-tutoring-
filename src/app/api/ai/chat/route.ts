import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { chatRequestSchema } from '@/validations/ai-chat';
import { AiChatError, sendChatMessage } from '@/services/ai-chat.service';
import {
  AI_CHAT_RULES,
  checkRateLimit,
  rateLimitHeaders,
  tooManyRequests,
} from '@/lib/rate-limit';

/**
 * POST /api/ai/chat - one turn of the AI Study Assistant.
 *
 * Authorization happens here, not in the browser (CLAUDE.md section 25).
 * The user id comes from the session, never from the request body.
 */
export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Keyed by user, not IP: every call costs Gemini tokens, and a shared IP
  // (a school computer lab) must not throttle a whole class.
  const rate = await checkRateLimit(`ai-chat:${session.user.id}`, AI_CHAT_RULES);

  if (!rate.allowed) {
    return tooManyRequests(rate);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid request',
        issues: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  try {
    const result = await sendChatMessage({
      userId: session.user.id,
      message: parsed.data.message,
      conversationId: parsed.data.conversationId,
    });

    return NextResponse.json(result, { headers: rateLimitHeaders(rate) });
  } catch (error) {
    if (error instanceof AiChatError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: rateLimitHeaders(rate) }
      );
    }

    // Never leak internals to the client; the detail stays in the server log.
    console.error('[ai/chat] unexpected error', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
