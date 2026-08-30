import { NextResponse } from 'next/server';

import { urlValidationResponse, verifySignature, webhookSecret } from '@/lib/zoom/webhook';
import { handleZoomEvent, type ZoomEvent } from '@/services/zoom-webhook.service';

/**
 * POST /api/webhooks/zoom
 *
 * Zoom posts server-to-server with no session, so the proxy lets /api/webhooks
 * through unauthenticated and this handler authenticates the caller itself -
 * exactly as the Paystack webhook does.
 *
 * Two kinds of request arrive here:
 *
 *  - `endpoint.url_validation`, sent when you press Validate in the Zoom
 *    Marketplace. It must be answered with the plain token and an HMAC of it,
 *    or the app cannot be activated and no other event is ever delivered.
 *  - Real meeting events, each carrying `x-zm-signature` over the raw body.
 *
 * Everything that is not a valid signature is refused, and nothing in the body
 * is trusted before that check passes.
 */
export async function POST(request: Request) {
  const secret = webhookSecret();

  if (!secret) {
    // 503, not 401: the caller is not at fault, this deployment is not set up.
    return NextResponse.json({ error: 'Not configured' }, { status: 503 });
  }

  // The signature covers the raw bytes, so read text and parse it ourselves.
  // Re-serialising the JSON would change the bytes and never match.
  const rawBody = await request.text();

  let event: ZoomEvent;

  try {
    event = JSON.parse(rawBody) as ZoomEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  /* ------------------------------------------------------------------ *
   * The Marketplace URL validation handshake.
   * ------------------------------------------------------------------ */

  if (event.event === 'endpoint.url_validation') {
    const plainToken = (event as { payload?: { plainToken?: string } }).payload?.plainToken;

    if (!plainToken) {
      return NextResponse.json({ error: 'Missing plainToken' }, { status: 400 });
    }

    return NextResponse.json(urlValidationResponse(plainToken, secret));
  }

  /* ------------------------------------------------------------------ *
   * Every other event must be signed.
   * ------------------------------------------------------------------ */

  const signed = verifySignature({
    rawBody,
    signature: request.headers.get('x-zm-signature'),
    timestamp: request.headers.get('x-zm-request-timestamp'),
    secret,
  });

  if (!signed) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  try {
    const outcome = await handleZoomEvent(event);

    // 200 either way. An event this platform does not act on is not a failure,
    // and answering anything else makes Zoom retry it for hours.
    return NextResponse.json({ received: true, ...outcome });
  } catch (error) {
    console.error('[webhook/zoom] handling failed', error);
    // 500 so Zoom retries what may be a transient database failure.
    return NextResponse.json({ error: 'Handling failed' }, { status: 500 });
  }
}
