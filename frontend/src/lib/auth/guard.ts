import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { homeForRole } from '@/lib/routes';
import type { Role } from '@/models/types';

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: Role;
};

/**
 * Server-side authorization.
 *
 * The proxy already blocks the wrong role at the edge, but that is a coarse
 * URL-prefix gate and it can be bypassed if the matcher ever changes. CLAUDE.md
 * section 25 and the brief both require the check to be repeated where the work
 * actually happens, so every protected page and action calls one of these.
 *
 * Never rely on hidden UI for authorization.
 */

/** Any signed-in user. Redirects to login otherwise. */
export async function requireUser(callbackUrl?: string): Promise<SessionUser> {
  const session = await auth();

  if (!session?.user?.id || !session.user.role) {
    const target = callbackUrl ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}` : '/login';
    redirect(target);
  }

  return session.user as SessionUser;
}

/**
 * A signed-in user holding one of `roles`.
 *
 * A user with the wrong role is sent to their own dashboard rather than shown
 * an error: they are authenticated, just not entitled to this page.
 */
export async function requireRole(
  roles: Role | Role[],
  callbackUrl?: string
): Promise<SessionUser> {
  const user = await requireUser(callbackUrl);
  const allowed = Array.isArray(roles) ? roles : [roles];

  if (!allowed.includes(user.role)) {
    redirect(homeForRole(user.role, '/login'));
  }

  return user;
}

/**
 * Same check for route handlers and server actions, which must return a
 * response rather than redirect. Returns null when the caller is not allowed.
 */
export async function getAuthorizedUser(
  roles?: Role | Role[]
): Promise<SessionUser | null> {
  const session = await auth();

  if (!session?.user?.id || !session.user.role) return null;

  if (roles) {
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(session.user.role)) return null;
  }

  return session.user as SessionUser;
}
