import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import { homeForRole } from '@/lib/routes';
import { can, type Capability } from '@/lib/permissions';
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
  // readonly so a `[...] as const` list such as STAFF_ROLES can be passed
  // straight in without being copied at every call site.
  roles: Role | readonly Role[],
  callbackUrl?: string
): Promise<SessionUser> {
  const user = await requireUser(callbackUrl);
  const allowed = Array.isArray(roles) ? roles : [roles as Role];

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
  roles?: Role | readonly Role[]
): Promise<SessionUser | null> {
  const session = await auth();

  if (!session?.user?.id || !session.user.role) return null;

  if (roles) {
    const allowed = Array.isArray(roles) ? roles : [roles as Role];
    if (!allowed.includes(session.user.role)) return null;
  }

  return session.user as SessionUser;
}

/**
 * The capability equivalent of `getAuthorizedUser`, for server actions and
 * route handlers.
 *
 * Prefer this over passing a role list by hand. A list written at the call
 * site is a policy decision hidden in forty places; a capability is the same
 * decision made once in `@/lib/permissions`, where it can be read and tested
 * as a table.
 *
 * Returns null - never throws - so an action can answer with a value the form
 * can render, exactly as the role-based guard does.
 *
 * Remember what this does NOT do: it proves the ROLE may attempt the
 * operation, not that this USER owns the record. Keep the ownership check in
 * the service.
 */
export async function getCapableUser(capability: Capability): Promise<SessionUser | null> {
  const user = await getAuthorizedUser();

  if (!user || !can(user.role, capability)) return null;

  return user;
}

/**
 * Same check for a page, which must redirect rather than return null.
 *
 * A user who is signed in but not entitled goes to their own dashboard, not an
 * error screen - they are authenticated, just not allowed here.
 */
export async function requireCapability(
  capability: Capability,
  callbackUrl?: string
): Promise<SessionUser> {
  const user = await requireUser(callbackUrl);

  if (!can(user.role, capability)) {
    redirect(homeForRole(user.role, '/login'));
  }

  return user;
}
