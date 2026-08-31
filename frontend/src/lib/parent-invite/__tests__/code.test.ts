import {
  CODE_ALPHABET,
  CODE_LENGTH,
  formatInviteCode,
  generateInviteCode,
  hashInviteCode,
  inviteExpiryFrom,
  normaliseInviteCode,
} from '@/lib/parent-invite/code';

describe('generateInviteCode', () => {
  it('produces a code of the declared length from the declared alphabet', () => {
    for (let run = 0; run < 200; run += 1) {
      const code = generateInviteCode();

      expect(code).toHaveLength(CODE_LENGTH);

      for (const character of code) {
        expect(CODE_ALPHABET).toContain(character);
      }
    }
  });

  it('never emits the four characters Crockford omits', () => {
    const codes = Array.from({ length: 400 }, generateInviteCode).join('');

    for (const excluded of ['I', 'L', 'O', 'U']) {
      expect(codes).not.toContain(excluded);
    }
  });

  it('does not repeat itself', () => {
    const codes = new Set(Array.from({ length: 500 }, generateInviteCode));
    expect(codes.size).toBe(500);
  });
});

describe('normaliseInviteCode', () => {
  /**
   * The property that matters: anything this system generates must survive a
   * round trip through the display format and the normaliser unchanged. This
   * is the test that catches a repair rule which eats a valid character - an
   * earlier draft mapped Q to 0, which silently broke every code holding a Q.
   */
  it('round-trips every generated code through its display format', () => {
    for (let run = 0; run < 500; run += 1) {
      const code = generateInviteCode();
      expect(normaliseInviteCode(formatInviteCode(code))).toBe(code);
    }
  });

  it('keeps Q, which is a valid symbol and not a misread O', () => {
    expect(normaliseInviteCode('QQQQQ-QQQQQ')).toBe('QQQQQQQQQQ');
  });

  it('repairs the misreads people actually make', () => {
    // O for zero, I and L for one.
    expect(normaliseInviteCode('OOOOO-OOOOO')).toBe('0000000000');
    expect(normaliseInviteCode('IIIII-LLLLL')).toBe('1111111111');
  });

  it('accepts lower case, spaces and missing separators', () => {
    expect(normaliseInviteCode('abcde-fghjk')).toBe('ABCDEFGHJK');
    expect(normaliseInviteCode('ABCDE FGHJK')).toBe('ABCDEFGHJK');
    expect(normaliseInviteCode('ABCDEFGHJK')).toBe('ABCDEFGHJK');
    expect(normaliseInviteCode('  abcde-fghjk  ')).toBe('ABCDEFGHJK');
  });

  it('rejects anything that is not a plausible code', () => {
    expect(normaliseInviteCode('')).toBeNull();
    expect(normaliseInviteCode('ABCDE')).toBeNull();
    expect(normaliseInviteCode('ABCDE-FGHJK-XYZ')).toBeNull();
    // U is not in the alphabet, so this is ten characters of the wrong sort.
    expect(normaliseInviteCode('UUUUU-UUUUU')).toBeNull();
  });
});

describe('hashInviteCode', () => {
  it('is stable and does not return the code', () => {
    const hash = hashInviteCode('ABCDEFGHJK');

    expect(hash).toBe(hashInviteCode('ABCDEFGHJK'));
    expect(hash).not.toContain('ABCDEFGHJK');
    expect(hash).toHaveLength(64);
  });

  it('differs for codes that differ by one character', () => {
    expect(hashInviteCode('ABCDEFGHJK')).not.toBe(hashInviteCode('ABCDEFGHJM'));
  });
});

describe('inviteExpiryFrom', () => {
  it('is two weeks after the moment given', () => {
    const now = new Date('2026-09-01T12:00:00.000Z');
    expect(inviteExpiryFrom(now).toISOString()).toBe('2026-09-15T12:00:00.000Z');
  });
});
