'use client';

import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';

type Status = { kind: 'idle' } | { kind: 'sending' } | { kind: 'done'; message: string; ok: boolean };

export default function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus({ kind: 'sending' });

    try {
      const response = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, company }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus({ kind: 'done', ok: false, message: data.error ?? 'Please try again.' });
        return;
      }

      setEmail('');
      setStatus({ kind: 'done', ok: true, message: 'Thanks - you are on the list.' });
    } catch {
      setStatus({ kind: 'done', ok: false, message: 'No connection. Please try again.' });
    }
  };

  const isSending = status.kind === 'sending';

  return (
    <form onSubmit={onSubmit} className="w-full sm:max-w-md">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="subscribe-email" className="sr-only">
          Your email address
        </label>
        <input
          id="subscribe-email"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Enter your email"
          autoComplete="email"
          className="min-h-12 flex-1 rounded-full bg-white/95 px-5 text-[15px] text-brand-navy placeholder:text-brand-slate/70 focus:outline-2 focus:outline-offset-2 focus:outline-brand-amber"
        />

        {/* Honeypot - hidden from people, tempting to bots. */}
        <div aria-hidden="true" className="absolute left-[-9999px]">
          <label htmlFor="subscribe-company">Company</label>
          <input
            id="subscribe-company"
            tabIndex={-1}
            autoComplete="off"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          />
        </div>

        <button
          type="submit"
          disabled={isSending}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-amber px-7 text-[15px] font-semibold whitespace-nowrap text-brand-navy transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60"
        >
          {isSending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isSending ? 'Sending' : 'Subscribe'}
        </button>
      </div>

      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-[13px]">
        {status.kind === 'done' && (
          <span className={status.ok ? 'text-white/85' : 'text-brand-amber'}>
            {status.message}
          </span>
        )}
      </p>
    </form>
  );
}
