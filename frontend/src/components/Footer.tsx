import Link from 'next/link';
import { GraduationCap, Mail, MessageCircle, Phone } from 'lucide-react';

import { BRAND } from '@/components/nav-config';
import { CONTACT, mailtoHref, telHref, whatsappHref } from '@/lib/contact';
import SubscribeForm from '@/components/SubscribeForm';

/**
 * Site footer, following the reference: a subscribe bar, then the wordmark and
 * direct-contact row, then a column grid, then the legal line.
 *
 * Server component - only the subscribe form is interactive.
 *
 * The reference has a SOCIAL column of Facebook / Twitter / Instagram /
 * LinkedIn. Those are omitted until real account URLs exist: a social icon that
 * goes nowhere, or to the wrong account, is worse than no icon. Add them to
 * lib/contact.ts and they will render here.
 */
const COLUMNS = [
  {
    heading: 'Learn',
    links: [
      { label: 'Subjects', href: '/subjects' },
      { label: 'How It Works', href: '/how-it-works' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'About', href: '/about' },
    ],
  },
  {
    heading: 'Subjects',
    links: [
      { label: 'Mathematics, Gr 8-12', href: '/subjects#mathematics' },
      { label: 'Physical Science, Gr 10-12', href: '/subjects#physical-science' },
      { label: 'Exam Preparation', href: '/how-it-works#exam-prep' },
      { label: 'Group Classes', href: '/how-it-works#group-classes' },
    ],
  },
  {
    heading: 'Lessons',
    links: [
      { label: 'Online Lessons', href: '/how-it-works#online' },
      { label: 'In-Person Tutoring', href: '/how-it-works#in-person' },
      { label: 'Book a Lesson', href: '/booking' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'Log In', href: '/login' },
      { label: 'Register', href: '/register' },
      { label: 'Dashboard', href: '/dashboard' },
    ],
  },
] as const;

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-brand-navy text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Subscribe bar, raised panel as in the reference. */}
        <div className="mt-12 mb-12 rounded-3xl bg-brand-blue px-6 py-6 sm:px-8 lg:mt-16 lg:mb-16 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div>
            <h2 className="text-lg font-bold sm:text-xl">Subscribe to our news</h2>
            <p className="mt-1 text-[14px] text-white/70">
              Exam dates, study tips and new class times. No more than once a month.
            </p>
          </div>
          <div className="mt-5 lg:mt-0 lg:shrink-0">
            <SubscribeForm />
          </div>
        </div>

        {/* Wordmark and direct contact */}
        <div className="flex flex-col gap-6 border-b border-white/10 pb-10 md:flex-row md:items-center md:justify-between">
          <Link href="/" className="inline-flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex size-11 items-center justify-center rounded-full bg-brand-amber text-brand-navy"
            >
              <GraduationCap className="size-6" strokeWidth={2.5} />
            </span>
            <span className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {BRAND.short}
            </span>
          </Link>

          <ul className="flex flex-wrap items-center gap-3">
            <li>
              <IconLink href={telHref} label={`Call ${CONTACT.phone.display}`}>
                <Phone className="size-5" />
              </IconLink>
            </li>
            <li>
              <IconLink href={mailtoHref} label={`Email ${CONTACT.email}`}>
                <Mail className="size-5" />
              </IconLink>
            </li>
            <li>
              <IconLink href={whatsappHref} label="WhatsApp us" external>
                <MessageCircle className="size-5" />
              </IconLink>
            </li>
          </ul>
        </div>

        {/* Link columns */}
        <div className="grid gap-10 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {COLUMNS.map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h2 className="text-[13px] font-bold tracking-wider text-white/50 uppercase">
                {column.heading}
              </h2>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-[15px] text-white/80 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* Legal line */}
        <div className="flex flex-col gap-3 border-t border-white/10 py-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] text-white/55">
            &copy; {year} {BRAND.full}. All rights reserved.
          </p>
          <ul className="flex flex-wrap gap-5">
            <li>
              <Link
                href="/privacy"
                className="text-[13px] text-white/55 transition-colors hover:text-white"
              >
                Privacy
              </Link>
            </li>
            <li>
              <Link
                href="/terms"
                className="text-[13px] text-white/55 transition-colors hover:text-white"
              >
                Terms
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}

function IconLink({
  href,
  label,
  external,
  children,
}: {
  href: string;
  label: string;
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-brand-amber hover:text-brand-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <span aria-hidden="true">{children}</span>
      <span className="sr-only">{label}</span>
    </a>
  );
}
