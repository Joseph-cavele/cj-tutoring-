import type { DefaultSession } from 'next-auth';
import type { Role } from '@/models/types';

// Teaches TypeScript about the extra fields the callbacks put on the
// session and the JWT. Without this, session.user.role does not typecheck
// and middleware would be reading an untyped value.
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession['user'];
  }

  interface User {
    role: Role;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
  }
}
