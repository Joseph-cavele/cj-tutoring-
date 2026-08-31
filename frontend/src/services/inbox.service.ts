import { connectDB } from '@/lib/mongodb';
import { Notification } from '@/models';
import type { SessionUser } from '@/lib/auth/guard';
import type { NotificationType } from '@/lib/notifications/constants';

/**
 * In-app notifications (brief section 26).
 *
 * The Notification model has existed since the schema was first written and
 * was imported by nothing: every notification the platform sent was an email,
 * so anyone who missed the email had no way to discover what had happened.
 * This is the reader and writer for the bell.
 *
 * AUTHORIZATION
 * Every read and every write is filtered by the session's own user id, and no
 * notification id is ever trusted on its own. `markRead` updates with the
 * owner in the FILTER rather than loading the row and comparing afterwards -
 * a row that is not yours simply does not match, so there is no window in
 * which the wrong document has been fetched (CLAUDE.md section 25).
 *
 * Writing is deliberately best-effort and never throws. A notification is a
 * side effect of something that already happened: a lesson really was accepted
 * and a payment really did clear, and a write failing here must not roll that
 * back or surface an error to the person who did it.
 */

export type NotificationView = {
  notificationId: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

/** Newest first, capped: nobody scrolls past fifty. */
const LIST_LIMIT = 50;

/**
 * Records one notification for one person.
 *
 * Returns whether it was written, for callers that want to log. Swallows its
 * own errors for the reason in the module comment.
 */
export async function notifyInApp(params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  /** Where clicking it should land, as a path on this site. */
  link?: string;
}): Promise<boolean> {
  try {
    await connectDB();

    await Notification.create({
      user: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link,
      channels: ['in_app'],
    });

    return true;
  } catch (error) {
    console.error('[inbox] could not record notification', params.type, error);
    return false;
  }
}

/** The same notification for several people, e.g. a test published to a class. */
export async function notifyManyInApp(params: {
  userIds: string[];
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}): Promise<number> {
  if (params.userIds.length === 0) return 0;

  try {
    await connectDB();

    // One insert rather than a loop: a grade can hold thirty students.
    const rows = await Notification.insertMany(
      params.userIds.map((userId) => ({
        user: userId,
        type: params.type,
        title: params.title,
        body: params.body,
        link: params.link,
        channels: ['in_app'],
      })),
      // A single bad id must not lose the whole batch.
      { ordered: false }
    );

    return rows.length;
  } catch (error) {
    console.error('[inbox] could not record notifications', params.type, error);
    return 0;
  }
}

/** This user's notifications, newest first. Never anybody else's. */
export async function listNotifications(
  user: SessionUser,
  options: { unreadOnly?: boolean } = {}
): Promise<NotificationView[]> {
  await connectDB();

  const filter: Record<string, unknown> = { user: user.id };

  if (options.unreadOnly) filter.readAt = null;

  const rows = await Notification.find(filter)
    .sort({ createdAt: -1 })
    .limit(LIST_LIMIT)
    .lean();

  return rows.map((row) => ({
    notificationId: row._id.toString(),
    type: row.type,
    title: row.title,
    body: row.body ?? null,
    link: row.link ?? null,
    isRead: Boolean(row.readAt),
    createdAt: row.createdAt.toISOString(),
  }));
}

/** The bell badge. */
export async function countUnread(user: SessionUser): Promise<number> {
  await connectDB();

  return Notification.countDocuments({
    user: user.id,
    $or: [{ readAt: null }, { readAt: { $exists: false } }],
  });
}

/**
 * Marks one notification read.
 *
 * The owner is part of the filter, so a notification belonging to somebody
 * else matches nothing and is reported as not found - which is also what a
 * genuinely missing id does, so the response cannot be used to discover which
 * ids exist.
 */
export async function markNotificationRead(
  user: SessionUser,
  notificationId: string
): Promise<{ updated: boolean }> {
  await connectDB();

  const result = await Notification.updateOne(
    { _id: notificationId, user: user.id, readAt: null },
    { $set: { readAt: new Date() } }
  );

  return { updated: result.modifiedCount > 0 };
}

/** Clears the badge in one go. */
export async function markAllNotificationsRead(
  user: SessionUser
): Promise<{ updated: number }> {
  await connectDB();

  const result = await Notification.updateMany(
    { user: user.id, $or: [{ readAt: null }, { readAt: { $exists: false } }] },
    { $set: { readAt: new Date() } }
  );

  return { updated: result.modifiedCount };
}
