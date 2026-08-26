import { bookingSchema } from '../booking';
import { registerSchema, loginSchema } from '../auth';
import { contactSchema } from '../contact';

/**
 * These schemas are the server-side gate on untrusted input. The point of the
 * suite is the rejections: what a caller must NOT be able to push through.
 */

const futureDate = () => {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
};

const validBooking = {
  name: 'Thandi Mokoena',
  email: 'parent@example.com',
  subjectSlug: 'mathematics',
  grade: 11,
  mode: 'online' as const,
  preferredDate: futureDate(),
  preferredTime: '14:00',
};

describe('bookingSchema', () => {
  it('accepts a well-formed request', () => {
    expect(bookingSchema.safeParse(validBooking).success).toBe(true);
  });

  it('rejects an unsupported grade/subject pair (CLAUDE.md section 4)', () => {
    const result = bookingSchema.safeParse({
      ...validBooking,
      subjectSlug: 'physical-science',
      grade: 8,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['subjectSlug']);
    }
  });

  it('accepts that same subject once the grade is high enough', () => {
    expect(
      bookingSchema.safeParse({ ...validBooking, subjectSlug: 'physical-science', grade: 10 })
        .success
    ).toBe(true);
  });

  it('rejects a date in the past (booking rule 5)', () => {
    const result = bookingSchema.safeParse({ ...validBooking, preferredDate: '2020-01-01' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['preferredDate']);
    }
  });

  it('rejects a subject the platform does not teach', () => {
    expect(
      bookingSchema.safeParse({ ...validBooking, subjectSlug: 'astrophysics' }).success
    ).toBe(false);
  });

  it('rejects a grade outside 8 to 12', () => {
    expect(bookingSchema.safeParse({ ...validBooking, grade: 7 }).success).toBe(false);
    expect(bookingSchema.safeParse({ ...validBooking, grade: 13 }).success).toBe(false);
  });

  it('rejects malformed dates and times', () => {
    expect(
      bookingSchema.safeParse({ ...validBooking, preferredDate: '25-08-2026' }).success
    ).toBe(false);
    expect(bookingSchema.safeParse({ ...validBooking, preferredTime: '2pm' }).success).toBe(
      false
    );
  });

  it('rejects an invalid email', () => {
    expect(bookingSchema.safeParse({ ...validBooking, email: 'not-an-email' }).success).toBe(
      false
    );
  });

  it('accepts an absent phone but rejects a malformed one', () => {
    expect(bookingSchema.safeParse({ ...validBooking, phone: '' }).success).toBe(true);
    expect(bookingSchema.safeParse({ ...validBooking, phone: '0821234567' }).success).toBe(true);
    expect(bookingSchema.safeParse({ ...validBooking, phone: '12345' }).success).toBe(false);
  });

  it('caps notes so the field cannot be used to store bulk data', () => {
    expect(
      bookingSchema.safeParse({ ...validBooking, notes: 'x'.repeat(1001) }).success
    ).toBe(false);
  });

  it('does NOT reject a filled honeypot, so a bot learns nothing', () => {
    // The route answers 200 and stores nothing instead; a validation error
    // naming the field would teach a bot to leave it blank.
    expect(bookingSchema.safeParse({ ...validBooking, company: 'evilcorp' }).success).toBe(true);
  });
});

describe('registerSchema', () => {
  const base = { name: 'Sipho Ndlovu', email: 'sipho@example.com', password: 'Passw0rd1' };

  it('accepts a student with a grade', () => {
    expect(registerSchema.safeParse({ ...base, role: 'student', grade: 11 }).success).toBe(true);
  });

  it('accepts parent and tutor without a grade', () => {
    expect(registerSchema.safeParse({ ...base, role: 'parent' }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, role: 'tutor' }).success).toBe(true);
  });

  it('refuses to let anyone register themselves as admin', () => {
    expect(registerSchema.safeParse({ ...base, role: 'admin' }).success).toBe(false);
  });

  it('requires a grade for a student', () => {
    expect(registerSchema.safeParse({ ...base, role: 'student' }).success).toBe(false);
  });

  it('enforces password strength', () => {
    const weak = ['short1A', 'alllowercase1', 'ALLUPPERCASE1', 'NoDigitsHere'];
    for (const password of weak) {
      expect(
        registerSchema.safeParse({ ...base, password, role: 'parent' }).success
      ).toBe(false);
    }
  });

  it('accepts a password meeting every rule', () => {
    expect(
      registerSchema.safeParse({ ...base, password: 'Str0ngPass', role: 'parent' }).success
    ).toBe(true);
  });
});

describe('loginSchema', () => {
  it('requires a valid email and a non-empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('contactSchema', () => {
  const valid = {
    name: 'Thandi',
    email: 'a@b.com',
    subject: 'Grade 11 Maths',
    message: 'My daughter needs help with trigonometry.',
  };

  it('accepts a well-formed enquiry', () => {
    expect(contactSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a message too short to act on', () => {
    expect(contactSchema.safeParse({ ...valid, message: 'help' }).success).toBe(false);
  });

  it('trims whitespace rather than accepting blank fields', () => {
    expect(contactSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
  });
});
