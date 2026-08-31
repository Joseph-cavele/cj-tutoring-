import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireUser } from '@/lib/auth/guard';
import { listNotifications } from '@/services/inbox.service';
import { homeForRole } from '@/lib/routes';
import NotificationList from '@/components/notifications/NotificationList';

export const metadata: Metadata = {
  title: 'Notifications | CJ Private Tutoring',
};

export const dynamic = 'force-dynamic';

/**
 * One notifications page for every role (brief section 26).
 *
 * Not under /student, /tutor or /parent: an inbox is the same thing whoever
 * you are, and three copies would be three places for the scoping to drift.
 * The service filters by the session's own user id, so this page needs no
 * role check beyond "is signed in".
 */
export default async function NotificationsPage() {
  const user = await requireUser('/notifications');

  const notifications = await listNotifications(user);

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <Link
          href={homeForRole(user.role)}
          className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to dashboard
        </Link>

        <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
          Notifications
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-brand-slate">
          Lesson confirmations, payments and test results.
        </p>

        <div className="mt-8">
          <NotificationList notifications={notifications} />
        </div>
      </div>
    </section>
  );
}
