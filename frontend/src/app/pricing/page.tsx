import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Laptop, MapPin, Users } from 'lucide-react';

import { formatMode, formatPrice, getPricing, type PackageView } from '@/services/pricing.service';

export const metadata: Metadata = {
  title: 'Pricing | CJ Private Tutoring',
  description:
    'Monthly packages, exam preparation packages and hourly rates for Maths and Physical Science tutoring.',
};

/** Prices live in the database, so this page must not be statically cached. */
export const dynamic = 'force-dynamic';

/** Visually led plan, chosen by slug so a price change never moves it. */
const FEATURED_SLUG = 'standard';

export default async function PricingPage() {
  const { monthly, examPrep, hourly } = await getPricing();
  const isEmpty = monthly.length === 0 && examPrep.length === 0 && hourly.length === 0;

  return (
    <>
      {/* Hero band with the page title over a photo, as in the reference. */}
      <section className="relative isolate overflow-hidden bg-brand-blue">
        {/* Background, not a content slot: next/image with fill inside the
            section's own relative box, rather than a bordered placeholder. */}
        <Image
          src="/pricing-hero.png"
          alt=""
          aria-hidden="true"
          fill
          priority
          sizes="100vw"
          // The people sit in the left third; centring the crop keeps them in
          // frame while the open middle stays clear behind the headline.
          className="-z-10 object-cover object-center"
        />
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-brand-blue/85" />

        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-24">
          <h1 className="text-4xl leading-none font-extrabold tracking-tight text-white uppercase sm:text-5xl lg:text-6xl">
            Pricing
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-white/80">
            Online and in-person lessons, monthly packages and exam preparation.
            No joining fee and no contract.
          </p>
        </div>
      </section>

      {isEmpty ? (
        <section className="bg-brand-cream py-16">
          <p className="mx-auto max-w-xl px-4 text-center text-[15px] text-brand-slate">
            Our pricing is being updated.{' '}
            <Link href="/#contact" className="font-semibold text-brand-blue underline">
              Contact us
            </Link>{' '}
            for current rates.
          </p>
        </section>
      ) : (
        <>
          {/* Monthly packages */}
          <section className="bg-brand-cream py-14 lg:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <SectionHeading
                script="Plans made for you"
                title="Monthly packages"
                lead="Billed monthly, per subject. Cancel any time."
              />

              <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {monthly.map((pkg) => (
                  <PackageCard
                    key={pkg.slug}
                    pkg={pkg}
                    suffix="/month"
                    featured={pkg.slug === FEATURED_SLUG}
                  />
                ))}
              </ul>
            </div>
          </section>

          {/* Exam preparation packages */}
          <section className="bg-white py-14 lg:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <SectionHeading
                script="Before the finals"
                title="Exam preparation packages"
                lead="A fixed block of sessions built around past papers and weak topics."
              />

              <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {examPrep.map((pkg) => (
                  <PackageCard key={pkg.slug} pkg={pkg} />
                ))}
              </ul>
            </div>
          </section>

          {/* Hourly rates */}
          <section className="bg-brand-cream py-14 lg:py-20">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <SectionHeading
                script="Pay as you go"
                title="Hourly rates"
                lead="For families who would rather book lessons one at a time."
              />

              <ul className="mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-2">
                {hourly.map((pkg) => (
                  <li
                    key={pkg.slug}
                    className="flex items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-[var(--shadow-soft)]"
                  >
                    <div className="flex items-center gap-3">
                      <ModeIcon mode={pkg.mode} />
                      <div>
                        <p className="text-[15px] font-bold text-brand-navy">{pkg.name}</p>
                        <p className="text-[13px] text-brand-slate">{formatMode(pkg.mode)}</p>
                      </div>
                    </div>
                    <p className="shrink-0 text-[15px] font-extrabold whitespace-nowrap text-brand-navy">
                      {formatPrice(pkg.amount, pkg.currency)}
                      <span className="text-[13px] font-medium text-brand-slate">/hour</span>
                    </p>
                  </li>
                ))}
              </ul>

              <p className="mt-10 text-center text-[14px] text-brand-slate">
                Not sure which fits?{' '}
                <Link href="/#contact" className="font-semibold text-brand-blue underline">
                  Ask us
                </Link>{' '}
                and we will recommend one after your first lesson.
              </p>
            </div>
          </section>
        </>
      )}
    </>
  );
}

