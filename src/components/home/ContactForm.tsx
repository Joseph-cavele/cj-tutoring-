'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Send } from 'lucide-react';

import { contactSchema, type ContactInput } from '@/validations/contact';

type Status = { kind: 'idle' } | { kind: 'sent' } | { kind: 'error'; message: string };

/** Underline fields, as in the reference. */
const FIELD_CLASS =
  'w-full border-0 border-b border-brand-blue-100 bg-transparent px-0 py-2.5 text-[15px] text-brand-navy placeholder:text-brand-slate/60 focus:border-brand-blue focus:ring-0 focus:outline-none';

export default function ContactForm() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactInput>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', email: '', subject: '', message: '', company: '' },
  });

  const onSubmit = async (values: ContactInput) => {
    setStatus({ kind: 'idle' });

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus({
          kind: 'error',
          message: data.error ?? 'Message could not be sent. Please try again.',
        });
        return;
      }

      reset();
      setStatus({ kind: 'sent' });
    } catch {
      setStatus({
        kind: 'error',
        message: 'No connection. Please check your network and try again.',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="p-6 sm:p-8 lg:p-10">
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Your Name" error={errors.name?.message} htmlFor="name">
          <input
            id="name"
            autoComplete="name"
            placeholder="Jane Mokoena"
            className={FIELD_CLASS}
            aria-invalid={Boolean(errors.name)}
            {...register('name')}
          />
        </Field>

        <Field label="Your Email" error={errors.email?.message} htmlFor="email">
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className={FIELD_CLASS}
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
        </Field>
      </div>

      <div className="mt-6">
        <Field label="Your Subject" error={errors.subject?.message} htmlFor="subject">
          <input
            id="subject"
            placeholder="Grade 11 Maths tutoring"
            className={FIELD_CLASS}
            aria-invalid={Boolean(errors.subject)}
            {...register('subject')}
          />
        </Field>
      </div>

      <div className="mt-6">
        <Field label="Message" error={errors.message?.message} htmlFor="message">
          <textarea
            id="message"
            rows={4}
            placeholder="Tell us the grade, subject and what your child is finding difficult."
            className={`${FIELD_CLASS} resize-y`}
            aria-invalid={Boolean(errors.message)}
            {...register('message')}
          />
        </Field>
      </div>

      {/* Honeypot: off-screen and skipped by keyboard, so only bots fill it. */}
      <div aria-hidden="true" className="absolute left-[-9999px]">
        <label htmlFor="company">Company</label>
        <input id="company" tabIndex={-1} autoComplete="off" {...register('company')} />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-blue px-8 text-[15px] font-semibold text-white transition-colors hover:bg-brand-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue disabled:opacity-60"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Sending
            </>
          ) : (
            <>
              Send Message
              <Send className="size-4" aria-hidden="true" />
            </>
          )}
        </button>

        {/* Announced to screen readers as it appears, not just shown. */}
        <p role="status" aria-live="polite" className="text-[14px]">
          {status.kind === 'sent' && (
            <span className="font-semibold text-brand-blue">
              Thank you. We will be in touch shortly.
            </span>
          )}
          {status.kind === 'error' && (
            <span className="font-semibold text-red-600">{status.message}</span>
          )}
        </p>
      </div>
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
      <label
        htmlFor={htmlFor}
        className="text-[13px] font-semibold tracking-wide text-brand-slate uppercase"
      >
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1.5 text-[13px] text-red-600">{error}</p>}
    </div>
  );
}
