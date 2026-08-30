import crypto from 'node:crypto';

import { urlValidationResponse, verifySignature } from '@/lib/zoom/webhook';

/**
 * The signature check is what stands between a forged POST and a lesson being
 * marked as attended, so it is worth pinning down rather than trusting by eye.
 */

const SECRET = 'test-secret-token';

function sign(rawBody: string, timestamp: string, secret = SECRET): string {
  const digest = crypto
    .createHmac('sha256', secret)
    .update(`v0:${timestamp}:${rawBody}`)
    .digest('hex');

  return `v0=${digest}`;
}

describe('verifySignature', () => {
  const now = 1_770_000_000_000;
  const timestamp = String(now);
  const rawBody = JSON.stringify({ event: 'meeting.started' });

  it('accepts a correctly signed request', () => {
    expect(
      verifySignature({
        rawBody,
        signature: sign(rawBody, timestamp),
        timestamp,
        secret: SECRET,
        now,
      })
    ).toBe(true);
  });

  it('rejects a signature made with a different secret', () => {
    expect(
      verifySignature({
        rawBody,
        signature: sign(rawBody, timestamp, 'someone-elses-secret'),
        timestamp,
        secret: SECRET,
        now,
      })
    ).toBe(false);
  });

  it('rejects a body altered after signing', () => {
    const signature = sign(rawBody, timestamp);

    expect(
      verifySignature({
        rawBody: JSON.stringify({ event: 'meeting.ended' }),
        signature,
        timestamp,
        secret: SECRET,
        now,
      })
    ).toBe(false);
  });

  it('rejects a replay outside the five minute window', () => {
    const old = String(now - 6 * 60 * 1000);

    expect(
      verifySignature({
        rawBody,
        signature: sign(rawBody, old),
        timestamp: old,
        secret: SECRET,
        now,
      })
    ).toBe(false);
  });

  it('rejects a timestamp far in the future', () => {
    const ahead = String(now + 6 * 60 * 1000);

    expect(
      verifySignature({
        rawBody,
        signature: sign(rawBody, ahead),
        timestamp: ahead,
        secret: SECRET,
        now,
      })
    ).toBe(false);
  });

  it('rejects a missing signature or timestamp', () => {
    expect(
      verifySignature({ rawBody, signature: null, timestamp, secret: SECRET, now })
    ).toBe(false);

    expect(
      verifySignature({
        rawBody,
        signature: sign(rawBody, timestamp),
        timestamp: null,
        secret: SECRET,
        now,
      })
    ).toBe(false);
  });

  it('rejects a non-numeric timestamp rather than throwing', () => {
    expect(
      verifySignature({
        rawBody,
        signature: sign(rawBody, 'not-a-time'),
        timestamp: 'not-a-time',
        secret: SECRET,
        now,
      })
    ).toBe(false);
  });

  it('rejects a signature of the wrong length without throwing', () => {
    // timingSafeEqual throws on mismatched lengths, so this must be caught
    // before the comparison.
    expect(
      verifySignature({ rawBody, signature: 'v0=short', timestamp, secret: SECRET, now })
    ).toBe(false);
  });
});

describe('urlValidationResponse', () => {
  it('echoes the plain token and returns an HMAC of it', () => {
    const plainToken = 'abc123';

    const result = urlValidationResponse(plainToken, SECRET);

    expect(result.plainToken).toBe(plainToken);
    expect(result.encryptedToken).toBe(
      crypto.createHmac('sha256', SECRET).update(plainToken).digest('hex')
    );
  });
});
