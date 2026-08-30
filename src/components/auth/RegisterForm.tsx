'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { GraduationCap, Loader2, Users } from 'lucide-react';

import { GRADES } from '@/lib/curriculum';
import { registerSchema, type RegisterInput, type SignupRole } from '@/validations/auth';
import { AUTH_FIELD_CLASS } from './AuthShell';

/**
 * Who may sign themselves up. Mirrors SIGNUP_ROLES, which is the schema that
 * actually enforces it - there is no Tutor option because the tutor owns the
 * platform and that account is made from the command line, not a public form.
 */
const ROLE_OPTIONS = [
  { value: 'student', label: 'Student', hint: 'I am the learner', icon: GraduationCap },
  { value: 'parent', label: 'Parent', hint: 'I am signing up for my child', icon: Users },
] as const satisfies readonly { value: SignupRole; label: string; hint: string; icon: typeof Users }[];

export default function RegisterForm() {
  const router = useRouter();
  const [role, setRole] = useState<SignupRole>('student');
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    // react-hook-form cannot narrow a discriminated union on its own, so the
    // resolver is asserted to the union type. Validation still runs in full.
    resolver: zodResolver(registerSchema) as Resolver<RegisterInput>,
    defaultValues: {
      role: 'student',
      name: '',
      email: '',
      password: '',
      phone: '',
      company: '',
      grade: 10,
    } as RegisterInput,
  });

  const chooseRole = (next: SignupRole) => {
    setRole(next);
    setValue('role', next, { shouldValidate: false });
  };

  const onSubmit = async (values: RegisterInput) => {
    setFormError(null);

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(values),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setFormError(data.error ?? 'Could not create your account. Please try again.');
      return;
    }

    // Every registration is an application, and the account stays closed until
    // the tutor accepts it, so signing in would fail. Say so here rather than
    // bouncing them off a login screen that refuses them without explanation.
    if (data.requiresApproval) {
      setPendingApproval(true);
      return;
    }

    // Kept as the fallback: registration does NOT sign anyone in. The new
    // account holder proves they know the password by logging in with it,
    // which also means a shared device is never left holding a session nobody
    // asked for.
    router.push('/login?registered=1');
  };

  if (pendingApproval) {
    return (
      <div role="status" className="text-center">
        <h2 className="text-xl font-bold text-brand-navy">Thank you for applying</h2>
        <p className="mt-3 text-[15px] leading-relaxed text-brand-slate">
          Your application has been sent to your tutor. Every new account is
          reviewed before it is opened, so you cannot sign in just yet.
        </p>
        <p className="mt-3 text-[15px] leading-relaxed text-brand-slate">
          We have emailed you to confirm we have it, and we will email you again
          as soon as your tutor has answered. You can sign in with the password
          you just chose from that moment.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {/* Role chooser */}
      <fieldset>
        <legend className="text-[14px] font-semibold text-brand-navy">
          I am signing up as
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {ROLE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isSelected = role === option.value;

            return (
              <label
                key={option.value}
                className={`flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-[1.5px] p-3 text-center transition-colors ${
                  isSelected
                    ? 'border-brand-blue bg-brand-blue-50'
                    : 'border-brand-blue-100 hover:bg-brand-blue-50/50'
                }`}
              >
                <input
                  type="radio"
                  name="role-choice"
                  value={option.value}
                  checked={isSelected}
                  onChange={() => chooseRole(option.value)}
                  className="sr-only"
                />
                <Icon
                  className={`size-5 ${isSelected ? 'text-brand-blue' : 'text-brand-slate'}`}
                  aria-hidden="true"
                />
                <span className="text-[14px] font-bold text-brand-navy">{option.label}</span>
                <span className="text-[12px] text-brand-slate">{option.hint}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <Field label="Full name" htmlFor="name" error={errors.name?.message}>
        <input
          id="name"
          autoComplete="name"
          placeholder="Thandi Mokoena"
          className={AUTH_FIELD_CLASS}
          {...register('name')}
        />
      </Field>

      <Field label="Email" htmlFor="email" error={errors.email?.message}>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className={AUTH_FIELD_CLASS}
          {...register('email')}
        />
      </Field>

      {role === 'student' && (
        <Field
          label="Grade"
          htmlFor="grade"
          error={'grade' in errors ? errors.grade?.message : undefined}
        >
          <select
            id="grade"
            className={AUTH_FIELD_CLASS}
            {...register('grade', { valueAsNumber: true })}
          >
            {GRADES.map((grade) => (
              <option key={grade} value={grade}>
                Grade {grade}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field
        label="Phone (optional)"
        htmlFor="phone"
        error={errors.phone?.message}
      >
        <input
          id="phone"
          type="tel"
          autoComplete="tel"
          placeholder="0710836571"
          className={AUTH_FIELD_CLASS}
          {...register('phone')}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          className={AUTH_FIELD_CLASS}
          {...register('password')}
        />
      </Field>

      {/* Honeypot */}
      <div aria-hidden="true" className="absolute left-[-9999px]">
        <label htmlFor="company">Company</label>
        <input id="company" tabIndex={-1} autoComplete="off" {...register('company')} />
      </div>

      {formError && (
        <p role="alert" className="text-[14px] font-semibold text-red-600">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-blue px-7 text-[15px] font-semibold text-white transition-colors hover:bg-brand-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue disabled:opacity-60"
      >
        {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isSubmitting ? 'Creating account' : 'Create Account'}
      </button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="text-[14px] font-semibold text-brand-navy">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1.5 text-[13px] text-red-600">{error}</p>}
    </div>
  );
}
