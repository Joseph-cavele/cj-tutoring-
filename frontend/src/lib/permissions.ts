import { ROLES, type Role } from '@/models/types';

/**
 * The permission matrix (brief section 31).
 *
 * WHAT THIS IS
 * One table naming every privileged operation and the roles allowed to attempt
 * it. Before this existed, answering "may a parent cancel a booking?" meant
 * reading three files and hoping none of them disagreed. Now it is one lookup,
 * and the table is unit-tested.
 *
 * WHAT THIS IS NOT
 * This is a ROLE gate, not an OWNERSHIP gate, and the difference is the whole
 * security model. `can('parent', 'bookings:cancel')` is true for every parent
 * on the platform - it says nothing about whether THIS parent may cancel THAT
 * booking. The record-level question is answered separately, and always from
 * the database:
 *
 *   - `bookingScopeFor`     narrows a query to rows the user may read
 *   - `resolveBookingActor` proves a parent is linked to the child they name
 *   - the services         re-check the specific record they are about to write
 *
 * Both layers are required (CLAUDE.md section 25). A capability check alone
 * would let any parent cancel any child's lesson.
 *
 * Deliberately pure: no imports beyond the Role type, so it runs on the Edge,
 * in a unit test, and in a client component without dragging in Mongoose or
 * NextAuth.
 */

export const CAPABILITIES = [
  // People and accounts
  'accounts:manage',          // change a role, activate or deactivate an account
  'accounts:link-children',   // link or unlink a parent and a student
  'applications:decide',      // accept or decline someone asking to join
  'children:add',             // a parent registering their own child
  'children:invite',          // the tutor issues a code linking a parent to a child
  'children:claim',           // a parent redeems that code

  // Catalogue and diary
  'subjects:manage',
  'availability:manage',      // set the hours you teach
  'tutor-profile:manage',     // your own bio, subjects and rate
  'tutor-records:manage',     // approve or edit a tutor record

  // Bookings
  'bookings:create',
  'bookings:cancel',
  'bookings:decide',          // accept or reject a requested lesson
  'bookings:override',        // force any status, for corrections

  // Teaching
  'lessons:record',           // the post-lesson write-up and attendance

  // Academic
  'tests:manage',             // save, publish, close, delete
  'tests:generate',           // AI generation
  'tests:mark',               // change a mark, including one the AI suggested
  'tests:attempt',            // sit a test
  'materials:manage',
  'performance:read-all',     // every student's results, not just your own

  // Money
  'payments:checkout',        // start paying for a lesson
  'payments:manage',          // reconcile, refund, read the revenue view
] as const;

export type Capability = (typeof CAPABILITIES)[number];

/**
 * Everything the owner may do.
 *
 * `tests:attempt` and `children:add` are excluded, and not as an oversight:
 * both need a Student or Parent profile that a tutor account does not have, so
 * granting them would produce a confusing 409 from the service rather than a
 * clean refusal here.
 */
const PARENT_ONLY = ['children:add', 'children:claim'] as const;

const TUTOR_CAPABILITIES = CAPABILITIES.filter(
  (capability) =>
    capability !== 'tests:attempt' &&
    !(PARENT_ONLY as readonly string[]).includes(capability)
);

/**
 * Role -> what that role may attempt.
 *
 * Student and parent are near-identical because a parent acts FOR a child:
 * they book, cancel and pay, but never touch academic records. That is the
 * "✗ edit academic information" line in the brief, expressed once.
 */
export const ROLE_CAPABILITIES: Record<Role, readonly Capability[]> = {
  tutor: TUTOR_CAPABILITIES,

  student: ['bookings:create', 'bookings:cancel', 'tests:attempt', 'payments:checkout'],

  parent: [
    'bookings:create',
    'bookings:cancel',
    'children:add',
    'children:claim',
    'payments:checkout',
  ],
};

/** May this role attempt this operation at all? */
export function can(role: Role | undefined, capability: Capability): boolean {
  if (!role) return false;
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

/** Everything a role may attempt. Useful for tests and for hiding dead UI. */
export function capabilitiesFor(role: Role | undefined): readonly Capability[] {
  return role ? (ROLE_CAPABILITIES[role] ?? []) : [];
}

/** Which roles hold a capability. Used by the matrix test to catch drift. */
export function rolesWith(capability: Capability): Role[] {
  return ROLES.filter((role) => can(role, capability));
}
