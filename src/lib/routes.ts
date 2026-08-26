import type { Role } from '@/models/types';

/**
 * Where each role lands after signing in.
 *
 * Shared by the proxy (which redirects a user who strays outside their
 * section), the server-side guards and the header, so the three can never
 * drift apart. Edge-safe: `@/models/types` pulls in no Mongoose.
 */
export const HOME_BY_ROLE: Record<Role, string> = {
  student: '/student/dashboard',
  tutor: '/tutor/dashboard',
  parent: '/parent/dashboard',
  admin: '/admin/dashboard',
};

/** URL prefix owned by each role. Nobody else may enter it. */
export const SECTION_BY_ROLE: Record<Role, string> = {
  student: '/student',
  tutor: '/tutor',
  parent: '/parent',
  admin: '/admin',
};

/**
 * Home for a role, falling back when the session carries no usable role.
 * Callers pick the fallback: the header sends nowhere useful, the proxy
 * sends a role-less session back to login.
 */
export function homeForRole(role: Role | undefined, fallback = '/dashboard'): string {
  return role ? HOME_BY_ROLE[role] : fallback;
}

/** Public booking entry point, referenced by every "Book a Lesson" CTA. */
export const BOOKING_ROUTE = '/booking';
