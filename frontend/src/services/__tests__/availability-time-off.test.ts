import { getOfferedSlots, validateProposedLesson } from '@/services/availability.service';
import { Availability, Booking, TimeOff } from '@/models';

/**
 * A blocked day must block BOTH paths.
 *
 * The picker calls getAvailableSlots and the booking service calls
 * validateProposedLesson, and both reach the tutor's hours through
 * getOfferedSlots. If the time-off check ever moves out of that one function
 * into the picker, a client that posts a booking directly walks straight
 * through a day the tutor blocked. These tests pin it in place.
 */

jest.mock('../../lib/mongodb', () => ({ connectDB: jest.fn().mockResolvedValue(undefined) }));

jest.mock('../../models', () => ({
  Availability: { find: jest.fn() },
  Booking: { find: jest.fn() },
  Subject: { find: jest.fn() },
  Tutor: { find: jest.fn() },
  TimeOff: { findOne: jest.fn() },
}));

jest.mock('../../models/Booking', () => ({
  ACTIVE_BOOKING_STATUSES: ['pending', 'accepted', 'completed'],
}));

const mocked = {
  availabilityFind: Availability.find as jest.Mock,
  bookingFind: Booking.find as jest.Mock,
  timeOffFindOne: TimeOff.findOne as jest.Mock,
};

const TUTOR = 'tutor-1';
const STUDENT = 'student-1';

/** A Wednesday, so the weekday window below applies. */
const ISO_DATE = '2026-09-02';

/** Fixed "now" well before the date under test, so nothing is filtered as past. */
const NOW = new Date('2026-09-01T06:00:00.000Z');

const givenWeeklyWindow = () => {
  mocked.availabilityFind.mockReturnValue({
    lean: async () => [
      {
        dayOfWeek: 3,
        startTime: '14:00',
        endTime: '17:00',
        slotMinutes: 60,
        teachingMode: 'online',
        isActive: true,
      },
    ],
    select: () => ({
      lean: async () => [{ slotMinutes: 60, teachingMode: 'online' }],
    }),
  });
};

const givenNoBookings = () => {
  mocked.bookingFind.mockReturnValue({
    select: () => ({ lean: async () => [] }),
  });
};

const givenTimeOff = (blocked: boolean) => {
  mocked.timeOffFindOne.mockReturnValue({
    select: () => ({ lean: async () => (blocked ? { _id: 'off-1' } : null) }),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  givenWeeklyWindow();
  givenNoBookings();
});

describe('a day with no time off', () => {
  it('offers the slots the weekly window generates', async () => {
    givenTimeOff(false);

    const slots = await getOfferedSlots({ tutorId: TUTOR, isoDate: ISO_DATE });

    expect(slots.map((slot) => slot.startTime)).toEqual(['14:00', '15:00', '16:00']);
  });

  it('accepts a lesson inside that window', async () => {
    givenTimeOff(false);

    const result = await validateProposedLesson({
      tutorId: TUTOR,
      studentId: STUDENT,
      isoDate: ISO_DATE,
      startTime: '15:00',
      durationMinutes: 60,
      teachingMode: 'online',
      now: NOW,
    });

    expect(result.ok).toBe(true);
  });
});

describe('a day the tutor has blocked', () => {
  it('offers nothing, whatever the weekly pattern says', async () => {
    givenTimeOff(true);

    const slots = await getOfferedSlots({ tutorId: TUTOR, isoDate: ISO_DATE });

    expect(slots).toEqual([]);
  });

  it('does not even read the weekly windows', async () => {
    givenTimeOff(true);

    await getOfferedSlots({ tutorId: TUTOR, isoDate: ISO_DATE });

    expect(mocked.availabilityFind).not.toHaveBeenCalled();
  });

  /**
   * The one that matters. A caller who skips the picker and posts a booking
   * straight at the server must still be refused.
   */
  it('refuses a lesson submitted directly, not just hidden from the picker', async () => {
    givenTimeOff(true);

    const result = await validateProposedLesson({
      tutorId: TUTOR,
      studentId: STUDENT,
      isoDate: ISO_DATE,
      startTime: '15:00',
      durationMinutes: 60,
      teachingMode: 'online',
      now: NOW,
    });

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.reason).toBe('That tutor is not available on that day');
    }
  });

  it('is checked per date, so the next day is unaffected', async () => {
    // Blocked on the 2nd only.
    mocked.timeOffFindOne.mockImplementation(({ date }: { date: Date }) => ({
      select: () => ({
        lean: async () =>
          date.toISOString().slice(0, 10) === ISO_DATE ? { _id: 'off-1' } : null,
      }),
    }));

    expect(await getOfferedSlots({ tutorId: TUTOR, isoDate: ISO_DATE })).toEqual([]);

    // 2026-09-09 is the following Wednesday, so the same window applies.
    const nextWeek = await getOfferedSlots({ tutorId: TUTOR, isoDate: '2026-09-09' });

    expect(nextWeek.map((slot) => slot.startTime)).toEqual(['14:00', '15:00', '16:00']);
  });
});
