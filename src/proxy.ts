import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

import { ROLES, type Role } from '@/models/types';
import { homeForRole } from '@/lib/routes';
import { STAFF_ROLES } from '@/lib/auth/roles';

/**
 * Route protection for CJ Tutoring.
 *
 * Runs on the Edge before a request reaches a page or route handler, so an
 * unauthenticated visitor never renders a protected page at all.
 *
 * This is a coarse gate only. It checks "is there a valid session, and does its
 * role match this URL prefix". Every route handler must still authorize the
 * specific record being touched - the proxy cannot know whether student A is
 * allowed to read booking B.
 */

// Reachable without a session. /api/health is here so uptime probes are not
// redirected to the login page; the handler itself withholds any detail from
// callers who are not admins.
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  // Marketing pages. These are linked from the header and footer, so gating
  // them would send every first-time visitor to the login screen.
  '/subjects',
  '/how-it-works',
  '/pricing',
  '/about',
  '/booking',
  '/privacy',
  '/terms',
  '/api/health',
  // Enquiries come from visitors who have no account yet, by definition. The
  // handler protects itself with IP rate limiting, a honeypot and validation.
  '/api/contact',
  '/api/subscribe',
  // The study assistant answers signed-out visitors too. The handler applies
  // a tighter, IP-keyed rate limit to anonymous callers and stores nothing
  // for them.
  '/api/ai/chat',
  '/api/auth/register',
  '/api/bookings',
  // Paystack posts server-to-server with no session; the handler verifies an
  // HMAC signature instead.
  '/api/webhooks',
];

// URL prefix -> roles allowed to enter it.
const ROLE_ROUTES: Record<string, readonly Role[]> = {
  // Staff only, and staff is the one tutor who owns the business. Everything
  // that used to live under /admin is now a /tutor screen, so this single
  // prefix guards the whole owner side. See @/lib/auth/roles.
  '/tutor': STAFF_ROLES,
  '/student': ['student'],
  '/parent': ['parent'],
  '/dashboard': ROLES,
};

/**
 * Stops a dashboard being repainted from cache after the user leaves or signs
 * out. Without no-store the browser can serve a private page straight from
 * history, showing a child's marks to whoever picks up the device next.
 */
function noStore(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  response.headers.set('Pragma', 'no-cache');
  return response;
}

const isPublic = (pathname: string) =>
  PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

const matchRoleRoute = (pathname: string) =>
  Object.entries(ROLE_ROUTES).find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Read the session cookie. Returns null when absent, expired, or tampered with.
  const isSecure = process.env.NODE_ENV === 'production';
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
    // NextAuth prefixes the cookie with __Secure- over HTTPS.
    secureCookie: isSecure,
    salt: isSecure ? '__Secure-authjs.session-token' : 'authjs.session-token',
  });

  const role = token?.role as Role | undefined;

  // A signed-in user has no business on the login or register screen.
  if (token && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL(homeForRole(role), request.url));
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }


  const roleRoute = matchRoleRoute(pathname);

  // Not a public route and not a role-gated one: require a session and nothing more.
  if (!roleRoute) {
    if (!token) return redirectToLogin(request, pathname, search);
    return noStore(NextResponse.next());
  }

  const [, allowedRoles] = roleRoute;

  if (!token) {
    return redirectToLogin(request, pathname, search);
  }

  // Signed in, but the session carries no role - treat as misconfigured, not authorized.
  if (!role || !allowedRoles.includes(role)) {
    // A session with no valid role is misconfigured, not authorized.
    return NextResponse.redirect(new URL(homeForRole(role, '/login'), request.url));
  }

  return noStore(NextResponse.next());
}

function redirectToLogin(request: NextRequest, pathname: string, search: string) {
  // An API caller cannot follow a redirect to an HTML login page: fetch would
  // receive markup and fail on .json(). Answer those with a real 401 instead.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  // Send the user back where they were headed once they sign in.
  loginUrl.searchParams.set('callbackUrl', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  /**
   * Skip Next internals and static assets so the proxy does not run on every
   * image and script request. /api/auth is excluded because NextAuth's own
   * handlers must stay reachable while signed out.
   */
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
