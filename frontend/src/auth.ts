import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';
import { LOGIN_RULES, checkRateLimit } from '@/lib/rate-limit';
import type { Role } from '@/models/types';

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  // JWT rather than a database session: the Credentials provider requires it,
  // and the proxy can then read the role from the cookie without a DB round trip.
  // Short-lived on purpose. A dashboard holds a child's marks, attendance and
  // payment history, and these are often opened on shared or family devices,
  // so a session that lasts a month is the wrong default. One hour of
  // inactivity ends it; updateAge refreshes it while the user is actually
  // working, so an active session is not cut off mid-task.
  session: { strategy: 'jwt', maxAge: 60 * 60, updateAge: 15 * 60 },

  pages: { signIn: '/login' },

  /**
   * Derive the origin from the request rather than from a fixed base.
   *
   * Without this, Next normalises request.url to localhost, so every absolute
   * url NextAuth builds points a phone on the LAN back at its own machine - a
   * dead address. That is what the redirect callback below used to work around
   * by returning a bare path, until that broke client-side sign-in.
   *
   * Safe here because the app is only ever reached through a host we control:
   * Vercel in production (which enables this automatically anyway) and the dev
   * server on the LAN.
   */
  trustHost: true,

  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },

      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        // Password guessing is throttled here rather than in a route handler,
        // because NextAuth owns /api/auth/* and the proxy deliberately does
        // not run on it - so this is the only point every sign-in passes
        // through. Keyed by address, so one account cannot be hammered from a
        // rotating set of IPs. Returning null rather than throwing keeps the
        // response indistinguishable from a wrong password, which is what
        // stops the limit itself being used to probe for real accounts.
        const rate = await checkRateLimit(`login:${email.toLowerCase()}`, LOGIN_RULES);

        if (!rate.allowed) return null;

        await connectDB();

        // passwordHash is select:false on the schema, so ask for it explicitly.
        const user = await User.findOne({ email }).select('+passwordHash');

        // Same null for "no such user" and "wrong password" so the response
        // cannot be used to discover which emails are registered.
        // User must have passwordHash, must have created their password (passwordSet !== false), and must be active.
        if (!user || !user.passwordHash || user.passwordSet === false) return null;
        if (!user.isActive) return null;

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) return null;

        const updateFields: { lastLoginAt: Date; passwordSet?: boolean } = {
          lastLoginAt: new Date(),
        };
        if (user.passwordSet === undefined) {
          updateFields.passwordSet = true;
        }

        await User.updateOne({ _id: user._id }, { $set: updateFields });

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          image: user.avatar?.url,
        };
      },
    }),
  ],

  callbacks: {
    /**
     * Runs on sign-in and on every token refresh. What it writes here is what
     * the proxy later reads via getToken, so role must be set.
     *
     * It also revalidates the account against the database. A JWT session
     * cannot be revoked by deleting a row - the token is self-contained and
     * stays valid until it expires - so without this check, changing a
     * password or deactivating an account would leave every existing session
     * running for up to an hour. Returning null ends the session.
     *
     * The cost is one indexed lookup by _id per token read, projected down to
     * three fields. That is a deliberate trade: this app holds children's
     * marks and payment history, and "signed out everywhere" has to mean it.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role as Role;
        return token;
      }

      if (!token.id) return token;

      await connectDB();

      const account = await User.findById(token.id)
        .select('role isActive sessionsValidFrom')
        .lean();

      // Deleted or deactivated since the token was issued.
      if (!account || !account.isActive) return null;

      // Issued before the last credential change, so it belongs to a password
      // that no longer opens this account. `iat` is in seconds.
      if (account.sessionsValidFrom && token.iat) {
        if (account.sessionsValidFrom.getTime() > token.iat * 1000) return null;
      }

      // A role changed by an admin takes effect at the next request rather
      // than at the next sign-in.
      token.role = account.role;

      return token;
    },

    /**
     * Keeps post-auth navigation on whichever origin the browser is already on.
     *
     * Next normalises request.url to localhost, so NextAuth derives
     * baseUrl = http://localhost:3000 even when the page was opened from a
     * phone at http://192.168.x.x:3000. Any absolute URL built from that
     * baseUrl sends the handset to itself, which is a dead address - it broke
     * the sign-out button on mobile.
     *
     * Reducing every target to a path sidesteps the host question entirely,
     * and closes the open redirect at the same time: an off-site callbackUrl
     * becomes a path on this site rather than a jump to someone else's.
     */
    async redirect({ url, baseUrl }) {
      // Must return an ABSOLUTE url. Returning a path looks harmless on the
      // server, but signIn(..., { redirect: false }) in the browser reads the
      // result with `new URL(data.url)` and no base, so a path throws
      // "Failed to construct 'URL': Invalid URL" after a successful sign-in.
      try {
        // Resolves a path against the origin and leaves an absolute url alone.
        const target = new URL(url, baseUrl);

        // Off-site targets collapse to our own root: a callbackUrl is
        // attacker-supplied, and must not become a jump to another host.
        if (target.origin !== new URL(baseUrl).origin) return baseUrl;

        return target.toString();
      } catch {
        // Not a url at all, so there is nothing safe to honour.
        return baseUrl;
      }
    },

    // Copies those fields onto the session object used by server components.
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
      }
      return session;
    },
  },
});
