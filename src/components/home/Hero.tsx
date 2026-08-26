import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Gift, Sparkles } from 'lucide-react';

import { PRIMARY_CTA } from '@/components/nav-config';

const SECONDARY_CTA = { label: 'Explore Subjects', href: '/subjects' } as const;

/**
 * Landing hero. Design.md section 7 item 2: eyebrow pill, headline with an
 * amber accent phrase, lead line, two CTAs, blob-masked photo, floating card
 * and sparse doodles.
 *
 * Server component - nothing here is interactive (CLAUDE.md section 27).
 */
export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-brand-cream">
      {/* Decorative maths doodles. Hidden from assistive tech per Design.md section 10. */}
      <Doodles />

      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-20">
        {/* Copy column */}
        <div className="relative z-10">
          {/* max-w-full lets the label wrap inside the pill instead of running
              past the column at 320px, where the section's overflow-hidden
              would otherwise clip the tail of it. */}
          <p className="inline-flex max-w-full items-center gap-2 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-brand-navy shadow-[var(--shadow-soft)]">
            <Sparkles className="size-4 shrink-0 text-brand-amber" aria-hidden="true" />
            Structured. Personal. Results-driven.
          </p>

          <h1 className="mt-6 text-4xl leading-[1.05] font-extrabold tracking-tight text-brand-navy sm:text-5xl lg:text-6xl">
            Maths &amp; Science tutoring that{' '}
            <span className="relative inline-block text-brand-amber">
              finally clicks.
              {/* Hand-drawn swash under the accent phrase. */}
              <svg
                aria-hidden="true"
                viewBox="0 0 240 12"
                preserveAspectRatio="none"
                className="absolute -bottom-1 left-0 h-2.5 w-full text-brand-amber"
              >
                <path
                  d="M2 8C40 3 90 2 130 4c38 2 78 4 108 1"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </h1>

          <p className="mt-6 max-w-md text-[17px] leading-relaxed text-brand-slate">
            Online and in-person tutoring for Grades 8 to 12. Individual lessons,
            group classes and exam preparation.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* Design.md section 6: solid blue pill, trailing arrow. 44px min target. */}
            <Link
              href={PRIMARY_CTA.href}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-blue px-7 text-[15px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-brand-blue-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
            >
              {PRIMARY_CTA.label}
              <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </Link>

            <Link
              href={SECONDARY_CTA.href}
              className="inline-flex min-h-12 items-center justify-center rounded-full border-[1.5px] border-brand-blue px-7 text-[15px] font-semibold whitespace-nowrap text-brand-blue transition-colors hover:bg-brand-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue"
            >
              {SECONDARY_CTA.label}
            </Link>
          </div>
        </div>

        {/* Image column */}
        <div className="relative">
          {/* Organic blob mask rather than a rectangle, Design.md section 3. */}
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[48%_52%_58%_42%/46%_44%_56%_54%] bg-brand-blue-50">
            <Image
              src="/image.png"
              alt="A tutor sitting beside a student, helping her work through a problem in her notebook"
              fill
              // Two-column from lg up, full width below.
              sizes="(min-width: 1024px) 40vw, 92vw"
              className="object-cover"
              priority
            />
          </div>

          {/* Floating info card, Design.md section 6. Static flow on mobile so it
              never covers a face on a narrow screen. */}
          <div className="relative z-10 mt-4 rounded-2xl bg-white p-4 shadow-[var(--shadow-float)] sm:max-w-sm lg:absolute lg:-bottom-6 lg:-left-6 lg:mt-0">
            <div className="flex gap-3">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-blue-50 text-brand-blue"
              >
                <Gift className="size-5" />
              </span>
              <div>
                <p className="text-[15px] font-bold text-brand-navy">
                  A different kind of start
                </p>
                <p className="mt-1 text-[13px] leading-snug text-brand-slate">
                  Every new student starts with a short assessment and a
                  personal learning plan built around their grade and subject.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Sparse hand-drawn marks from Design.md section 4. Kept clear of the text
 * column and dropped entirely on narrow viewports (section 9).
 */
function Doodles() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
      <span className="absolute top-24 left-[46%] font-script text-3xl text-brand-blue/50">
        &#8730;3
      </span>
      <svg
        viewBox="0 0 48 42"
        className="absolute top-16 right-24 size-10 text-brand-blue/40"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      >
        <path d="M24 4 44 38H4Z" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        className="absolute top-40 right-[42%] size-6 text-brand-amber/70"
        fill="currentColor"
      >
        <path d="M12 0l2.4 7.2L21.6 9.6 14.4 12 12 19.2 9.6 12 2.4 9.6 9.6 7.2z" />
      </svg>
      <div className="absolute top-56 left-[42%] grid grid-cols-4 gap-1.5">
        {Array.from({ length: 16 }).map((_, index) => (
          <span key={index} className="size-1 rounded-full bg-brand-blue/25" />
        ))}
      </div>
    </div>
  );
}
