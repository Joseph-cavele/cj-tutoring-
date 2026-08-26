import { Suspense } from 'react';
import type { Metadata } from 'next';

import AuthShell, { AuthLink } from '@/components/auth/AuthShell';
import LoginForm from '@/components/auth/LoginForm';

export const metadata: Metadata = {
  title: 'Sign In | CJ Private Tutoring',
  description: 'Sign in to your CJ Private Tutoring account.',
};

export default function LoginPage() {
  return (
    <AuthShell
      title="Sign in"
      subtitle="Enter your details to reach your lessons, results and progress."
      welcomeHeadline="Maths & Physical Science"
      welcomeBody="Grades 8 to 12, online and in person. Pick up exactly where your last lesson left off."
      footer={
        <>
          Don&apos;t have an account? <AuthLink href="/register">Sign up</AuthLink>
        </>
      }
    >
      {/* useSearchParams needs a Suspense boundary during prerender. */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
