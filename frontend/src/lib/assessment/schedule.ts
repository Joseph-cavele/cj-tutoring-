import { SAST_OFFSET_MINUTES } from '@/lib/availability/slots';

/**
 * Converting between the tutor's clock and the stored instant.
 *
 * A test sitting is stored as a real instant (`Test.availableFrom`), because
 * "is this test open yet" is a comparison against `new Date()` and must not
 * depend on where the server is. But a tutor types "2 September, 15:00"
 * meaning South African time, and a `datetime-local` input has no timezone at
 * all - it hands over a bare "2026-09-02T15:00".
 *
 * Getting that conversion wrong by two hours would open a test at 13:00 or
 * 17:00 instead of 15:00, which is why it lives here as pure functions with
 * tests rather than being done inline wherever a form is submitted.
 *
 * SAST is UTC+2 all year with no daylight saving, so a fixed offset is correct
 * - the same assumption the slot library already makes.
 */

/** "YYYY-MM-DDTHH:mm" as typed in South Africa -> the instant it names. */
export function sastLocalToUtc(localDateTime: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(localDateTime.trim());

  if (!match) return null;

  const [, year, month, day, hours, minutes] = match.map(Number);

  // Build the instant as if the wall-clock reading were UTC, then step back by
  // the offset to land on the moment that reading actually names.
  const asIfUtc = Date.UTC(year, month - 1, day, hours, minutes);
  const instant = new Date(asIfUtc - SAST_OFFSET_MINUTES * 60 * 1000);

  return Number.isNaN(instant.getTime()) ? null : instant;
}

/** The inverse, for putting a stored sitting back into a datetime-local input. */
export function utcToSastLocal(date: Date): string {
  const shifted = new Date(date.getTime() + SAST_OFFSET_MINUTES * 60 * 1000);
  return shifted.toISOString().slice(0, 16);
}

/** The calendar day a sitting falls on, in South Africa. "YYYY-MM-DD". */
export function sittingIsoDate(date: Date): string {
  return utcToSastLocal(date).slice(0, 10);
}

/** "15:00" in South Africa. */
export function sittingTime(date: Date): string {
  return utcToSastLocal(date).slice(11, 16);
}

const DATE_LABEL = new Intl.DateTimeFormat('en-ZA', {
  day: '2-digit',
  month: 'long',
});

/**
 * How a sitting reads on the timetable: "02 September" and "15:00".
 *
 * Formatted from the shifted wall-clock value rather than by handing the
 * Intl formatter a timeZone, so a host with an incomplete ICU build cannot
 * quietly fall back to UTC and print the wrong day for a late-evening test.
 */
export function formatSitting(date: Date): { dateLabel: string; timeLabel: string } {
  const isoDate = sittingIsoDate(date);

  return {
    dateLabel: DATE_LABEL.format(new Date(`${isoDate}T12:00:00.000Z`)),
    timeLabel: sittingTime(date),
  };
}
