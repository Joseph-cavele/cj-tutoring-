import { LessonError, recordLesson } from '@/services/lesson.service';
import { Attendance, Booking, Lesson } from '@/models';
import type { SessionUser } from '@/lib/auth/guard';

/**
 * Who may write a lesson up, and which bookings may be written up at all.
 *
 * These two guards are what stop a student editing their own attendance and
 * stop a cancelled booking acquiring a mark - both of which move the
 * attendance percentage a parent reads. Worth pinning.
 */

jest.mock('../../lib/mongodb', () => ({ connectDB: jest.fn().mockResolvedValue(undefined) }));

jest.mock('../../models', () => ({
  Booking: { findById: jest.fn(), updateOne: jest.fn() },
  Lesson: { findOneAndUpdate: jest.fn() },
  Attendance: { updateOne: jest.fn() },
}));

const mocked = {
  bookingFindById: Booking.findById as jest.Mock,
  bookingUpdateOne: Booking.updateOne as jest.Mock,
  lessonUpsert: Lesson.findOneAndUpdate as jest.Mock,
  attendanceUpsert: Attendance.updateOne as jest.Mock,
};

const tutor: SessionUser = { id: 'user-tutor', role: 'tutor' } as SessionUser;
const student: SessionUser = { id: 'user-student', role: 'student' } as SessionUser;
const parent: SessionUser = { id: 'user-parent', role: 'parent' } as SessionUser;

const BOOKING_ID = '64b7f9c2e1a4d5f6a7b8c9d0';

/**
 * Booking.findById(...).select(...).lean()
 *
 * `paymentStatus` defaults to paid because these cases are about the write-up
 * rules, not the money. The gate itself is exercised by its own test below.
 */
const givenBooking = (status: string, paymentStatus = 'paid') => {
  mocked.bookingFindById.mockReturnValue({
    select: () => ({
      lean: async () => ({
        _id: 'booking-1',
        student: 'student-1',
        tutor: 'tutor-1',
        subject: 'subject-1',
        date: new Date('2026-09-01T00:00:00.000Z'),
        durationMinutes: 60,
        status,
        paymentStatus,
      }),
    }),
  });
};

const input = {
  bookingId: BOOKING_ID,
  attendance: 'present' as const,
  notes: 'Covered quadratic equations.',
  homework: 'Questions 1-10.',
  completed: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  mocked.lessonUpsert.mockResolvedValue({ _id: 'lesson-1' });
  mocked.attendanceUpsert.mockResolvedValue({});
  mocked.bookingUpdateOne.mockResolvedValue({});
});

describe('recordLesson authorization', () => {
  it.each([
    ['a student', student],
    ['a parent', parent],
  ])('refuses %s', async (_label, user) => {
    await expect(recordLesson({ user, input })).rejects.toMatchObject({ status: 403 });

    // Nothing was written before the check.
    expect(mocked.bookingFindById).not.toHaveBeenCalled();
    expect(mocked.attendanceUpsert).not.toHaveBeenCalled();
  });

  it('allows the tutor', async () => {
    givenBooking('accepted');

    await expect(recordLesson({ user: tutor, input })).resolves.toEqual({
      lessonId: 'lesson-1',
    });
  });
});

describe('recordLesson booking state', () => {
  it.each(['cancelled', 'rejected'])('refuses a %s booking', async (status) => {
    givenBooking(status);

    await expect(recordLesson({ user: tutor, input })).rejects.toBeInstanceOf(LessonError);
    expect(mocked.attendanceUpsert).not.toHaveBeenCalled();
  });

  it('refuses a pending booking, so attendance cannot precede acceptance', async () => {
    givenBooking('pending');

    await expect(recordLesson({ user: tutor, input })).rejects.toMatchObject({ status: 409 });
    expect(mocked.attendanceUpsert).not.toHaveBeenCalled();
  });

  it('returns 404 when the booking does not exist', async () => {
    mocked.bookingFindById.mockReturnValue({ select: () => ({ lean: async () => null }) });

    await expect(recordLesson({ user: tutor, input })).rejects.toMatchObject({ status: 404 });
  });

  /**
   * Attendance feeds the percentage a parent sees and the record a dispute is
   * settled from, so a lesson nobody paid for must not acquire one - even
   * though the booking itself is accepted.
   */
  it.each(['pending', 'failed', 'refunded'])(
    'refuses to record attendance on a %s payment',
    async (paymentStatus) => {
      givenBooking('accepted', paymentStatus);

      await expect(recordLesson({ user: tutor, input })).rejects.toMatchObject({
        status: 409,
      });
      expect(mocked.attendanceUpsert).not.toHaveBeenCalled();
    }
  );

  it('records attendance for a lesson a monthly plan covered', async () => {
    givenBooking('accepted', 'covered');

    await expect(recordLesson({ user: tutor, input })).resolves.toBeDefined();
    expect(mocked.attendanceUpsert).toHaveBeenCalled();
  });
});

describe('recordLesson writes', () => {
  it('takes student, tutor and subject from the booking, never the request', async () => {
    givenBooking('accepted');

    await recordLesson({ user: tutor, input });

    const [, update] = mocked.lessonUpsert.mock.calls[0];

    expect(update.$set).toMatchObject({
      student: 'student-1',
      tutor: 'tutor-1',
      subject: 'subject-1',
      recordedBy: 'user-tutor',
    });
  });

  it('writes attendance to the Attendance collection, keyed on the booking', async () => {
    givenBooking('accepted');

    await recordLesson({ user: tutor, input });

    const [filter, update, options] = mocked.attendanceUpsert.mock.calls[0];

    expect(filter).toEqual({ booking: 'booking-1', student: 'student-1' });
    expect(update.$set).toMatchObject({ status: 'present', markedBy: 'user-tutor' });
    expect(options).toEqual({ upsert: true });
  });

  it('completes the booking only when the write-up is finished', async () => {
    givenBooking('accepted');

    await recordLesson({ user: tutor, input: { ...input, completed: false } });
    expect(mocked.bookingUpdateOne).not.toHaveBeenCalled();

    await recordLesson({ user: tutor, input });
    expect(mocked.bookingUpdateOne).toHaveBeenCalledWith(
      { _id: 'booking-1' },
      { $set: { status: 'completed' } }
    );
  });
});
