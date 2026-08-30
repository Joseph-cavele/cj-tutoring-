'use server';

import { revalidatePath } from 'next/cache';

import { getCapableUser } from '@/lib/auth/guard';
import { CalendarError, addTimeOff, removeTimeOff } from '@/services/calendar.service';
import { removeTimeOffSchema, timeOffSchema } from '@/validations/calendar';
import type { ActionResult } from '@/actions/booking.actions';

/**
 * Blocking and reopening days on the tutor's calendar.
 *
 * Reuses `availability:manage` rather than inventing a capability: blocking a
 * date and setting weekly hours are the same authority over the same diary,
 * and splitting them would imply a distinction the app does not make.
 */

function fromError(error: unknown): ActionResult<never> {
  if (error instanceof CalendarError) return { ok: false, error: error.message };

  console.error('[calendar action] unexpected error', error);
  return { ok: false, error: 'Something went wrong. Please try again.' };
}

/** Both the calendar and the public booking page change when a day is blocked. */
function revalidateCalendar() {
  revalidatePath('/tutor/calendar');
  revalidatePath('/booking');
}

export async function addTimeOffAction(
  input: unknown
): Promise<ActionResult<{ clashingBookings: number }>> {
  const user = await getCapableUser('availability:manage');

  if (!user) return { ok: false, error: 'Please sign in again.' };

  const parsed = timeOffSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Choose a date.' };
  }

  try {
    const result = await addTimeOff({
      user,
      isoDate: parsed.data.isoDate,
      reason: parsed.data.reason,
    });

    revalidateCalendar();

    return { ok: true, data: { clashingBookings: result.clashingBookings } };
  } catch (error) {
    return fromError(error);
  }
}

export async function removeTimeOffAction(input: unknown): Promise<ActionResult> {
  const user = await getCapableUser('availability:manage');

  if (!user) return { ok: false, error: 'Please sign in again.' };

  const parsed = removeTimeOffSchema.safeParse(input);

  if (!parsed.success) return { ok: false, error: 'Choose a date.' };

  try {
    await removeTimeOff({ user, isoDate: parsed.data.isoDate });

    revalidateCalendar();

    return { ok: true };
  } catch (error) {
    return fromError(error);
  }
}
