import crypto from 'node:crypto';

/**
 * Zoom webhook verification.
 *
 * Server-only. ZOOM_WEBHOOK_SECRET_TOKEN must never reach the browser
 * (CLAUDE.md section 33).
 *
 * Zoom authenticates its calls two ways, and both are implemented here:
 *
 *  1. URL validation. When you save an endpoint in the Zoom Marketplace, Zoom
 *     posts an `endpoint.url_validation` event carrying a `plainToken`, and
 *     expects that token back alongside an HMAC of it. Without this the app
 *     cannot be activated at all - which is why an endpoint that does not
 *     answer the challenge looks like "Zoom is broken".
 *
 *  2. Per-request signatures. Every real event carries `x-zm-signature` over
 *     the raw body and a timestamp, so a forged POST cannot mark a lesson as
 *     attended.
 */

const SIGNATURE_VERSION = 'v0';

/** Reject anything older than this, so a captured request cannot be replayed. */
const MAX_SKEW_MS = 5 * 60 * 1000;

/** The token, or null when Zoom webhooks are not configured. */
export function webhookSecret(): string | null {
  const secret = process.env.ZOOM_WEBHOOK_SECRET_TOKEN;

  // Placeholder values from .env.example count as unconfigured.
  if (!secret || secret.startsWith('your_')) return null;

  return secret;
}

function hmacHex(message: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

/**
 * Zoom's URL validation handshake.
 *
 * The response must echo the plain token and return an HMAC of it, hex
 * encoded, keyed with the same secret token.
 */
export function urlValidationResponse(plainToken: string, secret: string) {
  return {
    plainToken,
    encryptedToken: hmacHex(plainToken, secret),
  };
}

/**
 * Verifies `x-zm-signature` against the raw request body.
 *
 * The signed message is `v0:{timestamp}:{rawBody}`, so the body must be read
 * as text before it is parsed - re-serialising the JSON would change the bytes
 * and the signature would never match.
 */
export function verifySignature(params: {
  rawBody: string;
  signature: string | null;
  timestamp: string | null;
  secret: string;
  now?: number;
}): boolean {
  const { rawBody, signature, timestamp, secret } = params;

  if (!signature || !timestamp) return false;

  // A stale timestamp means a replayed request, whatever the signature says.
  const sent = Number(timestamp);

  if (!Number.isFinite(sent)) return false;

  const now = params.now ?? Date.now();

  // Zoom sends milliseconds. Guard both directions: a clock ahead of ours is
  // as suspicious as one behind.
  if (Math.abs(now - sent) > MAX_SKEW_MS) return false;

  const expected = `${SIGNATURE_VERSION}=${hmacHex(
    `${SIGNATURE_VERSION}:${timestamp}:${rawBody}`,
    secret
  )}`;

  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(signature);

  // timingSafeEqual throws on a length mismatch, so check that first - and
  // compare in constant time rather than with === so the comparison cannot be
  // used to discover the signature byte by byte.
  if (expectedBytes.length !== actualBytes.length) return false;

  return crypto.timingSafeEqual(expectedBytes, actualBytes);
}
