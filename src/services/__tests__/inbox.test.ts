import {
  countUnread,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notifyInApp,
  notifyManyInApp,
} from '@/services/inbox.service';
import { Notification } from '@/models';
import type { SessionUser } from '@/lib/auth/guard';

/**
 * A notification carries a child's test result and a family's payment
 * reference, so the only thing worth pinning here is that every query is
 * bounded by the session's own user id - and that the id is part of the FILTER
 * rather than something compared after the row has already been loaded.
 */

jest.mock('../../lib/mongodb', () => ({ connectDB: jest.fn().mockResolvedValue(undefined) }));

jest.mock('../../models', () => ({
  Notification: {
    create: jest.fn(),
    insertMany: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    updateOne: jest.fn(),
    updateMany: jest.fn(),
  },
}));

const mocked = {
  create: Notification.create as unknown as jest.Mock,
  insertMany: Notification.insertMany as unknown as jest.Mock,
  find: Notification.find as jest.Mock,
  countDocuments: Notification.countDocuments as jest.Mock,
  updateOne: Notification.updateOne as jest.Mock,
  updateMany: Notification.updateMany as jest.Mock,
};

const alice: SessionUser = { id: 'user-alice', role: 'parent' } as SessionUser;
const NOTIFICATION_ID = '64b7f9c2e1a4d5f6a7b8c9d0';

const givenRows = (rows: unknown[]) => {
  mocked.find.mockReturnValue({
    sort: () => ({ limit: () => ({ lean: async () => rows }) }),
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  givenRows([]);
  mocked.countDocuments.mockResolvedValue(0);
  mocked.updateOne.mockResolvedValue({ modifiedCount: 1 });
  mocked.updateMany.mockResolvedValue({ modifiedCount: 3 });
});

describe('reading', () => {
  it('only ever asks for this user rows', async () => {
    await listNotifications(alice);

    expect(mocked.find).toHaveBeenCalledWith({ user: 'user-alice' });
  });

  it('narrows to unread when asked', async () => {
    await listNotifications(alice, { unreadOnly: true });

    expect(mocked.find).toHaveBeenCalledWith({ user: 'user-alice', readAt: null });
  });

  it('counts only this user unread rows', async () => {
    await countUnread(alice);

    const filter = mocked.countDocuments.mock.calls[0][0];

    expect(filter.user).toBe('user-alice');
  });

  it('treats a row with no readAt field as unread', async () => {
    // Rows written before readAt existed have no such field, and $or covers
    // both that and an explicit null.
    await countUnread(alice);

    const filter = mocked.countDocuments.mock.calls[0][0];

    expect(filter.$or).toEqual([{ readAt: null }, { readAt: { $exists: false } }]);
  });

  it('maps a stored row to the shape the list renders', async () => {
    givenRows([
      {
        _id: { toString: () => 'n1' },
        type: 'booking_accepted',
        title: 'Lesson confirmed',
        body: 'Tuesday at 15:00',
        link: '/parent/dashboard',
        readAt: null,
        createdAt: new Date('2026-09-01T10:00:00.000Z'),
      },
    ]);

    const [view] = await listNotifications(alice);

    expect(view).toEqual({
      notificationId: 'n1',
      type: 'booking_accepted',
      title: 'Lesson confirmed',
      body: 'Tuesday at 15:00',
      link: '/parent/dashboard',
      isRead: false,
      createdAt: '2026-09-01T10:00:00.000Z',
    });
  });
});

describe('marking read', () => {
  /**
   * The important one. If the owner were checked after loading, there would be
   * a moment where somebody else's notification had been fetched. Putting the
   * user id in the filter means it is never selected in the first place.
   */
  it('puts the owner in the update filter, not in a check afterwards', async () => {
    await markNotificationRead(alice, NOTIFICATION_ID);

    const [filter] = mocked.updateOne.mock.calls[0];

    expect(filter.user).toBe('user-alice');
    expect(filter._id).toBe(NOTIFICATION_ID);
  });

  it('reports no update when nothing matched, which is what a foreign id does', async () => {
    mocked.updateOne.mockResolvedValue({ modifiedCount: 0 });

    expect(await markNotificationRead(alice, NOTIFICATION_ID)).toEqual({ updated: false });
  });

  it('clears only this user rows when marking all read', async () => {
    const result = await markAllNotificationsRead(alice);

    const [filter] = mocked.updateMany.mock.calls[0];

    expect(filter.user).toBe('user-alice');
    expect(result).toEqual({ updated: 3 });
  });
});

describe('writing', () => {
  it('records an in-app notification against one user', async () => {
    await notifyInApp({
      userId: 'user-bob',
      type: 'payment_received',
      title: 'Payment received - R300',
    });

    expect(mocked.create).toHaveBeenCalledWith(
      expect.objectContaining({ user: 'user-bob', type: 'payment_received', channels: ['in_app'] })
    );
  });

  /**
   * A notification is a side effect of something that already happened. If the
   * write fails, the lesson was still accepted, so this must not throw and
   * unwind the caller.
   */
  it('never throws when the write fails', async () => {
    mocked.create.mockRejectedValue(new Error('mongo is down'));

    // The service logs the failure, which is right in production and noise
    // here - the assertion is that it resolves rather than throws.
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(
      notifyInApp({ userId: 'user-bob', type: 'account', title: 'Hello' })
    ).resolves.toBe(false);

    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it('writes a batch in one call and tolerates a bad row', async () => {
    mocked.insertMany.mockResolvedValue([{}, {}]);

    const written = await notifyManyInApp({
      userIds: ['a', 'b'],
      type: 'test_published',
      title: 'New test',
    });

    expect(written).toBe(2);
    expect(mocked.insertMany).toHaveBeenCalledWith(expect.any(Array), { ordered: false });
  });

  it('does not hit the database for an empty batch', async () => {
    expect(await notifyManyInApp({ userIds: [], type: 'test_published', title: 'x' })).toBe(0);
    expect(mocked.insertMany).not.toHaveBeenCalled();
  });
});
