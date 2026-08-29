import {
  addMinutes,
  coveredSlots,
  generateSlots,
  isInPast,
  normaliseSlots,
  overlaps,
  removePast,
  removeTaken,
  toMinutes,
  toTime,
} from '../slots';

/**
 * The slot engine decides what a visitor may book, so these cover the booking
 * rules directly: a lesson must fit inside the tutor's window (rule 4), a
 * booked slot must disappear (rule 1), and the past must never be bookable
 * (rule 5).
 */

describe('time helpers', () => {
  it('converts between "HH:mm" and minutes', () => {
    expect(toMinutes('09:00')).toBe(540);
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('23:59')).toBe(1439);
    expect(toTime(540)).toBe('09:00');
    expect(toTime(0)).toBe('00:00');
  });

  it('pads single digits, so times sort correctly as strings', () => {
    expect(toTime(9 * 60 + 5)).toBe('09:05');
    expect(toTime(65)).toBe('01:05');
  });

  it('adds minutes across the hour boundary', () => {
    expect(addMinutes('09:00', 90)).toBe('10:30');
    expect(addMinutes('23:00', 30)).toBe('23:30');
  });
});

describe('generateSlots', () => {
  it('cuts a window into back-to-back slots', () => {
    const slots = generateSlots('09:00', '12:00', 60);
    expect(slots.map((s) => s.startTime)).toEqual(['09:00', '10:00', '11:00']);
    expect(slots[0].endTime).toBe('10:00');
  });

  it('drops a trailing part-slot, because a lesson must fit in the window', () => {
    expect(generateSlots('09:00', '10:30', 60).map((s) => s.startTime)).toEqual(['09:00']);
  });

  it('handles slot sizes that are not an hour', () => {
    expect(generateSlots('09:00', '10:30', 30).map((s) => s.startTime)).toEqual([
      '09:00',
      '09:30',
      '10:00',
    ]);
  });

  it('returns nothing for a zero or negative slot size rather than looping forever', () => {
    expect(generateSlots('09:00', '17:00', 0)).toEqual([]);
    expect(generateSlots('09:00', '17:00', -30)).toEqual([]);
  });

  it('returns nothing when the window is shorter than one slot', () => {
    expect(generateSlots('09:00', '09:30', 60)).toEqual([]);
  });
});

describe('overlaps', () => {
  it('treats back-to-back lessons as free of each other', () => {
    expect(
      overlaps({ startTime: '09:00', endTime: '10:00' }, { startTime: '10:00', endTime: '11:00' })
    ).toBe(false);
  });

  it('detects a partial collision', () => {
    expect(
      overlaps({ startTime: '09:00', endTime: '10:00' }, { startTime: '09:30', endTime: '10:30' })
    ).toBe(true);
  });

  it('detects one lesson sitting entirely inside another', () => {
    expect(
      overlaps({ startTime: '09:00', endTime: '12:00' }, { startTime: '10:00', endTime: '11:00' })
    ).toBe(true);
  });
});

describe('removeTaken', () => {
  const day = generateSlots('09:00', '13:00', 60);

  it('removes a slot that is already booked (rule 1)', () => {
    const free = removeTaken(day, [{ startTime: '11:00', endTime: '12:00' }]);
    expect(free.map((s) => s.startTime)).toEqual(['09:00', '10:00', '12:00']);
  });

  it('removes every slot a long booking covers', () => {
    const free = removeTaken(day, [{ startTime: '09:00', endTime: '12:00' }]);
    expect(free.map((s) => s.startTime)).toEqual(['12:00']);
  });

  it('leaves the day intact when nothing is booked', () => {
    expect(removeTaken(day, [])).toHaveLength(4);
  });
});

describe('removePast and isInPast (rule 5)', () => {
  // 12:30 SAST on 2026-08-25. SAST is UTC+2 with no daylight saving.
  const now = new Date('2026-08-25T10:30:00.000Z');
  const day = generateSlots('09:00', '16:00', 60);

  it('keeps only later slots today', () => {
    expect(removePast(day, '2026-08-25', now).map((s) => s.startTime)).toEqual([
      '13:00',
      '14:00',
      '15:00',
    ]);
  });

  it('returns nothing for a past date', () => {
    expect(removePast(day, '2026-08-24', now)).toEqual([]);
  });

  it('keeps the whole day for a future date', () => {
    expect(removePast(day, '2026-08-26', now)).toHaveLength(7);
  });

  it('judges a specific date and time', () => {
    expect(isInPast('2026-08-25', '09:00', now)).toBe(true);
    expect(isInPast('2026-08-25', '13:00', now)).toBe(false);
    expect(isInPast('2026-08-24', '23:00', now)).toBe(true);
    expect(isInPast('2026-08-26', '00:00', now)).toBe(false);
  });

  it('treats the current slot as past, so a lesson cannot start retroactively', () => {
    expect(isInPast('2026-08-25', '12:30', now)).toBe(true);
  });

  it('does not depend on the host timezone', () => {
    // 23:30 UTC on the 25th is 01:30 SAST on the 26th, so the 26th is "today"
    // and its early slots are still bookable.
    const lateUtc = new Date('2026-08-25T23:30:00.000Z');
    expect(isInPast('2026-08-26', '09:00', lateUtc)).toBe(false);
    expect(isInPast('2026-08-25', '23:00', lateUtc)).toBe(true);
  });
});

describe('normaliseSlots', () => {
  it('de-duplicates start times and orders them', () => {
    const messy = [
      { startTime: '11:00', endTime: '12:00' },
      { startTime: '09:00', endTime: '10:00' },
      { startTime: '11:00', endTime: '12:00' },
    ];
    expect(normaliseSlots(messy).map((s) => s.startTime)).toEqual(['09:00', '11:00']);
  });
});

describe('coveredSlots (rule 4: inside the tutor availability)', () => {
  const offered = generateSlots('09:00', '13:00', 60);

  it('returns the single slot for a one-slot lesson', () => {
    expect(coveredSlots(offered, '09:00', 60)?.map((s) => s.startTime)).toEqual(['09:00']);
  });

  it('returns the run of slots a longer lesson occupies', () => {
    expect(coveredSlots(offered, '09:00', 120)?.map((s) => s.startTime)).toEqual([
      '09:00',
      '10:00',
    ]);
  });

  it('refuses a start time that is not a real slot boundary', () => {
    expect(coveredSlots(offered, '09:30', 60)).toBeNull();
  });

  it('refuses a lesson that runs past the end of the window', () => {
    expect(coveredSlots(offered, '12:00', 120)).toBeNull();
  });

  it('refuses a lesson that would span a gap in availability', () => {
    // Morning and afternoon windows with 12:00-14:00 unavailable between them.
    const split = [...generateSlots('09:00', '12:00', 60), ...generateSlots('14:00', '16:00', 60)];
    expect(coveredSlots(split, '11:00', 120)).toBeNull();
    expect(coveredSlots(split, '14:00', 120)?.map((s) => s.startTime)).toEqual([
      '14:00',
      '15:00',
    ]);
  });
});
