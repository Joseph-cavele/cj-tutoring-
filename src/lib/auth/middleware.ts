import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import type { Role } from '@/models/types';
import type { SessionUser } from '@/lib/auth/guard';

export type ApiAuthResult =
  | { user: SessionUser; response: null }
  | { user: null; response: NextResponse };

/**
 * API route helper to ensure the caller is authenticated.
 * Returns 401 Unauthorized if there is no active session.
 */
export async function requireApiAuth(): Promise<ApiAuthResult> {
  const session = await auth();

  if (!session?.user?.id || !session.user.role) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return {
    user: session.user as SessionUser,
    response: null,
  };
}

/**
 * API route helper to ensure the caller is authenticated AND possesses one of the allowed roles.
 * Returns 401 Unauthorized if not authenticated.
 * Returns 403 Forbidden if the authenticated user's role is not in the allowed list.
 */
export async function requireApiRole(
  roles: Role | readonly Role[]
): Promise<ApiAuthResult> {
  const authResult = await requireApiAuth();

  if (authResult.response) {
    return authResult;
  }

  const allowed = Array.isArray(roles) ? roles : [roles as Role];

  if (!allowed.includes(authResult.user.role)) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return authResult;
}
