import {
  formatSitting,
  sastLocalToUtc,
  sittingIsoDate,
  sittingTime,
  utcToSastLocal,
} from '@/lib/assessment/schedule';

/**
 * A two-hour mistake here opens a test at the wrong time, so the offset is
 * asserted in both directions and at the boundaries where it changes the date.
 */

describe('sastLocalToUtc', () => {
  it('treats the typed time as South African, not UTC', () => {
    // 15:00 SAST is 13:00 UTC.
    expect(sastLocalToUtc('2026-09-02T15:00')?.toISOString()).toBe(
      '2026-09-02T13:00:00.000Z'
    );
  });

  it('rolls back a day for times in the first two hours', () => {
    // 00:30 on the 2nd in South Africa is 22:30 on the 1st in UTC.
    expect(sastLocalToUtc('2026-09-02T00:30')?.toISOString()).toBe(
      '2026-09-01T22:30:00.000Z'
    );
  });

  it('does not shift with the seasons, because SAST has no daylight saving', () => {
    // Midwinter and midsummer are both UTC+2.
    expect(sastLocalToUtc('2026-06-15T09:00')?.toISOString()).toBe(
      '2026-06-15T07:00:00.000Z'
    );
    expect(sastLocalToUtc('2026-12-15T09:00')?.toISOString()).toBe(
      '2026-12-15T07:00:00.000Z'
    );
  });

  it('rejects anything that is not a wall-clock reading', () => {
    expect(sastLocalToUtc('')).toBeNull();
    expect(sastLocalToUtc('2026-09-02')).toBeNull();
    expect(sastLocalToUtc('2026-09-02T15:00:00Z')).toBeNull();
    expect(sastLocalToUtc('not a date')).toBeNull();
  });
});

describe('utcToSastLocal', () => {
  it('is the exact inverse of sastLocalToUtc', () => {
    for (const local of [
      '2026-09-02T15:00',
      '2026-01-01T00:00',
      '2026-12-31T23:59',
      '2026-06-15T09:30',
    ]) {
      const instant = sastLocalToUtc(local);
      expect(instant).not.toBeNull();
      expect(utcToSastLocal(instant as Date)).toBe(local);
    }
  });
});

describe('reading a sitting back', () => {
  it('reports the South African day, not the UTC one', () => {
    // 23:30 SAST on the 2nd is 21:30 UTC on the 2nd - same day.
    const evening = sastLocalToUtc('2026-09-02T23:30') as Date;
    expect(sittingIsoDate(evening)).toBe('2026-09-02');

    // 01:00 SAST on the 3rd is 23:00 UTC on the 2nd - the UTC date is a day
    // behind, and the timetable must still say the 3rd.
    const earlyHours = sastLocalToUtc('2026-09-03T01:00') as Date;
    expect(earlyHours.toISOString().slice(0, 10)).toBe('2026-09-02');
    expect(sittingIsoDate(earlyHours)).toBe('2026-09-03');
  });

  it('reports the time the tutor typed', () => {
    expect(sittingTime(sastLocalToUtc('2026-09-02T15:00') as Date)).toBe('15:00');
    expect(sittingTime(sastLocalToUtc('2026-09-03T01:00') as Date)).toBe('01:00');
  });
});

describe('formatSitting', () => {
  it('reads the way the brief writes a timetable entry', () => {
    const sitting = formatSitting(sastLocalToUtc('2026-09-02T15:00') as Date);

    expect(sitting.dateLabel).toBe('02 September');
    expect(sitting.timeLabel).toBe('15:00');
  });

  it('keeps the South African day for a sitting late in the evening', () => {
    const sitting = formatSitting(sastLocalToUtc('2026-09-02T23:00') as Date);

    expect(sitting.dateLabel).toBe('02 September');
    expect(sitting.timeLabel).toBe('23:00');
  });
});
