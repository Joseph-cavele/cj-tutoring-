import { NextResponse } from 'next/server';

import { auth } from '@/auth';
import { chatRequestSchema } from '@/validations/ai-chat';
import { AiChatError, sendChatMessage } from '@/services/ai-chat.service';
import {
  AI_CHAT_ANON_RULES,
  AI_CHAT_RULES,
  callerIp,
  checkRateLimit,
  rateLimitHeaders,
  tooManyRequests,
} from '@/lib/rate-limit';

/**
 * POST /api/ai/chat - one turn of the AI Study Assistant.
 *
 * Open to signed-out visitors: someone deciding whether to book a lesson can
 * ask a Maths question first, and on a phone that is the whole point of the
 * widget. What they do NOT get is persistence - no conversation is created and
 * no message is stored for an anonymous caller, so there is no transcript from
 * an unidentified minor sitting in the database.
 *
 * The user id still comes from the session and never from the request body
 * (CLAUDE.md section 25): a signed-out caller cannot pass a conversationId to
 * reach somebody else's thread, because the anonymous path ignores it entirely.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Signed in: keyed by user, because a shared IP (a school computer lab)
  // must not throttle a whole class. Signed out: keyed by IP, on a tighter
  // allowance, because that is all an anonymous caller has.
  const rate = userId
    ? await checkRateLimit(`ai-chat:user:${userId}`, AI_CHAT_RULES)
    : await checkRateLimit(`ai-chat:ip:${callerIp(request)}`, AI_CHAT_ANON_RULES);

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
      userId,
      message: parsed.data.message,
      // Ignored on the anonymous path; there is no thread to continue.
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
