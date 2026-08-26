import type { Metadata } from 'next';

import AuthShell, { AuthLink } from '@/components/auth/AuthShell';
import RegisterForm from '@/components/auth/RegisterForm';

export const metadata: Metadata = {
  title: 'Create an Account | CJ Private Tutoring',
  description: 'Register as a student, parent or tutor with CJ Private Tutoring.',
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="Create your account"
      subtitle="Tell us who you are and we will set up the right dashboard for you."
      welcomeHeadline="Lessons that fit your week"
      welcomeBody="Maths and Physical Science tutoring for Grades 8 to 12. Individual lessons, group classes and exam preparation."
      footer={
        <>
          Already registered? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <RegisterForm />
    </AuthShell>
  );
}
