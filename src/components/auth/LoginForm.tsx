'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { Loader2, Lock, Mail } from 'lucide-react';

import { loginSchema, type LoginInput } from '@/validations/auth';
import { AUTH_INPUT_CLASS, AuthLink, IconField } from './AuthShell';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const passwordWasSet = searchParams.get('passwordSet') === '1';

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginInput) => {
    setFormError(null);

    // redirect:false keeps a failed attempt on this page with a message rather
    // than bouncing to NextAuth's own error screen.
    const result = await signIn('credentials', { ...values, redirect: false });

    if (!result || result.error) {
      // Deliberately vague about which of the two was wrong: the response must
      // not reveal which emails exist.
      setFormError(
        'Invalid email or password. Please check your credentials or create your password if invited.'
      );
      return;
    }

    const callbackUrl = searchParams.get('callbackUrl') ?? '/dashboard';
    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      {passwordWasSet && (
        <div
          role="status"
          className="rounded-xl bg-green-50 border border-green-200 p-3.5 text-[14px] font-semibold text-green-800"
        >
          Your password has been set successfully! Please sign in below.
        </div>
      )}
      <div>
        <label htmlFor="email" className="sr-only">
          Email
        </label>
        <IconField icon={<Mail className="size-4" />}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="Email address"
            className={AUTH_INPUT_CLASS}
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </IconField>
        {errors.email && (
          <p className="mt-1.5 text-[13px] text-red-600">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="sr-only">
          Password
        </label>
        <IconField
          icon={<Lock className="size-4" />}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              // Announces state rather than just swapping the label silently.
              aria-pressed={showPassword}
              className="shrink-0 text-[12px] font-bold tracking-wide text-brand-blue uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
            >
              {showPassword ? 'Hide' : 'Show'}
              <span className="sr-only"> password</span>
            </button>
          }
        >
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Password"
            className={AUTH_INPUT_CLASS}
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </IconField>
        {errors.password && (
          <p className="mt-1.5 text-[13px] text-red-600">{errors.password.message}</p>
        )}
      </div>

      <div className="flex justify-end">
        <AuthLink href="/forgot-password">Forgot password?</AuthLink>
      </div>

      {formError && (
        <p role="alert" className="text-[14px] font-semibold text-red-600">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-blue px-7 text-[15px] font-semibold text-white transition-colors hover:bg-brand-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue disabled:opacity-60"
      >
        {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isSubmitting ? 'Signing in' : 'Sign in'}
      </button>
    </form>
  );
}
