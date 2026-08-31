'use server';

import { revalidatePath } from 'next/cache';

import { getAuthorizedUser } from '@/lib/auth/guard';
import {
  markAllNotificationsRead,
  markNotificationRead,
} from '@/services/inbox.service';
import { objectId } from '@/validations/lesson-booking';
import type { ActionResult } from '@/actions/booking.actions';

/**
 * Reading your own notifications.
 *
 * No capability check: every signed-in person has an inbox, and there is no
 * role that may mark somebody else's notification read. The scoping is the
 * service's job - it puts the session's user id in the update filter, so an
 * id belonging to another account simply matches nothing.
 */

export async function markNotificationReadAction(
  input: unknown
): Promise<ActionResult> {
  const user = await getAuthorizedUser();

  if (!user) return { ok: false, error: 'Please sign in again.' };

  const parsed = objectId.safeParse(
    (input as { notificationId?: unknown } | null)?.notificationId
  );

  if (!parsed.success) return { ok: false, error: 'That notification was not recognised.' };

  await markNotificationRead(user, parsed.data);

  revalidatePath('/notifications');

  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const user = await getAuthorizedUser();

  if (!user) return { ok: false, error: 'Please sign in again.' };

  await markAllNotificationsRead(user);

  revalidatePath('/notifications');

  return { ok: true };
}
