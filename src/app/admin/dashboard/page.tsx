import { requireRole } from '@/lib/auth/guard';
import { STAFF_ROLES } from '@/lib/auth/roles';
import DashboardShell, { type DashboardCard } from '@/components/dashboard/DashboardShell';

export const dynamic = 'force-dynamic';

// Admin scope from CLAUDE.md section 11 and the brief, section 12.
// Only sections that actually exist. A card linking to an unbuilt route is a
// 404 with extra steps, so the rest are added as they are built.
const CARDS: DashboardCard[] = [
  {
    title: 'Applications',
    body: 'Accept or decline the students, parents and tutors asking to join.',
    href: '/tutor/applications',
  },
  {
    title: 'Users',
    body: 'Accounts, roles, and linking parents to their children.',
    href: '/admin/users',
  },
  {
    title: 'Tutors',
    body: 'Approve new tutors, set their rate and subjects, deactivate.',
    href: '/admin/tutors',
  },
  { title: 'Subjects', body: 'Add, edit and remove subjects.', href: '/admin/subjects' },
  {
    title: 'Bookings',
    body: 'Every booking, and the power to change status.',
    href: '/admin/bookings',
  },
  {
    title: 'Availability',
    body: 'Which tutors are open when, and where the gaps are.',
    href: '/admin/availability',
  },
  {
    title: 'Payments',
    body: 'Money collected, outstanding lessons and every invoice.',
    href: '/admin/payments',
  },
  {
    title: 'Settings',
    body: 'Change the email address and password you sign in with.',
    href: '/tutor/settings',
  },
];

export default async function AdminDashboard() {
  // Server-side check. The proxy also guards this prefix, but authorization
  // is never left to the edge alone.
  const user = await requireRole(STAFF_ROLES, '/admin/dashboard');
  const firstName = user.name?.split(' ')[0] ?? 'there';

  // The business is run by one tutor who owns it, so calling their own screen
  // "Admin" would be wrong. Only a separate admin account sees that word.
  const label = user.role === 'tutor' ? 'Owner' : 'Admin';

  return <DashboardShell role={label} greeting={`Hello, ${firstName}`} cards={CARDS} />;
}
