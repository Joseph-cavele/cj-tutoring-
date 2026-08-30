import type { Role } from '@/models/types';

/**
 * Who counts as staff.
 *
 * CJ Private Tutoring is run by one tutor who is also the owner, so the tutor
 * role is not a limited teaching account: it carries the same reach as admin
 * over the business sections (accounts, applications, money, subjects). Rather
 * than duplicating `['tutor', 'admin']` at every call site, the pair is named
 * once here so widening or narrowing staff power is a one-line change.
 *
 * This does NOT widen data scoping. A tutor still reads their own bookings and
 * their own students through `bookingScopeFor`, which is what keeps the
 * per-record checks in CLAUDE.md section 25 meaningful if a second tutor is
 * ever added.
 *
 * Edge-safe: `@/models/types` pulls in no Mongoose, so the proxy can import it.
 */
export const STAFF_ROLES = ['tutor', 'admin'] as const satisfies readonly Role[];

export type StaffRole = (typeof STAFF_ROLES)[number];

/** True when this role may reach the business/admin sections. */
export function isStaff(role: Role | undefined): role is StaffRole {
  return role === 'tutor' || role === 'admin';
}
