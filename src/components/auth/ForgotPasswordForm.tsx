'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2, Mail } from 'lucide-react';

import { AUTH_INPUT_CLASS, IconField } from '@/components/auth/AuthShell';
import { ErrorNote, PRIMARY_BUTTON } from '@/components/booking/ui';

/**
 * Requests a reset link.
 *
 * The confirmation is deliberately vague about whether the address exists -
 * the API answers the same either way, and saying "we could not find that
 * account" here would undo that.
 */
export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, company }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? 'Could not send the email. Please try again.');
        return;
      }

      setSent(true);
    } catch {
      setError('No connection. Please check your network and try again.');
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <div role="status" className="text-center">
        <CheckCircle2 className="mx-auto size-12 text-brand-blue" aria-hidden="true" />
        <h2 className="mt-4 text-lg font-bold text-brand-navy">Check your email</h2>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-brand-slate">
          If an account exists for <span className="font-semibold">{email}</span>, a
          link to choose a new password is on its way. It expires in an hour.
        </p>
        <p className="mt-3 text-[13px] text-brand-slate">
          Nothing arrived? Check your spam folder, then try again.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-[14px] font-semibold text-brand-navy">
          Email address
        </label>
        <div className="mt-1.5">
          <IconField icon={<Mail className="size-4" />}>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className={AUTH_INPUT_CLASS}
            />
          </IconField>
        </div>
      </div>

      {/* Honeypot: hidden from people, tempting to bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px]">
        <label htmlFor="company">Company</label>
        <input
          id="company"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
        />
      </div>

      {error ? <ErrorNote message={error} /> : null}

      <button
        type="submit"
        disabled={pending || !email}
        className={`${PRIMARY_BUTTON} w-full`}
      >
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Sending&hellip;
          </>
        ) : (
          'Email me a reset link'
        )}
      </button>
    </form>
  );
}
