import { redirect } from 'next/navigation';

import { requireUser } from '@/lib/auth/guard';
import { homeForRole } from '@/lib/routes';

export const dynamic = 'force-dynamic';

/**
 * Neutral landing spot after sign-in. Every role may enter, and it forwards
 * each one to the dashboard that belongs to them.
 */
export default async function DashboardPage() {
  const user = await requireUser('/dashboard');
  redirect(homeForRole(user.role, '/login'));
}
