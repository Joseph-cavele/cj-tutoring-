import { ROLES, type Role } from '@/models/types';
import { HOME_BY_ROLE, SECTION_BY_ROLE, homeForRole } from '../routes';

/**
 * The proxy redirects with whatever this returns, so a value that is not a
 * path is not a cosmetic bug - it is a redirect to a page that does not exist.
 * The role reaching it comes from a JWT and from documents written before the
 * roles changed, so it cannot be assumed to be a current Role.
 */

describe('homeForRole', () => {
  it('sends every current role to its own dashboard', () => {
    for (const role of ROLES) {
      expect(homeForRole(role)).toBe(HOME_BY_ROLE[role]);
      expect(homeForRole(role).startsWith('/')).toBe(true);
    }
  });

  it('falls back when the session carries no role', () => {
    expect(homeForRole(undefined)).toBe('/dashboard');
    expect(homeForRole(undefined, '/login')).toBe('/login');
  });

  it('falls back for a role that no longer exists', () => {
    // 'admin' was retired when the platform moved to three roles, but accounts
    // created before that still carry it. It must not resolve to "/undefined".
    const retired = 'admin' as unknown as Role;

    expect(homeForRole(retired)).toBe('/dashboard');
    expect(homeForRole(retired, '/login')).toBe('/login');
  });
});

describe('route tables', () => {
  it('covers every role, so no role is left without a home or a section', () => {
    for (const role of ROLES) {
      expect(HOME_BY_ROLE[role]).toBeTruthy();
      expect(SECTION_BY_ROLE[role]).toBeTruthy();
    }
  });

  it('keeps each role home inside that role own section', () => {
    for (const role of ROLES) {
      expect(HOME_BY_ROLE[role].startsWith(SECTION_BY_ROLE[role])).toBe(true);
    }
  });
});
