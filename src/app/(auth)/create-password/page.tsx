import type { Metadata } from 'next';
import { Suspense } from 'react';

import AuthShell, { AuthLink } from '@/components/auth/AuthShell';
import CreatePasswordForm from '@/components/auth/CreatePasswordForm';
import { checkPasswordToken } from '@/services/password.service';

export const metadata: Metadata = {
  title: 'Create Your Password | CJ Private Tutoring',
  description: 'Set up your secure password to access your tutoring platform account.',
};

export const dynamic = 'force-dynamic';

export default async function CreatePasswordPage(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await props.searchParams;

  const check = await checkPasswordToken(token ?? '');

  if (!check.valid) {
    return (
      <AuthShell
        title="Invalid or Expired Link"
        subtitle="Your password setup link is invalid or has expired. Please request a new link."
        welcomeHeadline="Maths & Physical Science"
        welcomeBody="For your security, password setup links are single-use and expire within 2 hours."
        footer={
          <>
            Need help? <AuthLink href="/forgot-password">Request a reset link</AuthLink> or{' '}
            <AuthLink href="/login">Sign in</AuthLink>
          </>
        }
      >
        <div className="rounded-2xl border border-red-200 bg-red-50/80 p-5 text-[14px] leading-relaxed text-red-900 shadow-sm">
          <p className="font-semibold text-red-950">
            Your password setup link is invalid or has expired. Please request a new link.
          </p>
          <p className="mt-2 text-red-800/90 text-[13px]">
            If you were invited or recently registered, please request a new password link or contact your tutor.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your password"
      subtitle={
        check.name
          ? `Welcome ${check.name.split(' ')[0]}! Choose a strong password to secure your account.`
          : 'Choose a strong password to secure your account.'
      }
      welcomeHeadline="Maths & Physical Science"
      welcomeBody="Once your password is set, you can sign in to access your customized dashboard, lessons, and progress."
      footer={
        <>
          Already have a password? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <Suspense fallback={null}>
        <CreatePasswordForm token={token ?? ''} />
      </Suspense>
    </AuthShell>
  );
}
