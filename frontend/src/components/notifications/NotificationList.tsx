'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { BellOff, Check, Loader2 } from 'lucide-react';

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/actions/notification.actions';
import { toneFor } from '@/lib/notifications/constants';
import type { NotificationView } from '@/services/inbox.service';

/**
 * The notification list (brief section 26).
 *
 * Marking one read is fire-and-forget: the row is already on screen and the
 * server revalidates the page, so there is no optimistic state to keep in sync
 * and nothing useful to say if the write fails - the entry simply stays bold
 * and the next click tries again.
 */

const TONE_BAR: Record<string, string> = {
  blue: 'bg-brand-blue',
  amber: 'bg-brand-amber',
  red: 'bg-red-400',
  slate: 'bg-brand-slate',
};

export default function NotificationList({
  notifications,
}: {
  notifications: NotificationView[];
}) {
  const [pending, startTransition] = useTransition();

  const unread = notifications.filter((entry) => !entry.isRead).length;

  if (notifications.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-[var(--shadow-soft)]">
        <BellOff className="mx-auto size-6 text-brand-slate" aria-hidden="true" />
        <h2 className="mt-2 text-[16px] font-bold text-brand-navy">Nothing yet</h2>
        <p className="mx-auto mt-1 max-w-sm text-[14px] leading-relaxed text-brand-slate">
          Lesson confirmations, payments and test results will appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {unread > 0 ? (
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await markAllNotificationsReadAction();
              })
            }
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-[1.5px] border-brand-blue px-4 text-[14px] font-semibold text-brand-blue transition-colors hover:bg-brand-blue-50 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Check className="size-4" aria-hidden="true" />
            )}
            Mark all read
          </button>
        </div>
      ) : null}

      <ul className="space-y-2">
        {notifications.map((entry) => (
          <li key={entry.notificationId}>
            <Row entry={entry} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ entry }: { entry: NotificationView }) {
  const [, startTransition] = useTransition();

  const read = () => {
    if (entry.isRead) return;

    startTransition(async () => {
      await markNotificationReadAction({ notificationId: entry.notificationId });
    });
  };

  const when = new Intl.DateTimeFormat('en-ZA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(entry.createdAt));

  const body = (
    <div
      className={`flex gap-3 rounded-2xl p-4 transition-colors ${
        entry.isRead ? 'bg-white' : 'bg-brand-blue-50'
      }`}
    >
      <span
        className={`mt-1 w-1 shrink-0 rounded-full ${TONE_BAR[toneFor(entry.type)]}`}
        aria-hidden="true"
      />

      <div className="min-w-0 flex-1">
        <p
          className={`text-[15px] text-brand-navy ${
            entry.isRead ? 'font-semibold' : 'font-extrabold'
          }`}
        >
          {entry.title}
        </p>

        {entry.body ? (
          <p className="mt-0.5 text-[14px] leading-relaxed text-brand-slate">{entry.body}</p>
        ) : null}

        <p className="mt-1 text-[12px] text-brand-slate">
          {when}
          {entry.isRead ? '' : ' · new'}
        </p>
      </div>
    </div>
  );

  // Only an internal path is ever followed. `link` is written by the server,
  // never by a user, but keeping the check here means a stray absolute URL
  // could not turn a notification into an off-site redirect.
  if (entry.link && entry.link.startsWith('/')) {
    return (
      <Link href={entry.link} onClick={read} className="block">
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={read} className="block w-full text-left">
      {body}
    </button>
  );
}
