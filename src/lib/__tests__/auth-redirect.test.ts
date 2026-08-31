/**
 * The redirect callback's contract, pinned.
 *
 * NextAuth hands whatever this returns to the browser, where
 * signIn(..., { redirect: false }) parses it with `new URL(value)` and no
 * base. A bare path therefore throws "Failed to construct 'URL': Invalid URL"
 * AFTER the password has already been accepted - a sign-in that succeeds on
 * the server and fails in the form. So every branch must return something
 * `new URL()` can parse on its own.
 *
 * The logic is duplicated here rather than imported: src/auth.ts initialises
 * NextAuth and reaches for Mongoose at module scope, which a unit test should
 * not drag in.
 */
function redirect({ url, baseUrl }: { url: string; baseUrl: string }): string {
  try {
    const target = new URL(url, baseUrl);
    if (target.origin !== new URL(baseUrl).origin) return baseUrl;
    return target.toString();
  } catch {
    return baseUrl;
  }
}

const baseUrl = 'http://192.168.0.171:3000';

describe('auth redirect callback', () => {
  it('always returns something new URL() can parse unaided', () => {
    const inputs = [
      '/tutor/dashboard',
      '/student/dashboard?from=login',
      `${baseUrl}/parent/dashboard`,
      'https://evil.example.com/steal',
      'not a url at all',
      '',
    ];

    for (const url of inputs) {
      // The exact call the browser makes. It must not throw.
      expect(() => new URL(redirect({ url, baseUrl }))).not.toThrow();
    }
  });

  it('resolves a path against the origin the browser is actually on', () => {
    expect(redirect({ url: '/tutor/dashboard', baseUrl })).toBe(
      'http://192.168.0.171:3000/tutor/dashboard'
    );
  });

  it('keeps the query string, so callbackUrl targets survive', () => {
    expect(redirect({ url: '/student/tests?attempt=3', baseUrl })).toBe(
      'http://192.168.0.171:3000/student/tests?attempt=3'
    );
  });

  it('leaves a same-origin absolute url alone', () => {
    expect(redirect({ url: `${baseUrl}/parent/dashboard`, baseUrl })).toBe(
      `${baseUrl}/parent/dashboard`
    );
  });

  it('refuses to send anyone to another host', () => {
    expect(redirect({ url: 'https://evil.example.com/steal', baseUrl })).toBe(baseUrl);
    // Protocol-relative urls are the easy one to miss: //host is absolute.
    expect(redirect({ url: '//evil.example.com/steal', baseUrl })).toBe(baseUrl);
  });

  it('keeps junk on our own origin', () => {
    // `new URL('not a url', base)` does not throw - it resolves as a relative
    // path - so this lands on a same-origin 404 rather than hitting the catch.
    // That is acceptable: the two properties that matter are that the result
    // is absolute and that it cannot leave this host, and both hold. Only
    // someone hand-crafting a callbackUrl can reach it.
    const result = redirect({ url: 'not a url at all', baseUrl });

    expect(new URL(result).origin).toBe(baseUrl);
    expect(result.startsWith(baseUrl)).toBe(true);
  });
});
