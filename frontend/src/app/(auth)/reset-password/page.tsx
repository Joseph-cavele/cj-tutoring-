import type { Metadata } from 'next';

import AuthShell, { AuthLink } from '@/components/auth/AuthShell';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';
import { checkPasswordToken } from '@/services/password.service';

export const metadata: Metadata = {
  title: 'Set Your Password | CJ Private Tutoring',
};

// The token is checked per request, so this can never be cached.
export const dynamic = 'force-dynamic';

/**
 * Sets a password from an emailed link.
 *
 * The token is validated on the server before the form renders, so an expired
 * or spent link shows an explanation rather than a form that will fail on
 * submit. The API validates it again on submit regardless - this check is for
 * the person, not for security.
 */
export default async function ResetPasswordPage(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  // searchParams is a Promise in Next 16.
  const { token } = await props.searchParams;

  const check = await checkPasswordToken(token ?? '');

  if (!check.valid) {
    return (
      <AuthShell
        title="That link has expired"
        subtitle="Password links can only be used once, and they do not last forever. Ask for a fresh one and it will arrive in a moment."
        welcomeHeadline="Maths & Physical Science"
        welcomeBody="Links expire so that an old email in an inbox cannot be used to take over an account later."
        footer={
          <>
            Need a new link? <AuthLink href="/forgot-password">Request one</AuthLink>
          </>
        }
      >
        <p className="rounded-xl bg-brand-blue-50/60 p-4 text-[14px] leading-relaxed text-brand-navy">
          If you were setting up a new account, ask whoever invited you to send
          the invitation again.
        </p>
      </AuthShell>
    );
  }

  const isInvite = check.purpose === 'invite';

  return (
    <AuthShell
      title={isInvite ? 'Set up your account' : 'Choose a new password'}
      subtitle={
        check.name
          ? `Hi ${check.name.split(' ')[0]}, pick a password you will remember.`
          : 'Pick a password you will remember.'
      }
      welcomeHeadline="Maths & Physical Science"
      welcomeBody={
        isInvite
          ? 'Once this is set you can sign in and see your lessons, tests and results.'
          : 'Choose something you have not used elsewhere.'
      }
      footer={
        <>
          Know your password? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <ResetPasswordForm token={token ?? ''} purpose={check.purpose ?? 'reset'} />
    </AuthShell>
  );
}
