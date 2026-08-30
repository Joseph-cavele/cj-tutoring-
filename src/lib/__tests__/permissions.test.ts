import {
  CAPABILITIES,
  ROLE_CAPABILITIES,
  can,
  capabilitiesFor,
  rolesWith,
  type Capability,
} from '@/lib/permissions';
import { ROLES } from '@/models/types';

/**
 * The permission matrix is the one place the brief's section 31 rules are
 * written down, so these tests assert the rules themselves rather than the
 * implementation. A change that widens a role has to change a test here, which
 * is the point: silent widening is how authorization bugs ship.
 */

describe('permission matrix', () => {
  it('covers every role', () => {
    for (const role of ROLES) {
      expect(ROLE_CAPABILITIES[role]).toBeDefined();
    }
  });

  it('grants nothing to a missing role', () => {
    expect(can(undefined, 'accounts:manage')).toBe(false);
    expect(capabilitiesFor(undefined)).toEqual([]);
  });

  it('never grants a capability that is not declared', () => {
    for (const role of ROLES) {
      for (const capability of capabilitiesFor(role)) {
        expect(CAPABILITIES).toContain(capability);
      }
    }
  });
});

describe('tutor is the owner', () => {
  it('may manage everything except the profile-bound actions', () => {
    const profileBound: Capability[] = ['tests:attempt', 'children:add', 'children:claim'];

    const expected = CAPABILITIES.filter(
      (capability) => !profileBound.includes(capability)
    );

    expect([...capabilitiesFor('tutor')].sort()).toEqual([...expected].sort());
  });

  it('is the only role that may touch academic records or money', () => {
    const ownerOnly: Capability[] = [
      'accounts:manage',
      'accounts:link-children',
      'applications:decide',
      'subjects:manage',
      'tutor-records:manage',
      'lessons:record',
      'tests:manage',
      'tests:generate',
      'tests:mark',
      'materials:manage',
      'performance:read-all',
      'payments:manage',
      'bookings:decide',
      'bookings:override',
      'children:invite',
    ];

    for (const capability of ownerOnly) {
      expect(rolesWith(capability)).toEqual(['tutor']);
    }
  });
});

describe('student', () => {
  it('may book, cancel, sit tests and pay', () => {
    expect([...capabilitiesFor('student')].sort()).toEqual(
      ['bookings:cancel', 'bookings:create', 'payments:checkout', 'tests:attempt'].sort()
    );
  });

  it('cannot mark its own work or manage anything', () => {
    expect(can('student', 'tests:mark')).toBe(false);
    expect(can('student', 'tests:manage')).toBe(false);
    expect(can('student', 'accounts:manage')).toBe(false);
    expect(can('student', 'performance:read-all')).toBe(false);
  });
});

describe('parent', () => {
  it('may act for a child but never edit academic information', () => {
    expect(can('parent', 'bookings:create')).toBe(true);
    expect(can('parent', 'bookings:cancel')).toBe(true);
    expect(can('parent', 'payments:checkout')).toBe(true);
    expect(can('parent', 'children:add')).toBe(true);
    // Redeeming an invitation code is how a parent reaches an EXISTING child.
    expect(can('parent', 'children:claim')).toBe(true);

    // The "✗ Edit academic information" line of the brief, asserted.
    expect(can('parent', 'tests:mark')).toBe(false);
    expect(can('parent', 'tests:manage')).toBe(false);
    expect(can('parent', 'tests:attempt')).toBe(false);
    expect(can('parent', 'lessons:record')).toBe(false);
    expect(can('parent', 'materials:manage')).toBe(false);
  });

  it('cannot manage other students or the platform', () => {
    expect(can('parent', 'accounts:manage')).toBe(false);
    expect(can('parent', 'accounts:link-children')).toBe(false);
    // A parent may redeem a code but must never be able to issue one.
    expect(can('parent', 'children:invite')).toBe(false);
    expect(can('parent', 'performance:read-all')).toBe(false);
  });
});

describe('the profile-bound capabilities', () => {
  it('belong to exactly the role that has that profile', () => {
    expect(rolesWith('tests:attempt')).toEqual(['student']);
    expect(rolesWith('children:add')).toEqual(['parent']);
    expect(rolesWith('children:claim')).toEqual(['parent']);
  });

  /**
   * The two halves of the invitation flow must never meet in one role: the
   * tutor issues, the parent redeems. A role holding both could mint itself
   * access to any child.
   */
  it('keeps issuing and redeeming an invitation in different roles', () => {
    expect(rolesWith('children:invite')).toEqual(['tutor']);
    expect(rolesWith('children:claim')).toEqual(['parent']);

    for (const role of ROLES) {
      expect(can(role, 'children:invite') && can(role, 'children:claim')).toBe(false);
    }
  });
});
