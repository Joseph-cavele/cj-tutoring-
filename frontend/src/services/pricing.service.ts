import { connectDB } from '@/lib/mongodb';
import { Package } from '@/models';
import type { PackageCategory } from '@/models/types';

/**
 * Pricing is database-driven (CLAUDE.md section 5): prices are never written
 * into a component, and the admin can change them without a deploy.
 */
export type PackageView = {
  slug: string;
  name: string;
  description?: string;
  category: PackageCategory;
  mode: string;
  sessionsIncluded?: number;
  sessionDurationMinutes: number;
  features: { label: string; included: boolean }[];
  amount: number;
  currency: string;
};

/**
 * Rands, whole numbers. Intl puts a space after the symbol for en-ZA, which
 * reads oddly next to a large heading, so it is removed while keeping the
 * space as the thousands separator, as South African convention expects.
 */
export function formatPrice(amount: number, currency = 'ZAR'): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace(/^(\D+)\s/, '$1');
}

/** How a lesson is delivered, in words a parent would use. */
export function formatMode(mode: string): string {
  if (mode === 'in_person') return 'In person';
  if (mode === 'hybrid') return 'Online or in person';
  return 'Online';
}

/**
 * The price in force today. Package.price keeps history so past invoices stay
 * accurate, so the current one is the newest entry that has already started.
 */
function currentPrice(price: { amount: number; currency: string; effectiveFrom: Date }[]) {
  const now = Date.now();

  return [...price]
    .filter((entry) => new Date(entry.effectiveFrom).getTime() <= now)
    .sort(
      (a, b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime()
    )[0];
}

export async function getActivePackages(category?: PackageCategory): Promise<PackageView[]> {
  await connectDB();

  const packages = await Package.find({
    isActive: true,
    ...(category ? { category } : {}),
  }).lean();

  const views: PackageView[] = [];

  for (const pkg of packages) {
    const price = currentPrice(pkg.price ?? []);

    // A package with no price in force yet is simply not offered.
    if (!price) continue;

    views.push({
      slug: pkg.slug,
      name: pkg.name,
      description: pkg.description,
      category: pkg.category,
      mode: pkg.mode,
      sessionsIncluded: pkg.sessionsIncluded,
      sessionDurationMinutes: pkg.sessionDurationMinutes,
      features: (pkg.features ?? []).map((feature) => ({
        label: feature.label,
        included: feature.included,
      })),
      amount: price.amount,
      currency: price.currency,
    });
  }

  return views.sort((a, b) => a.amount - b.amount);
}

/** Everything at once, grouped the way the pricing page presents it. */
export async function getPricing() {
  const all = await getActivePackages();

  return {
    monthly: all.filter((pkg) => pkg.category === 'monthly'),
    examPrep: all.filter((pkg) => pkg.category === 'exam_prep'),
    hourly: all.filter((pkg) => pkg.category === 'hourly'),
  };
}
