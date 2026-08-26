import { handlers } from '@/auth';

// NextAuth owns every /api/auth/* route: signin, signout, callback, session.
export const { GET, POST } = handlers;
