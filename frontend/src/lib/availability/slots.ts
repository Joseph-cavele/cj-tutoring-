/**
 * Slot arithmetic.
 *
 * Pure functions with no database access, so the booking service and the
 * booking UI can agree on what a slot is without duplicating the maths.
 * Times are "HH:mm" in South African local time; SAST is UTC+2 all year with
 * no daylight saving, which is why plain string times are safe here.
 */

export type Slot = {
  /** "HH:mm" */
  startTime: string;
  /** "HH:mm" */
  endTime: string;
};

/** SAST is UTC+2 year-round. */
export const SAST_OFFSET_MINUTES = 120;

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function toTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

/**
 * "Now" as the tutoring business experiences it.
 *
 * Computed from the UTC clock rather than the host's local timezone: the app
 * runs on servers set to UTC, and "is this slot in the past" must not depend
 * on where it is deployed (booking rule 5).
 */
export function nowInSast(now: Date = new Date()): { isoDate: string; minutes: number } {
  const shifted = new Date(now.getTime() + SAST_OFFSET_MINUTES * 60 * 1000);

  return {
    isoDate: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/**
 * Cuts a window into back-to-back slots of `slotMinutes`.
 * A trailing part-slot is dropped: a lesson must fit inside the window.
 */
export function generateSlots(
  startTime: string,
  endTime: string,
  slotMinutes: number
): Slot[] {
  const start = toMinutes(startTime);
  const end = toMinutes(endTime);
  const slots: Slot[] = [];

  if (slotMinutes <= 0) return slots;

  for (let cursor = start; cursor + slotMinutes <= end; cursor += slotMinutes) {
    slots.push({ startTime: toTime(cursor), endTime: toTime(cursor + slotMinutes) });
  }

  return slots;
}

/** True when two half-open ranges share any minute. */
export function overlaps(a: Slot, b: Slot): boolean {
  return toMinutes(a.startTime) < toMinutes(b.endTime) &&
    toMinutes(b.startTime) < toMinutes(a.endTime);
}

/** Removes any slot that collides with something already booked. */
export function removeTaken(slots: Slot[], taken: Slot[]): Slot[] {
  return slots.filter((slot) => !taken.some((busy) => overlaps(slot, busy)));
}

/** Midnight UTC for a "YYYY-MM-DD" string, so a date is one stable key. */
export function toDateOnly(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Drops slots that have already started today (booking rule 5).
 * `now` is injected so this stays pure and testable.
 */
export function removePast(slots: Slot[], isoDate: string, now: Date = new Date()): Slot[] {
  const today = nowInSast(now);

  if (isoDate > today.isoDate) return slots;
  if (isoDate < today.isoDate) return [];

  return slots.filter((slot) => toMinutes(slot.startTime) > today.minutes);
}

/** True when a date and time have already passed in South Africa. */
export function isInPast(isoDate: string, startTime: string, now: Date = new Date()): boolean {
  const today = nowInSast(now);

  if (isoDate < today.isoDate) return true;
  if (isoDate > today.isoDate) return false;

  return toMinutes(startTime) <= today.minutes;
}

/**
 * De-duplicates and orders a set of slots.
 *
 * A tutor may offer overlapping windows for online and in-person work, which
 * would otherwise surface the same start time twice in the picker.
 */
export function normaliseSlots(slots: Slot[]): Slot[] {
  const seen = new Map<string, Slot>();

  for (const slot of slots) {
    if (!seen.has(slot.startTime)) seen.set(slot.startTime, slot);
  }

  return [...seen.values()].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));
}

/**
 * The run of slots a lesson occupies.
 *
 * A lesson may be longer than one slot, in which case it must sit on
 * back-to-back slots that the tutor actually offers. Returns null when the
 * lesson does not start on a real slot boundary, runs past the end of the
 * window, or crosses a gap - all of which mean the request falls outside the
 * tutor's availability (booking rule 4).
 */
export function coveredSlots(
  offered: Slot[],
  startTime: string,
  durationMinutes: number
): Slot[] | null {
  const ordered = normaliseSlots(offered);
  const firstIndex = ordered.findIndex((slot) => slot.startTime === startTime);

  if (firstIndex === -1) return null;

  const covered: Slot[] = [];
  let cursor = toMinutes(startTime);
  const target = cursor + durationMinutes;

  for (let index = firstIndex; index < ordered.length && cursor < target; index += 1) {
    const slot = ordered[index];

    // A gap between this slot and the previous one means the tutor is not
    // available for the whole lesson.
    if (toMinutes(slot.startTime) !== cursor) return null;

    covered.push(slot);
    cursor = toMinutes(slot.endTime);
  }

  // Ran out of slots before reaching the requested length.
  if (cursor !== target) return null;

  return covered;
}

/** Durations a tutor's window can serve, as whole multiples of its slot size. */
export function durationOptions(slotMinutes: number, maxMinutes = 180): number[] {
  const options: number[] = [];

  for (let minutes = slotMinutes; minutes <= maxMinutes; minutes += slotMinutes) {
    options.push(minutes);
  }

  return options;
}

/** "09:00" + 90 -> "10:30". */
export function addMinutes(time: string, minutes: number): string {
  return toTime(toMinutes(time) + minutes);
}
