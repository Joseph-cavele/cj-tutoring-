import type { Metadata } from 'next';

import AuthShell, { AuthLink } from '@/components/auth/AuthShell';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Forgot Password | CJ Private Tutoring',
  description: 'Reset the password on your CJ Private Tutoring account.',
};

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Forgot your password?"
      subtitle="Enter the email address on your account and we will send you a link to choose a new one."
      welcomeHeadline="Maths & Physical Science"
      welcomeBody="It happens. One email and you will be back in your lessons in a minute."
      footer={
        <>
          Remembered it? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
