import type { Role } from '@/models/types';

/**
 * Who counts as staff.
 *
 * CJ Private Tutoring is run by one tutor who is also the owner, so `tutor` is
 * not a limited teaching account: it IS the administrator role, with full reach
 * over the business sections (accounts, applications, money, subjects).
 *
 * The list is kept as a list, and every call site keeps going through it, even
 * though it currently holds a single role. That is deliberate: if a second
 * staff role is ever added, widening the platform is a one-line change here
 * rather than a hunt through forty `role === 'tutor'` comparisons.
 *
 * This does NOT dissolve per-record scoping. Students and parents are still
 * narrowed to their own rows by `bookingScopeFor` and friends, which is what
 * keeps the checks in CLAUDE.md section 25 meaningful.
 *
 * Edge-safe: `@/models/types` pulls in no Mongoose, so the proxy can import it.
 */
export const STAFF_ROLES = ['tutor'] as const satisfies readonly Role[];

export type StaffRole = (typeof STAFF_ROLES)[number];

/** True when this role may reach the business/owner sections. */
export function isStaff(role: Role | undefined): role is StaffRole {
  return role === 'tutor';
}
