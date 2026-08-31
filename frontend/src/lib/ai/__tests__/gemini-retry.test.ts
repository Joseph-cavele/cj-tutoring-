import { isOverloadedAiError, isTransientAiError } from '../gemini';

/**
 * Which Gemini failures are worth asking again about.
 *
 * The distinction has to be right in both directions. Treating a 400 as
 * transient burns seconds retrying a request that can never succeed; treating
 * a 503 as fatal throws away a twenty-second generation over a momentary
 * overload, which is the failure that prompted this.
 *
 * The shapes below are what the SDK actually surfaced: a numeric `status` on
 * the error object, and in other cases only the text.
 */

describe('isTransientAiError', () => {
  it('retries an overloaded or rate-limited model', () => {
    for (const status of [429, 500, 502, 503, 504]) {
      expect(isTransientAiError(Object.assign(new Error('upstream'), { status }))).toBe(true);
    }
  });

  it('reads the status from a string or a code field too', () => {
    expect(isTransientAiError(Object.assign(new Error('x'), { code: '503' }))).toBe(true);
    expect(isTransientAiError(new Error('503 The model is overloaded.'))).toBe(true);
    expect(isTransientAiError(new Error('Service UNAVAILABLE'))).toBe(true);
  });

  it('does not retry a request that was simply wrong', () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(isTransientAiError(Object.assign(new Error('bad'), { status }))).toBe(false);
    }
    expect(isTransientAiError(new Error('API key not valid'))).toBe(false);
  });

  it('treats an unrecognisable failure as fatal rather than looping on it', () => {
    expect(isTransientAiError(null)).toBe(false);
    expect(isTransientAiError('something odd')).toBe(false);
  });
});

describe('isOverloadedAiError', () => {
  it('singles out 503 so the tutor can be told to try again', () => {
    expect(isOverloadedAiError(Object.assign(new Error('busy'), { status: 503 }))).toBe(true);
    expect(isOverloadedAiError(new Error('The model is overloaded. Please try again later.'))).toBe(
      true
    );
  });

  it('does not claim overload for other transient failures', () => {
    expect(isOverloadedAiError(Object.assign(new Error('slow'), { status: 429 }))).toBe(false);
    expect(isOverloadedAiError(Object.assign(new Error('bad'), { status: 400 }))).toBe(false);
  });
});
