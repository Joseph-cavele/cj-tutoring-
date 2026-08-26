import crypto from 'node:crypto';

/**
 * Paystack client. Server-only: PAYSTACK_SECRET_KEY must never reach the
 * browser (CLAUDE.md section 33).
 *
 * Paystack has no official Node SDK, so this wraps the REST API directly.
 */
const PAYSTACK_BASE = 'https://api.paystack.co';

export class PaystackNotConfiguredError extends Error {
  constructor() {
    super('PAYSTACK_SECRET_KEY is not set. Add it to .env.local');
    this.name = 'PaystackNotConfiguredError';
  }
}

function secretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;

  if (!key || key.startsWith('your_')) {
    throw new PaystackNotConfiguredError();
  }

  return key;
}

/** Paystack works in subunits, so R1 200 is sent as 120000. */
export function toSubunits(amount: number): number {
  return Math.round(amount * 100);
}

export function fromSubunits(subunits: number): number {
  return subunits / 100;
}

export type InitializeResult = {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
};

/**
 * Starts a transaction and returns the hosted checkout URL.
 *
 * The amount is passed by the caller from a Package document, never from the
 * browser - otherwise a student could post their own price.
 */
export async function initializeTransaction(params: {
  email: string;
  amountInRands: number;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<InitializeResult> {
  const response = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secretKey()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: params.email,
      amount: toSubunits(params.amountInRands),
      currency: 'ZAR',
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.status) {
    throw new Error(payload.message ?? 'Paystack could not start the transaction');
  }

  return {
    authorizationUrl: payload.data.authorization_url,
    accessCode: payload.data.access_code,
    reference: payload.data.reference,
  };
}

/** Server-to-server confirmation, used as a fallback to the webhook. */
export async function verifyTransaction(reference: string) {
  const response = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { authorization: `Bearer ${secretKey()}` } }
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.status) {
    throw new Error(payload.message ?? 'Paystack could not verify the transaction');
  }

  return {
    status: payload.data.status as string,
    amountInRands: fromSubunits(payload.data.amount as number),
    reference: payload.data.reference as string,
    raw: payload.data as unknown,
  };
}

/**
 * Confirms a webhook really came from Paystack.
 *
 * The signature is HMAC-SHA512 of the RAW request body keyed with the secret,
 * so the body must be verified before it is parsed. Compared in constant time
 * so the check cannot be probed byte by byte.
 */
export function isValidWebhookSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;

  const expected = crypto
    .createHmac('sha512', secretKey())
    .update(rawBody, 'utf8')
    .digest('hex');

  const expectedBuffer = Buffer.from(expected, 'utf8');
  const givenBuffer = Buffer.from(signature, 'utf8');

  if (expectedBuffer.length !== givenBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, givenBuffer);
}
