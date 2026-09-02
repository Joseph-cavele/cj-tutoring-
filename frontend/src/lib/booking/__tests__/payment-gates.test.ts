import {
  ATTENDANCE_ALLOWED,
  BOOKING_PAYMENT_STATUSES,
  PAYMENT_SETTLED,
} from '../constants';

/**
 * The gates that decide whether a lesson can go ahead.
 *
 * These lists are read by the tutor's decision queue, the Zoom joining link and
 * the attendance write. A status quietly added to one of them is how an unpaid
 * lesson gets taught, so each is pinned by what it must NOT contain rather than
 * only by what it does.
 */

describe('PAYMENT_SETTLED', () => {
  it('never releases an unpaid lesson to the tutor', () => {
    expect(PAYMENT_SETTLED).not.toContain('pending');
    expect(PAYMENT_SETTLED).not.toContain('failed');
    expect(PAYMENT_SETTLED).not.toContain('refunded');
  });

  it('accepts a lesson a monthly plan paid for', () => {
    expect(PAYMENT_SETTLED).toContain('covered');
  });
});

describe('ATTENDANCE_ALLOWED', () => {
  it('refuses every state in which no money arrived', () => {
    expect(ATTENDANCE_ALLOWED).not.toContain('pending');
    expect(ATTENDANCE_ALLOWED).not.toContain('failed');
  });

  /**
   * A refund after the lesson was accepted is the case that motivated the gate
   * on the joining link: the booking stays `accepted`, so only the payment
   * status can stop it.
   */
  it('refuses a lesson whose payment was refunded', () => {
    expect(ATTENDANCE_ALLOWED).not.toContain('refunded');
  });

  it('allows paid, plan-covered and not-required lessons', () => {
    expect(ATTENDANCE_ALLOWED).toContain('paid');
    expect(ATTENDANCE_ALLOWED).toContain('covered');
    expect(ATTENDANCE_ALLOWED).toContain('not_required');
  });

  it('only contains statuses that actually exist', () => {
    for (const status of ATTENDANCE_ALLOWED) {
      expect(BOOKING_PAYMENT_STATUSES).toContain(status);
    }
  });
});

describe('covered is a status of its own', () => {
  /**
   * Collapsing `covered` into `paid` would make the owner's takings look larger
   * than the bank, because a plan lesson brings in no money of its own - it was
   * bought earlier, as part of a month.
   */
  it('is distinct from paid', () => {
    expect(BOOKING_PAYMENT_STATUSES).toContain('covered');
    expect(BOOKING_PAYMENT_STATUSES).toContain('paid');
    expect('covered').not.toBe('paid');
  });
});
