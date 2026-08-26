import Link from 'next/link';
import { GraduationCap } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * Split-panel frame for the auth screens: a filled welcome panel beside the
 * form, per the reference design.
 *
 * Server component - the forms it wraps hold all the interactivity.
 *
 * On mobile the welcome panel collapses to a short header rather than stacking
 * a full-height decorative block above the fields, which would push the form
 * below the fold on a phone (CLAUDE.md section 29: students are on phones).
 */
export default function AuthShell({
  title,
  subtitle,
  welcomeHeadline,
  welcomeBody,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  welcomeHeadline: string;
  welcomeBody: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <section className="bg-brand-cream px-4 py-8 sm:px-6 lg:py-16">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-float)] lg:grid-cols-2">
        {/* Welcome panel */}
        <div className="relative isolate overflow-hidden bg-brand-blue p-8 text-white lg:p-12">
          {/* Soft circles from the reference. */}
          <div
            aria-hidden="true"
            className="absolute -top-16 -left-20 -z-10 size-64 rounded-full bg-white/10"
          />
          <div
            aria-hidden="true"
            className="absolute -right-16 -bottom-24 -z-10 size-72 rounded-full bg-brand-blue-dark/60"
          />

          <Link href="/" className="inline-flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-full bg-brand-amber text-brand-navy"
            >
              <GraduationCap className="size-6" strokeWidth={2.5} />
            </span>
            <span className="text-lg font-extrabold tracking-tight">CJ Tutoring</span>
          </Link>

          <div className="mt-10 lg:mt-20">
            <p className="text-3xl leading-none font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
              WELCOME
            </p>
            <p className="mt-2 text-[15px] font-bold tracking-wide text-brand-amber uppercase">
              {welcomeHeadline}
            </p>
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-white/75">
              {welcomeBody}
            </p>
          </div>
        </div>

        {/* Form panel */}
        <div className="p-6 sm:p-8 lg:p-12">
          <h1 className="text-2xl font-extrabold tracking-tight text-brand-navy sm:text-3xl">
            {title}
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-brand-slate">{subtitle}</p>

          <div className="mt-7">{children}</div>

          <p className="mt-6 text-center text-[14px] text-brand-slate">{footer}</p>
        </div>
      </div>
    </section>
  );
}

export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="font-semibold text-brand-blue underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
    >
      {children}
    </Link>
  );
}

/**
 * Field wrapper with a leading icon, as in the reference. `trailing` carries
 * the SHOW/HIDE control on the password field.
 */
export function IconField({
  icon,
  trailing,
  className,
  children,
}: {
  icon: React.ReactNode;
  trailing?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-brand-blue-100 bg-brand-blue-50/40 px-4 focus-within:border-brand-blue focus-within:bg-white',
        className
      )}
    >
      <span aria-hidden="true" className="shrink-0 text-brand-slate">
        {icon}
      </span>
      {children}
      {trailing}
    </div>
  );
}

/** Bare input styling for use inside IconField. Used by the sign-in form. */
export const AUTH_INPUT_CLASS =
  'min-h-12 w-full border-0 bg-transparent text-[15px] text-brand-navy placeholder:text-brand-slate/60 focus:outline-none';

/**
 * Standalone bordered field. The register form labels each input above it, so
 * it uses this rather than the icon-prefixed variant.
 */
export const AUTH_FIELD_CLASS =
  'min-h-12 w-full rounded-xl border border-brand-blue-100 bg-brand-blue-50/40 px-4 text-[15px] text-brand-navy placeholder:text-brand-slate/60 focus:border-brand-blue focus:bg-white focus:outline-2 focus:outline-offset-1 focus:outline-brand-blue';
