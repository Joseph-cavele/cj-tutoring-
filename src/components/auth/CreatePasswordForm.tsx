'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Eye, EyeOff, Loader2, Lock, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import { createPasswordSchema, type CreatePasswordInput } from '@/validations/password';
import { AUTH_INPUT_CLASS, IconField } from './AuthShell';
import { PRIMARY_BUTTON } from '@/components/booking/ui';

export default function CreatePasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreatePasswordInput>({
    resolver: zodResolver(createPasswordSchema),
    defaultValues: {
      token,
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: CreatePasswordInput) => {
    setFormError(null);

    try {
      const response = await fetch('/api/auth/create-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setFormError(
          data.issues?.length
            ? data.issues[0].message
            : (data.error ?? 'Your password setup link is invalid or has expired. Please request a new link.')
        );
        return;
      }

      setIsSuccess(true);
      setTimeout(() => {
        router.push('/login?passwordSet=1');
      }, 1500);
    } catch {
      setFormError('Network error. Please check your connection and try again.');
    }
  };

  if (isSuccess) {
    return (
      <div role="status" className="text-center py-4 space-y-4">
        <CheckCircle2 className="mx-auto size-12 text-green-600" aria-hidden="true" />
        <h2 className="text-xl font-bold text-brand-navy">Password Created Successfully!</h2>
        <p className="text-[14px] text-brand-slate">
          Your account is now activated. Redirecting you to sign in...
        </p>
        <div className="pt-2">
          <Link
            href="/login?passwordSet=1"
            className={`${PRIMARY_BUTTON} inline-flex items-center justify-center`}
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <input type="hidden" {...register('token')} value={token} />

      <div>
        <label htmlFor="password" className="block text-[14px] font-semibold text-brand-navy mb-1.5">
          Password
        </label>
        <IconField
          icon={<Lock className="size-4" />}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-pressed={showPassword}
              className="shrink-0 p-1 text-brand-slate hover:text-brand-navy"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
              <span className="sr-only">Toggle password visibility</span>
            </button>
          }
        >
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Enter your new password"
            className={AUTH_INPUT_CLASS}
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
        </IconField>
        {errors.password && (
          <p className="mt-1 text-[13px] text-red-600">{errors.password.message}</p>
        )}
        <p className="mt-1.5 text-[12px] text-brand-slate flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-brand-blue shrink-0" />
          At least 8 characters with uppercase, lowercase, and a number.
        </p>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-[14px] font-semibold text-brand-navy mb-1.5">
          Confirm Password
        </label>
        <IconField
          icon={<Lock className="size-4" />}
          trailing={
            <button
              type="button"
              onClick={() => setShowConfirmPassword((v) => !v)}
              aria-pressed={showConfirmPassword}
              className="shrink-0 p-1 text-brand-slate hover:text-brand-navy"
            >
              {showConfirmPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
              <span className="sr-only">Toggle confirm password visibility</span>
            </button>
          }
        >
          <input
            id="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Confirm your password"
            className={AUTH_INPUT_CLASS}
            aria-invalid={Boolean(errors.confirmPassword)}
            {...register('confirmPassword')}
          />
        </IconField>
        {errors.confirmPassword && (
          <p className="mt-1 text-[13px] text-red-600">{errors.confirmPassword.message}</p>
        )}
      </div>

      {formError && (
        <div role="alert" className="rounded-xl bg-red-50 p-3 text-[14px] font-semibold text-red-700">
          {formError}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-blue px-7 text-[15px] font-semibold text-white transition-colors hover:bg-brand-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue disabled:opacity-60 cursor-pointer mt-2"
      >
        {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isSubmitting ? 'Creating Password...' : 'Create Password'}
      </button>
    </form>
  );
}
