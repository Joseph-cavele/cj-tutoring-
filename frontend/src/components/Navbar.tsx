import { auth } from '@/auth';
import { NavbarShell } from '@/components/navbar-shell';
import { countUnread } from '@/services/inbox.service';
import type { SessionUser } from '@/lib/auth/guard';

/**
 * Site header for CJ Private Tutoring.
 *
 * Server component: it reads the session here so the role never has to be
 * fetched from the browser, and the header renders correct on first paint
 * rather than flashing a signed-out state. All interactivity lives in
 * NavbarShell, which receives only two plain serialisable props.
 */
export default async function Navbar() {
  const session = await auth();
  const isSignedIn = Boolean(session?.user?.id);

  /**
   * The unread count is read here rather than fetched from the browser, so the
   * badge is right on first paint instead of appearing a moment later.
   *
   * A failure is swallowed to zero on purpose: the header sits on every page,
   * and a database hiccup must not take the whole site down over a badge.
   */
  let unreadCount = 0;

  if (isSignedIn) {
    try {
      unreadCount = await countUnread(session!.user as SessionUser);
    } catch (error) {
      console.error('[navbar] could not count notifications', error);
    }
  }

  return <NavbarShell isSignedIn={isSignedIn} unreadCount={unreadCount} />;
}