function SectionHeading({
  script,
  title,
  lead,
}: {
  script: string;
  title: string;
  lead: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="font-script text-3xl text-brand-amber sm:text-4xl">{script}</p>
      <h2 className="mt-1 text-3xl leading-tight font-extrabold tracking-tight text-brand-navy sm:text-4xl">
        {title}
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-brand-slate">
        {lead}
      </p>
    </div>
  );
}

function ModeIcon({ mode, light }: { mode: string; light?: boolean }) {
  const Icon = mode === 'in_person' ? MapPin : mode === 'hybrid' ? Users : Laptop;

  return (
    <span
      aria-hidden="true"
      className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
        light ? 'bg-white/15 text-brand-amber' : 'bg-brand-blue-50 text-brand-blue'
      }`}
    >
      <Icon className="size-5" />
    </span>
  );
}

function PackageCard({
  pkg,
  suffix,
  featured,
}: {
  pkg: PackageView;
  suffix?: string;
  featured?: boolean;
}) {
  return (
    <li
      className={`flex flex-col rounded-3xl p-6 ${
        featured
          ? 'bg-brand-blue text-white shadow-[var(--shadow-float)] lg:-my-4 lg:py-10'
          : 'bg-white shadow-[var(--shadow-soft)]'
      }`}
    >
      {featured && (
        <p className="mb-3 self-start rounded-full bg-brand-amber px-3 py-1 text-[12px] font-bold tracking-wide text-brand-navy uppercase">
          Most chosen
        </p>
      )}

      <ModeIcon mode={pkg.mode} light={featured} />

      <h3
        className={`mt-4 text-[18px] font-bold ${featured ? 'text-white' : 'text-brand-navy'}`}
      >
        {pkg.name}
      </h3>

      {/* Delivery mode is stated on every card: online and in-person are priced
          differently, so a parent must be able to see which they are reading. */}
      <p
        className={`mt-1 text-[13px] font-semibold ${
          featured ? 'text-brand-amber' : 'text-brand-blue'
        }`}
      >
        {formatMode(pkg.mode)}
      </p>

      {pkg.description && (
        <p
          className={`mt-3 flex-1 text-[13px] leading-relaxed ${
            featured ? 'text-white/75' : 'text-brand-slate'
          }`}
        >
          {pkg.description}
        </p>
      )}

      <p className="mt-5 flex items-baseline gap-1">
        <span
          className={`text-3xl font-extrabold tracking-tight ${
            featured ? 'text-white' : 'text-brand-navy'
          }`}
        >
          {formatPrice(pkg.amount, pkg.currency)}
        </span>
        {suffix && (
          <span className={`text-[13px] ${featured ? 'text-white/70' : 'text-brand-slate'}`}>
            {suffix}
          </span>
        )}
      </p>

      {/* Session counts appear only where the offer actually states one. */}
      {pkg.sessionsIncluded ? (
        <p className={`mt-1 text-[13px] ${featured ? 'text-white/70' : 'text-brand-slate'}`}>
          {pkg.sessionsIncluded} × {pkg.sessionDurationMinutes}-minute sessions
        </p>
      ) : null}

      <Link
        href={`/checkout?package=${pkg.slug}`}
        className={`mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
          featured
            ? 'bg-brand-amber text-brand-navy hover:opacity-90 focus-visible:outline-white'
            : 'border-[1.5px] border-brand-blue text-brand-blue hover:bg-brand-blue-50 focus-visible:outline-brand-blue'
        }`}
      >
        Choose
        <span className="sr-only"> the {pkg.name} package</span>
        <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
      </Link>
    </li>
  );
}
