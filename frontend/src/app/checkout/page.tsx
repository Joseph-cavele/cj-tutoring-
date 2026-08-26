import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check } from 'lucide-react';

import { auth } from '@/auth';
import { getActivePackages, formatMode, formatPrice } from '@/services/pricing.service';
import CheckoutButton from '@/components/checkout/CheckoutButton';

export const metadata: Metadata = {
  title: 'Checkout | CJ Private Tutoring',
};

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ package?: string }>;
}) {
  const session = await auth();
  const { package: slug } = await searchParams;

  // Paying requires an account, so send them to sign in and come straight back.
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/checkout?package=${slug ?? ''}`)}`);
  }

  const packages = await getActivePackages();
  const chosen = packages.find((pkg) => pkg.slug === slug);

  return (
    <section className="bg-brand-cream py-14 lg:py-20">
      <div className="mx-auto max-w-xl px-4 sm:px-6">
        <h1 className="text-center text-3xl font-extrabold tracking-tight text-brand-navy sm:text-4xl">
          Checkout
        </h1>

        {!chosen ? (
          <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-[var(--shadow-soft)]">
            <p className="text-[15px] text-brand-slate">
              We could not find that package.{' '}
              <Link href="/pricing" className="font-semibold text-brand-blue underline">
                Choose one from the pricing page
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="mt-8 rounded-3xl bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
            <p className="text-[13px] font-bold tracking-wider text-brand-slate uppercase">
              You are buying
            </p>
            <h2 className="mt-2 text-2xl font-extrabold text-brand-navy">{chosen.name}</h2>
            <p className="mt-1 text-[14px] font-semibold text-brand-blue">
              {formatMode(chosen.mode)}
            </p>

            {chosen.description && (
              <p className="mt-3 text-[14px] leading-relaxed text-brand-slate">
                {chosen.description}
              </p>
            )}

            {chosen.sessionsIncluded ? (
              <p className="mt-4 flex items-start gap-2.5 text-[14px] text-brand-navy">
                <Check className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden="true" />
                {chosen.sessionsIncluded} × {chosen.sessionDurationMinutes}-minute sessions
              </p>
            ) : null}

            <div className="mt-6 flex items-baseline justify-between border-t border-brand-blue-100 pt-6">
              <span className="text-[15px] font-semibold text-brand-navy">Total due today</span>
              <span className="text-3xl font-extrabold tracking-tight text-brand-navy">
                {formatPrice(chosen.amount, chosen.currency)}
              </span>
            </div>

            <div className="mt-6">
              <CheckoutButton packageSlug={chosen.slug} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
