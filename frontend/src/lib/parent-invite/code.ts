import crypto from 'node:crypto';

/**
 * Parent invitation codes (brief section 2).
 *
 * A parent must never gain access to a child by typing a student id. A code is
 * the alternative: unguessable, issued deliberately by the tutor for one named
 * student, and worthless once used.
 *
 * WHY THIS ALPHABET
 * Crockford base32 - it omits I, L, O and U. The first three are the pairs
 * people misread as 1 and 0, and the last is dropped so a random code cannot
 * spell something unfortunate. Codes get read down a phone line and copied off
 * a WhatsApp message, so `normaliseInviteCode` also FIXES the classic misreads
 * rather than rejecting them: O becomes 0, I and L become 1. A parent who
 * types what they see gets in.
 *
 * WHY THIS LENGTH
 * Ten characters of base32 is 50 bits. Guessing one is not a realistic attack
 * even before the rate limit on redemption, which is what lets the service
 * tell an honest parent WHY a code failed instead of hiding behind one vague
 * message.
 */

/** Crockford base32: no I, L, O or U. */
export const CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export const CODE_LENGTH = 10;

/** How long a code stays usable. Long enough to reach a parent who is busy. */
export const CODE_TTL_DAYS = 14;

/**
 * A new code, in canonical form (no separator).
 *
 * `randomInt` rather than `randomBytes` and a modulo: 256 is not a multiple of
 * 32... it is, but the habit matters - a modulo over a non-multiple alphabet
 * silently biases the low characters. `randomInt` is uniform by construction.
 */
export function generateInviteCode(): string {
  let code = '';

  for (let index = 0; index < CODE_LENGTH; index += 1) {
    code += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
  }

  return code;
}

/** Canonical code as it is shown to a human: XXXXX-XXXXX. */
export function formatInviteCode(canonical: string): string {
  const half = Math.floor(CODE_LENGTH / 2);
  return `${canonical.slice(0, half)}-${canonical.slice(half)}`;
}

/**
 * Whatever the parent typed, reduced to the canonical code.
 *
 * Returns null when the result is not a plausible code, so the caller never
 * hashes and looks up rubbish. Accepts hyphens, spaces and lower case, and
 * repairs the O/0 and I/L/1 confusions described above.
 */
export function normaliseInviteCode(raw: string): string | null {
  if (typeof raw !== 'string') return null;

  const repaired = raw
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    // Anything left that is not an alphabet character - hyphens, spaces,
    // stray punctuation from a copy-paste - is simply dropped.
    .replace(/[^0-9A-Z]/g, '');

  if (repaired.length !== CODE_LENGTH) return null;

  for (const character of repaired) {
    if (!CODE_ALPHABET.includes(character)) return null;
  }

  return repaired;
}

/**
 * Only this ever reaches the database.
 *
 * Same reasoning as PasswordToken: a stolen dump must not hand the thief a
 * working set of codes for claiming other people's children. SHA-256 without a
 * salt is right here - the input is 50 random bits, so there is no dictionary
 * to precompute.
 */
export function hashInviteCode(canonical: string): string {
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/** When a code issued now should stop working. */
export function inviteExpiryFrom(now: Date = new Date()): Date {
  return new Date(now.getTime() + CODE_TTL_DAYS * 24 * 60 * 60 * 1000);
}
