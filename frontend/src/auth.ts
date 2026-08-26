import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';
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

        await connectDB();

        // passwordHash is select:false on the schema, so ask for it explicitly.
        const user = await User.findOne({ email }).select('+passwordHash');

        // Same null for "no such user" and "wrong password" so the response
        // cannot be used to discover which emails are registered.
        if (!user || !user.passwordHash) return null;
        if (!user.isActive) return null;

        const passwordMatches = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatches) return null;

        await User.updateOne({ _id: user._id }, { lastLoginAt: new Date() });

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
    // Runs on sign-in and on every token refresh. What it writes here is what
    // the proxy later reads via getToken, so role must be set.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role as Role;
      }
      return token;
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
