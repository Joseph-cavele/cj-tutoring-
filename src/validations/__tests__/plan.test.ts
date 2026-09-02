import {
  recordLessonPaymentSchema,
  recordPlanPaymentSchema,
  setPaymentStatusSchema,
  startPlanCheckoutSchema,
} from '../plan';

/**
 * What the browser is allowed to say about money.
 *
 * The properties worth pinning are the refusals. A schema that accepted an
 * amount would let a caller decide what their lesson costs, and one that
 * accepted `paystack` on the manual path would let the tutor mark a card
 * payment settled without the gateway ever confirming it - both are the exact
 * failures CLAUDE.md section 19 exists to prevent.
 */

const VALID_ID = '6a8e77b43fb3c9146bc47c7e';

describe('startPlanCheckoutSchema', () => {
  it('takes only the plan, never a price', () => {
    const parsed = startPlanCheckoutSchema.parse({
      packageSlug: 'monthly-online',
      amount: 1,
    });

    expect(parsed).toEqual({ packageSlug: 'monthly-online' });
    expect(parsed).not.toHaveProperty('amount');
  });

  it('rejects an empty plan', () => {
    expect(startPlanCheckoutSchema.safeParse({ packageSlug: '' }).success).toBe(false);
  });

  it('rejects a student id that is not one', () => {
    const result = startPlanCheckoutSchema.safeParse({
      packageSlug: 'monthly-online',
      studentId: 'not-an-id',
    });

    expect(result.success).toBe(false);
  });
});

describe('recordLessonPaymentSchema', () => {
  it('accepts cash and EFT', () => {
    for (const method of ['cash', 'eft']) {
      const result = recordLessonPaymentSchema.safeParse({
        bookingId: VALID_ID,
        method,
      });

      expect(result.success).toBe(true);
    }
  });

  /**
   * The single most important assertion in this file. A Paystack charge is
   * settled by the verified webhook and nowhere else.
   */
  it('refuses to record a gateway payment by hand', () => {
    const result = recordLessonPaymentSchema.safeParse({
      bookingId: VALID_ID,
      method: 'paystack',
    });

    expect(result.success).toBe(false);
  });

  it('carries no amount through, even when one is sent', () => {
    const parsed = recordLessonPaymentSchema.parse({
      bookingId: VALID_ID,
      method: 'cash',
      amount: 5,
    });

    expect(parsed).not.toHaveProperty('amount');
  });
});

describe('recordPlanPaymentSchema', () => {
  it('needs a student and a plan', () => {
    expect(
      recordPlanPaymentSchema.safeParse({ studentId: VALID_ID, method: 'eft' }).success
    ).toBe(false);
  });

  it('refuses the gateway here too', () => {
    const result = recordPlanPaymentSchema.safeParse({
      studentId: VALID_ID,
      packageSlug: 'monthly-online',
      method: 'paystack',
    });

    expect(result.success).toBe(false);
  });
});

describe('setPaymentStatusSchema', () => {
  it('allows the two outcomes a human can assert', () => {
    for (const status of ['refunded', 'cancelled']) {
      expect(
        setPaymentStatusSchema.safeParse({ paymentId: VALID_ID, status }).success
      ).toBe(true);
    }
  });

  /**
   * Nothing reachable from a browser may declare a payment successful. That
   * stays with the provider callback.
   */
  it('cannot mark a payment successful', () => {
    const result = setPaymentStatusSchema.safeParse({
      paymentId: VALID_ID,
      status: 'successful',
    });

    expect(result.success).toBe(false);
  });

  it('cannot mark a payment pending or failed either', () => {
    for (const status of ['pending', 'failed']) {
      expect(
        setPaymentStatusSchema.safeParse({ paymentId: VALID_ID, status }).success
      ).toBe(false);
    }
  });
});
