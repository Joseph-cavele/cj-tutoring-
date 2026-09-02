import {
  MANUAL_PAYMENT_METHODS,
  PAYMENT_METHODS,
  PAYMENT_PLANS,
  describeRemaining,
  isManualMethod,
  lessonsRemaining,
  methodsForMode,
} from '../plans';

/**
 * The lesson counter is shown to the student, printed in the owner's table and
 * consulted by the attendance gate. If those three ever disagree, a student is
 * told they have lessons left and then refused at the door - so the arithmetic
 * is pinned here rather than trusted to three call sites.
 */

describe('lessonsRemaining', () => {
  it('counts down as lessons are used', () => {
    expect(lessonsRemaining(4, 0)).toBe(4);
    expect(lessonsRemaining(4, 1)).toBe(3);
    expect(lessonsRemaining(4, 4)).toBe(0);
  });

  it('never goes negative', () => {
    // Reachable if a drawdown is ever double-applied. The counter must not
    // start reading "-1 lessons remaining" at a parent.
    expect(lessonsRemaining(4, 5)).toBe(0);
    expect(lessonsRemaining(0, 3)).toBe(0);
  });
});

describe('describeRemaining', () => {
  it('reads the way the brief asks for', () => {
    expect(describeRemaining(4, 1)).toBe('3 of 4 lessons remaining');
  });

  it('switches to the completed wording once they are all used', () => {
    expect(describeRemaining(4, 4)).toBe('Monthly plan completed');
    expect(describeRemaining(4, 9)).toBe('Monthly plan completed');
  });

  it('does not say "1 lessons"', () => {
    expect(describeRemaining(1, 0)).toBe('1 of 1 lesson remaining');
  });
});

describe('methodsForMode', () => {
  it('offers cash only where the tutor is in the room', () => {
    expect(methodsForMode('in_person')).toContain('cash');
    expect(methodsForMode('online')).not.toContain('cash');
  });

  it('always offers the gateway and EFT', () => {
    for (const mode of ['online', 'in_person', 'hybrid']) {
      expect(methodsForMode(mode)).toContain('paystack');
      expect(methodsForMode(mode)).toContain('eft');
    }
  });
});

describe('isManualMethod', () => {
  /**
   * The one property that matters: the gateway must never be classed as
   * something a human can record by hand. That is what stops a Paystack charge
   * being marked paid from a form.
   */
  it('never treats the gateway as manual', () => {
    expect(isManualMethod('paystack')).toBe(false);
  });

  it('treats cash and EFT as manual', () => {
    expect(isManualMethod('cash')).toBe(true);
    expect(isManualMethod('eft')).toBe(true);
  });

  it('covers every method, so a new one cannot be silently unclassified', () => {
    for (const method of PAYMENT_METHODS) {
      expect(typeof isManualMethod(method)).toBe('boolean');
    }

    expect(MANUAL_PAYMENT_METHODS.every((method) => isManualMethod(method))).toBe(true);
  });
});

describe('the vocabulary itself', () => {
  it('has exactly the two plans the brief describes', () => {
    expect([...PAYMENT_PLANS]).toEqual(['per_lesson', 'monthly']);
  });

  it('has exactly the three methods the brief describes', () => {
    expect([...PAYMENT_METHODS]).toEqual(['paystack', 'eft', 'cash']);
  });
});
