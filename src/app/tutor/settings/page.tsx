import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { requireRole } from '@/lib/auth/guard';
import { STAFF_ROLES } from '@/lib/auth/roles';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models';
import AccountSettings from '@/components/tutor/AccountSettings';
import LogoutButton from '@/components/LogoutButton';

export const dynamic = 'force-dynamic';

/**
 * Owner account settings: the email address and password you sign in with.
 *
 * The email is read from the database rather than the session, because the
 * session token keeps whatever address was current when you signed in - after
 * a change it would show the old one until the next sign-in.
 */
export default async function TutorSettingsPage() {
  const user = await requireRole(STAFF_ROLES, '/tutor/settings');

  await connectDB();

  const account = await User.findById(user.id).select('email').lean();

  return (
    <section className="bg-brand-cream py-10 lg:py-14">
      <div className="mx-auto max-w-2xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div>
          <Link
            href="/tutor/dashboard"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-blue hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to dashboard
          </Link>

          <h1 className="mt-4 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
            Settings
          </h1>
          <p className="mt-2 text-[15px] text-brand-slate">
            Your sign-in details. Changing either one needs your current
            password, so an unattended screen is not enough to take the account
            over.
          </p>
        </div>

        <AccountSettings currentEmail={account?.email ?? user.email ?? ''} />

        <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <h2 className="text-[18px] font-extrabold text-brand-navy">Sign out</h2>
          <p className="mt-1 text-[14px] leading-relaxed text-brand-slate">
            Ends this session and returns you to the home page. Worth doing on a
            shared or borrowed device.
          </p>
          <div className="mt-4">
            <LogoutButton />
          </div>
        </div>
      </div>
    </section>
  );
}
