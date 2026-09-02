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
 * The formatters live in `@/lib/payments/format`, which pulls in no Mongoose,
 * so a client component can import them without dragging the MongoDB driver
 * into the browser bundle. Re-exported here so existing server callers keep
 * working unchanged.
 */
export { formatMode, formatPrice } from '@/lib/payments/format';

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
