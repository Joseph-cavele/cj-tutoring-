'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Eye, EyeOff, Loader2, Lock } from 'lucide-react';

import { AUTH_INPUT_CLASS, IconField } from '@/components/auth/AuthShell';
import { ErrorNote, PRIMARY_BUTTON } from '@/components/booking/ui';

/**
 * Chooses a password from a one-time link.
 *
 * The token is passed straight back to the API and is the only thing that
 * identifies the account - this form never learns whose account it is beyond
 * the name the server chose to show.
 */
export default function ResetPasswordForm({
  token,
  purpose,
}: {
  token: string;
  purpose: 'setup' | 'reset' | 'invite';
}) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setPending(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(
          data.issues?.length
            ? data.issues[0].message
            : (data.error ?? 'Could not set your password. Please try again.')
        );
        return;
      }

      setDone(true);
    } catch {
      setError('No connection. Please check your network and try again.');
    } finally {
      setPending(false);
    }
  };

  if (done) {
    return (
      <div role="status" className="text-center">
        <CheckCircle2 className="mx-auto size-12 text-brand-blue" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-bold text-brand-navy">
          {purpose === 'invite' ? 'Your account is ready' : 'Password changed'}
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-brand-slate">
          {purpose === 'invite'
            ? 'You can sign in now and see your lessons.'
            : 'You can sign in with your new password.'}
        </p>
        <Link href="/login" className={`${PRIMARY_BUTTON} mt-6`}>
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label
          htmlFor="password"
          className="block text-[14px] font-semibold text-brand-navy"
        >
          New password
        </label>
        <div className="mt-1.5">
          <IconField
            icon={<Lock className="size-4" />}
            trailing={
              <button
                type="button"
                onClick={() => setVisible((current) => !current)}
                aria-label={visible ? 'Hide password' : 'Show password'}
                className="shrink-0 p-1 text-brand-slate hover:text-brand-navy"
              >
                {visible ? (
                  <EyeOff className="size-4" aria-hidden="true" />
                ) : (
                  <Eye className="size-4" aria-hidden="true" />
                )}
              </button>
            }
          >
            <input
              id="password"
              type={visible ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={AUTH_INPUT_CLASS}
            />
          </IconField>
        </div>
        <p className="mt-1.5 text-[13px] text-brand-slate">
          At least 8 characters, with an uppercase letter, a lowercase letter and
          a number.
        </p>
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-[14px] font-semibold text-brand-navy"
        >
          Confirm password
        </label>
        <div className="mt-1.5">
          <IconField icon={<Lock className="size-4" />}>
            <input
              id="confirmPassword"
              type={visible ? 'text' : 'password'}
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={AUTH_INPUT_CLASS}
            />
          </IconField>
        </div>
      </div>

      {error ? <ErrorNote message={error} /> : null}

      <button
        type="submit"
        disabled={pending || !password || !confirmPassword}
        className={`${PRIMARY_BUTTON} w-full`}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Saving&hellip;
          </>
        ) : purpose === 'invite' ? (
          'Activate my account'
        ) : (
          'Set new password'
        )}
      </button>
    </form>
  );
}
